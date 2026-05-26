# APTCV Local Model

This folder contains a small decoder-only Transformer for CV generation.

## Pipeline

Run from `backend/ml`:

```bash
python3 prepare_cv_data.py
python3 train_tokenizer.py --vocab_size 4096 data/pretrain_corpus.txt
python3 pretrain.py \
  --data_path data/pretrain_corpus.txt \
  --max_steps 2000 \
  --batch_size 4 \
  --gradient_accumulation 4
python3 finetune_cv.py \
  --pretrained_path checkpoints/latest.pt \
  --num_epochs 10 \
  --batch_size 4
python3 serve.py \
  --model models/aptcv_cv_best.pt \
  --tokenizer tokenizer/aptcv_tokenizer.json \
  --port 8000
```

If `models/aptcv_cv_best.pt` does not exist yet, `serve.py` falls back to
`models/smoke/aptcv_cv_best.pt` with a warning. The smoke checkpoint is tiny
and not suitable for real generation, so the server uses a hardened APTCV
fallback for CV JSON requests until a real checkpoint is available.

Point the Node backend at this server for CV generation with:

```env
CV_OUTPUT_LANGUAGE=en
CV_GENERATION_PROVIDER=aptcv
CV_GENERATION_BASE_URL=http://127.0.0.1:8000/v1
CV_GENERATION_MODEL=aptcv-model
```

If you want LM Studio to review and rewrite CV suggestions while the APTCV
model keeps generating the CV, use a separate review provider:

```env
CV_OUTPUT_LANGUAGE=en
CV_GENERATION_PROVIDER=aptcv
CV_GENERATION_BASE_URL=http://127.0.0.1:8000/v1
CV_GENERATION_MODEL=aptcv-model

CV_REVIEW_PROVIDER=lmstudio
CV_REVIEW_BASE_URL=http://127.0.0.1:1234/v1
CV_REVIEW_MODEL=your-lmstudio-model
```

For the older `/generate` custom server path, keep:

```env
CV_OUTPUT_LANGUAGE=en
CV_GENERATION_PROVIDER=custom
CUSTOM_AI_API_URL=http://127.0.0.1:8000
```

## Import Kaggle Resume Dataset

The dataset `snehaanbhawal/resume-dataset` is English resume/CV data. A mirror
commonly exposes a `Resume.csv` with `ID`, `Resume_str`, `Resume_html`, and
`Category` columns. Convert it into training files with:

```bash
python3 import_resume_dataset.py \
  --source snehaanbhawal/resume-dataset \
  --out_dir data
```

If Kaggle download needs credentials, download the ZIP/CSV manually or use a
direct mirror URL, then run:

```bash
python3 import_resume_dataset.py \
  --source data/raw/resume-dataset.zip \
  --out_dir data
```

The script writes `data/kaggle_resume_pretrain.txt`,
`data/kaggle_resume_finetune.jsonl`, and `data/kaggle_resume_summary.json`.
To feed it directly into the current pipeline files:

```bash
python3 import_resume_dataset.py \
  --source data/raw/resume-dataset.zip \
  --out_dir data \
  --append
```

For a fast sanity check on a laptop:

```bash
python3 pretrain.py \
  --data_path data/pretrain_corpus.txt \
  --max_steps 2 \
  --warmup_steps 0 \
  --batch_size 1 \
  --gradient_accumulation 1 \
  --hidden_dim 64 \
  --num_layers 2 \
  --num_heads 4 \
  --ffn_dim 256 \
  --max_seq_len 128 \
  --log_interval 1 \
  --save_interval 2 \
  --num_workers 0 \
  --device cpu \
  --checkpoint_dir checkpoints/smoke
python3 finetune_cv.py \
  --pretrained_path checkpoints/smoke/latest.pt \
  --num_epochs 1 \
  --batch_size 2 \
  --max_samples 24 \
  --num_workers 0 \
  --device cpu \
  --output_dir models/smoke
```

The smoke model only proves that the code path works. Use the full pipeline,
more data, and a GPU for useful generation quality.

For a stronger CPU-only local run than the smoke test, use a longer context
and train more than two steps. It will still not match a large LLM, but it
produces a checkpoint the server can use instead of falling back immediately:

```bash
python3 train_tokenizer.py --vocab_size 8000 data/pretrain_corpus.txt
python3 pretrain.py \
  --data_path data/pretrain_corpus.txt \
  --max_steps 600 \
  --warmup_steps 60 \
  --batch_size 2 \
  --gradient_accumulation 4 \
  --hidden_dim 192 \
  --num_layers 4 \
  --num_heads 6 \
  --ffn_dim 768 \
  --max_seq_len 384 \
  --log_interval 20 \
  --save_interval 200 \
  --num_workers 0 \
  --device cpu \
  --checkpoint_dir checkpoints/local-quality
python3 finetune_cv.py \
  --pretrained_path checkpoints/local-quality/latest.pt \
  --num_epochs 3 \
  --batch_size 2 \
  --num_workers 0 \
  --device cpu \
  --output_dir models
```

For a useful production-quality APTCV model, run the same pipeline on a GPU,
increase `--max_steps`, and fine-tune on the full `data/cv_finetune.jsonl`
instead of the smoke subset.
