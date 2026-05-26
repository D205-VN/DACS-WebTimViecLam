#!/usr/bin/env python3
"""Import the Kaggle resume dataset into APTCV training files.

The dataset at snehaanbhawal/resume-dataset is English resume data with
columns such as ID, Resume_str, Resume_html, and Category. This script accepts
a local CSV/ZIP/directory, a Kaggle dataset slug, a Kaggle dataset URL, or a
direct CSV/ZIP URL and writes:

  - kaggle_resume_pretrain.txt
  - kaggle_resume_finetune.jsonl
  - kaggle_resume_summary.json

Use --append to also append the converted samples to the existing
pretrain_corpus.txt and cv_finetune.jsonl used by the training pipeline.
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path
from typing import Iterable, TextIO


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = SCRIPT_DIR / "data"

RESUME_FIELDS = [
    "Resume_str",
    "Resume",
    "resume",
    "resume_text",
    "ResumeText",
    "text",
    "content",
]
CATEGORY_FIELDS = ["Category", "category", "label", "role", "job_category"]
HTML_FIELDS = ["Resume_html", "resume_html", "html"]
ID_FIELDS = ["ID", "id", "resume_id"]

SECTION_HEADINGS = {
    "summary": ["summary", "profile", "objective", "career objective", "professional summary"],
    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "career history",
        "projects",
    ],
    "education": ["education", "academic background", "academic qualifications"],
    "skills": ["skills", "technical skills", "core competencies", "competencies"],
    "certifications": ["certifications", "certification", "licenses", "licenses and certifications"],
    "hobbies": ["interests", "hobbies", "activities"],
}
ALL_HEADINGS = sorted({heading for values in SECTION_HEADINGS.values() for heading in values}, key=len, reverse=True)


def normalize_kaggle_source(source: str) -> str:
    value = source.strip()
    if "kaggle.com/datasets/" in value:
        parsed = urllib.parse.urlparse(value)
        parts = [part for part in parsed.path.split("/") if part]
        try:
            index = parts.index("datasets")
            return f"https://www.kaggle.com/api/v1/datasets/download/{parts[index + 1]}/{parts[index + 2]}"
        except (ValueError, IndexError):
            return value

    if re.fullmatch(r"[\w.-]+/[\w.-]+", value) and not Path(value).exists():
        return f"https://www.kaggle.com/api/v1/datasets/download/{value}"

    return value


def is_url(value: str) -> bool:
    parsed = urllib.parse.urlparse(value)
    return parsed.scheme in {"http", "https"}


def filename_from_response(response: urllib.request.addinfourl, fallback_url: str) -> str:
    disposition = response.headers.get("Content-Disposition", "")
    match = re.search(r'filename="?([^";]+)"?', disposition)
    if match:
        return match.group(1)

    parsed = urllib.parse.urlparse(response.url or fallback_url)
    name = Path(parsed.path).name
    return name or "resume_dataset"


def download_source(url: str, raw_dir: Path) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    with urllib.request.urlopen(request, timeout=120) as response:
        filename = filename_from_response(response, url)
        target = raw_dir / filename
        if not target.suffix:
            content_type = response.headers.get("Content-Type", "")
            target = target.with_suffix(".zip" if "zip" in content_type else ".csv")

        with target.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)

    return target


def open_text_stream(path: Path) -> TextIO:
    return path.open("r", encoding="utf-8-sig", errors="replace", newline="")


def csv_candidates(path: Path) -> list[Path]:
    if path.is_dir():
        return sorted(path.rglob("*.csv"), key=lambda item: (item.name.lower() != "resume.csv", str(item)))
    if path.is_file() and path.suffix.lower() == ".csv":
        return [path]
    return []


def zip_csv_members(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        members = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        return sorted(members, key=lambda name: (Path(name).name.lower() != "resume.csv", name))


def choose_field(row: dict[str, str], candidates: list[str]) -> str:
    for key in candidates:
        if key in row and str(row[key] or "").strip():
            return str(row[key] or "")

    lower_map = {key.lower(): key for key in row.keys()}
    for key in candidates:
        actual = lower_map.get(key.lower())
        if actual and str(row.get(actual) or "").strip():
            return str(row.get(actual) or "")

    return ""


def strip_html(value: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", value)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|tr|h[1-6]|section)>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(text)


def mask_contact(text: str) -> str:
    text = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email]", text, flags=re.I)
    text = re.sub(r"(?:\+?\d[\d\s().-]{7,}\d)", "[phone]", text)
    return text


def clean_resume_text(value: str, should_mask_contact: bool = True) -> str:
    text = strip_html(value)
    text = text.replace("\r", "\n")
    text = re.sub(r"\t+", " ", text)
    text = re.sub(r"[ \u00a0]+", " ", text)
    text = re.sub(r"\n\s+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if should_mask_contact:
        text = mask_contact(text)
    return text


def normalize_category(value: str) -> str:
    cleaned = re.sub(r"[_-]+", " ", str(value or "")).strip()
    if not cleaned:
        return "General"
    return " ".join(part.capitalize() if not part.isupper() else part for part in cleaned.split())


def normalize_heading(line: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", line.lower()).strip()


def split_lines(text: str) -> list[str]:
    return [line.strip(" -•*\t") for line in text.splitlines() if line.strip(" -•*\t")]


def is_heading(line: str, headings: list[str] | None = None) -> bool:
    normalized = normalize_heading(line)
    choices = headings or ALL_HEADINGS
    return normalized in choices or any(normalized == heading for heading in choices)


def extract_section(text: str, headings: list[str], limit: int = 1200) -> str:
    lines = split_lines(text)
    capturing = False
    collected: list[str] = []

    for line in lines:
        normalized = normalize_heading(line)
        if normalized in headings:
            capturing = True
            continue
        if capturing and is_heading(line):
            break
        if capturing:
            collected.append(line)

    return "\n".join(collected).strip()[:limit].strip()


def first_summary(text: str, category: str) -> str:
    section = extract_section(text, SECTION_HEADINGS["summary"], 550)
    if section:
        return section

    lines = [
        line
        for line in split_lines(text)
        if len(line) > 35
        and "[email]" not in line.lower()
        and "[phone]" not in line.lower()
        and not is_heading(line)
    ]
    if lines:
        return " ".join(lines[:2])[:550].strip()

    return f"Motivated {category} professional seeking to contribute practical value in a professional team."


def sentence_chunks(text: str, max_items: int = 6) -> list[str]:
    raw_parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    parts = [part.strip(" -•*") for part in raw_parts if len(part.strip(" -•*")) >= 20]
    return parts[:max_items]


def bullets_from_text(value: str, fallback: str, max_items: int = 6) -> str:
    parts = sentence_chunks(value, max_items)
    if not parts:
        parts = sentence_chunks(fallback, max_items)
    return "\n".join(f"- {part}" for part in parts[:max_items]) if parts else "Not updated"


def inline_list(value: str, fallback: str = "Not updated", max_length: int = 700) -> str:
    text = " ".join(split_lines(value))
    text = re.sub(r"\s*[,;]\s*", ", ", text)
    text = re.sub(r"\s{2,}", " ", text).strip(" ,;")
    return (text or fallback)[:max_length].strip()


def assistant_payload(text: str, category: str) -> dict[str, str]:
    experience_section = extract_section(text, SECTION_HEADINGS["experience"], 1800)
    education_section = extract_section(text, SECTION_HEADINGS["education"], 900)
    skills_section = extract_section(text, SECTION_HEADINGS["skills"], 900)
    certifications_section = extract_section(text, SECTION_HEADINGS["certifications"], 700)
    hobbies_section = extract_section(text, SECTION_HEADINGS["hobbies"], 500)

    return {
        "objective": first_summary(text, category),
        "experience": bullets_from_text(experience_section, text, 6),
        "education": bullets_from_text(education_section, "Add school, degree, major, and dates.", 4),
        "skills": inline_list(skills_section, "Add role-relevant technical skills, tools, and soft skills."),
        "certifications": inline_list(certifications_section, "Not updated", 500),
        "hobbies": inline_list(hobbies_section, "Not updated", 400),
    }


def finetune_text(category: str, resume_text: str, payload: dict[str, str]) -> str:
    clipped_resume = resume_text[:2500].strip()
    assistant_json = json.dumps(payload, ensure_ascii=False, separators=(",", ": "))
    return (
        "<|system|>You are a professional CV writer. Return only valid JSON with fields: "
        "objective, experience, education, skills, certifications, hobbies.<|end|>\n"
        f"<|user|>\nTarget role: {category}\nRaw resume:\n{clipped_resume}<|end|>\n"
        f"<|assistant|>\n{assistant_json}</s>"
    )


def iter_csv_rows_from_stream(stream: TextIO) -> Iterable[dict[str, str]]:
    reader = csv.DictReader(stream)
    for row in reader:
        if row:
            yield row


def iter_rows(source_path: Path) -> Iterable[dict[str, str]]:
    candidates = csv_candidates(source_path)
    if candidates:
        for csv_path in candidates:
            with open_text_stream(csv_path) as stream:
                yield from iter_csv_rows_from_stream(stream)
        return

    if source_path.is_file() and zipfile.is_zipfile(source_path):
        with zipfile.ZipFile(source_path) as archive:
            members = zip_csv_members(source_path)
            if not members:
                raise FileNotFoundError(f"No CSV files found inside {source_path}")
            for member in members:
                with archive.open(member) as raw:
                    stream = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="")
                    yield from iter_csv_rows_from_stream(stream)
        return

    raise FileNotFoundError(f"No CSV input found at {source_path}")


def convert_dataset(
    source: str,
    out_dir: Path,
    max_rows: int | None = None,
    append: bool = False,
    should_mask_contact: bool = True,
) -> dict[str, object]:
    out_dir.mkdir(parents=True, exist_ok=True)
    normalized_source = normalize_kaggle_source(source)

    if is_url(normalized_source):
        source_path = download_source(normalized_source, out_dir / "raw")
    else:
        source_path = Path(normalized_source).expanduser().resolve()

    pretrain_path = out_dir / "kaggle_resume_pretrain.txt"
    finetune_path = out_dir / "kaggle_resume_finetune.jsonl"
    summary_path = out_dir / "kaggle_resume_summary.json"

    count = 0
    skipped = 0
    categories: Counter[str] = Counter()

    with pretrain_path.open("w", encoding="utf-8") as pretrain_out, finetune_path.open("w", encoding="utf-8") as finetune_out:
        for row in iter_rows(source_path):
            raw_resume = choose_field(row, RESUME_FIELDS) or choose_field(row, HTML_FIELDS)
            resume_text = clean_resume_text(raw_resume, should_mask_contact=should_mask_contact)
            if len(resume_text) < 80:
                skipped += 1
                continue

            category = normalize_category(choose_field(row, CATEGORY_FIELDS))
            row_id = choose_field(row, ID_FIELDS).strip()
            payload = assistant_payload(resume_text, category)

            pretrain_out.write(f"Category: {category}\n")
            if row_id:
                pretrain_out.write(f"Resume ID: {row_id}\n")
            pretrain_out.write("Resume:\n")
            pretrain_out.write(resume_text)
            pretrain_out.write("\n</s>\n\n")

            finetune_out.write(json.dumps({"text": finetune_text(category, resume_text, payload)}, ensure_ascii=False))
            finetune_out.write("\n")

            categories[category] += 1
            count += 1
            if max_rows and count >= max_rows:
                break

    if append and count:
        canonical_pretrain = out_dir / "pretrain_corpus.txt"
        canonical_finetune = out_dir / "cv_finetune.jsonl"
        with canonical_pretrain.open("a", encoding="utf-8") as target, pretrain_path.open("r", encoding="utf-8") as source_file:
            target.write("\n")
            target.write(source_file.read())
        with canonical_finetune.open("a", encoding="utf-8") as target, finetune_path.open("r", encoding="utf-8") as source_file:
            target.write(source_file.read())

    summary = {
        "source": source,
        "resolved_source": str(source_path),
        "rows_written": count,
        "rows_skipped": skipped,
        "categories": dict(categories.most_common()),
        "outputs": {
            "pretrain": str(pretrain_path),
            "finetune": str(finetune_path),
            "summary": str(summary_path),
        },
        "appended_to_training_files": append,
        "contact_masked": should_mask_contact,
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Kaggle resume data for APTCV training.")
    parser.add_argument(
        "--source",
        required=True,
        help="CSV/ZIP/directory path, Kaggle slug, Kaggle dataset URL, or direct CSV/ZIP URL.",
    )
    parser.add_argument("--out_dir", default=str(DEFAULT_OUT_DIR), help="Output directory for converted files.")
    parser.add_argument("--max_rows", type=int, default=None, help="Optional row limit for smoke runs.")
    parser.add_argument("--append", action="store_true", help="Append converted data to pretrain_corpus.txt and cv_finetune.jsonl.")
    parser.add_argument("--no_mask_contact", action="store_true", help="Keep emails and phone numbers instead of masking them.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        summary = convert_dataset(
            source=args.source,
            out_dir=Path(args.out_dir).expanduser().resolve(),
            max_rows=args.max_rows,
            append=args.append,
            should_mask_contact=not args.no_mask_contact,
        )
    except Exception as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
