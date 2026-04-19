import pandas as pd
import json
import ast
from collections import Counter
import re

def process_dataset():
    file_path = '/Users/tandung/.cache/kagglehub/datasets/saugataroyarghya/resume-dataset/versions/1/resume_data.csv'
    df = pd.read_csv(file_path)
    
    # Fix column names with BOM
    df.columns = [c.replace('\ufeff', '') for c in df.columns]
    
    knowledge_base = {}
    
    # We will group by job_position_name
    # if job_position_name is not available, we could try to extract from positions
    
    # Let's clean job_position_name
    if 'job_position_name' not in df.columns:
        print("Column job_position_name not found.")
        return
        
    df['job_position_name'] = df['job_position_name'].fillna('Other').astype(str).str.strip().str.title()
    
    # Keep only the top 30 most frequent job titles to keep the JSON small and relevant
    top_jobs = df['job_position_name'].value_counts().head(30).index.tolist()
    
    for job in top_jobs:
        if job == 'Other' or job == 'Nan' or len(job) < 3:
            continue
            
        subset = df[df['job_position_name'] == job]
        
        # 1. Extract objectives
        objectives = subset['career_objective'].dropna().tolist()
        # Keep top 3 longest/most descriptive objectives
        objectives = sorted(list(set(objectives)), key=len, reverse=True)[:3]
        
        # 2. Extract skills
        all_skills = []
        for skills_str in subset['skills'].dropna():
            try:
                # Some are stringified lists
                if skills_str.startswith('['):
                    skills_list = ast.literal_eval(skills_str)
                    all_skills.extend([s.strip() for s in skills_list])
                else:
                    all_skills.extend([s.strip() for s in skills_str.split(',')])
            except:
                pass
        
        # Get top 15 skills
        top_skills = [skill for skill, count in Counter(all_skills).most_common(15)]
        
        # 3. Extract responsibilities
        all_resp = []
        for resp_str in subset['responsibilities'].dropna():
            # split by newline or comma
            resps = [r.strip() for r in re.split(r'\n|,', resp_str) if len(r.strip()) > 10]
            all_resp.extend(resps)
            
        top_resp = [resp for resp, count in Counter(all_resp).most_common(5)]
        
        knowledge_base[job] = {
            "objectives": objectives,
            "skills": top_skills,
            "responsibilities": top_resp
        }
        
    # Save to a JSON file in the backend directory
    output_path = '/Users/tandung/Documents/DACS/WebTimViec/backend/src/data/resume_knowledge.json'
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(knowledge_base, f, ensure_ascii=False, indent=2)
        
    print(f"Knowledge base created with {len(knowledge_base)} roles at {output_path}")

if __name__ == "__main__":
    process_dataset()
