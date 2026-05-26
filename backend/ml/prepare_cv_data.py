import json
import os
import random

# Set random seed for reproducibility
random.seed(42)

# Directory Setup
OUTPUT_DIR = "/Users/tandung/Documents/DACS/WebTimViec/backend/ml/data"
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "cv_finetune.jsonl")
PRETRAIN_CORPUS_FILE = os.path.join(OUTPUT_DIR, "pretrain_corpus.txt")

# 34 Roles
ROLES = [
    "Software Engineer", "Frontend Developer", "Backend Developer", "Data Analyst", 
    "Data Scientist", "Product Manager", "UI/UX Designer", "Marketing Manager", 
    "Digital Marketing Specialist", "Content Writer", "Graphic Designer", "HR Manager", 
    "Financial Analyst", "Accountant", "Sales Manager", "Business Analyst", 
    "Project Manager", "DevOps Engineer", "QA Engineer", "Mobile Developer", 
    "Machine Learning Engineer", "Cloud Architect", "Cybersecurity Analyst", 
    "Technical Writer", "Customer Success Manager", "Supply Chain Manager", 
    "Operations Manager", "Mechanical Engineer", "Civil Engineer", "Electrical Engineer", 
    "Teacher", "Nurse", "Pharmacist", "Lawyer"
]

LEVELS = ["Fresher", "Junior", "Mid", "Senior"]

# Realistic Names (Vietnamese in English and Western)
FIRST_NAMES = [
    "Minh", "Nam", "Tuan", "Anh", "Duy", "Hoang", "Huy", "Phuc", "Quan", "Viet", 
    "Lan", "Mai", "Vy", "Trang", "Linh", "Thao", "Huong", "Giang", "Phuong", "Ngoc",
    "John", "David", "Michael", "Sarah", "Emily", "James", "Robert", "Jessica", "Daniel", "Thomas"
]
LAST_NAMES = [
    "Nguyen", "Tran", "Le", "Pham", "Huynh", "Phan", "Vu", "Vo", "Dang", "Bui",
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"
]

LOCATIONS = [
    "Ho Chi Minh City, Vietnam", "Hanoi, Vietnam", "Da Nang, Vietnam", "Can Tho, Vietnam",
    "New York, NY", "San Francisco, CA", "Seattle, WA", "Austin, TX", "London, UK", "Singapore"
]

UNIVERSITIES = [
    "Ho Chi Minh City University of Technology", "Hanoi University of Science and Technology",
    "RMIT University Vietnam", "FPT University", "VNU University of Engineering and Technology",
    "Stanford University", "UC Berkeley", "Massachusetts Institute of Technology", "National University of Singapore"
]

DEGREES = {
    "Technical": ["Bachelor of Science in Computer Science", "Bachelor of Engineering in Information Technology", "Master of Science in Software Engineering"],
    "Business": ["Bachelor of Business Administration", "Bachelor of Science in Finance", "Master of Business Administration"],
    "Design": ["Bachelor of Fine Arts in Graphic Design", "Bachelor of Science in Interaction Design"],
    "General": ["Bachelor of Arts in English Literature", "Bachelor of Science in Biology", "Bachelor of Laws (LL.B.)", "Bachelor of Science in Nursing"]
}

COMPANIES = [
    "VNG Corporation", "FPT Software", "Viettel Group", "MOMO", "Tiki", "Grab",
    "Google", "Meta", "Microsoft", "Amazon", "Accenture", "Deloitte", "Shopee"
]

CERTIFICATIONS_POOL = {
    "Software Engineer": ["AWS Certified Solutions Architect", "Oracle Certified Professional Java SE", "Scrum Alliance CSM"],
    "Frontend Developer": ["Meta Front-End Developer Professional Certificate", "W3Schools HTML/CSS/JS Certification"],
    "Backend Developer": ["AWS Certified Developer", "Google Cloud Professional Cloud Developer", "CKA: Certified Kubernetes Administrator"],
    "Data Analyst": ["Google Data Analytics Professional Certificate", "Microsoft Certified: Power BI Data Analyst Associate"],
    "Data Scientist": ["IBM Data Science Professional Certificate", "Google Cloud Professional Data Engineer"],
    "Product Manager": ["Product School PMC", "Pragmatic Institute Certified Product Manager"],
    "UI/UX Designer": ["Google UX Design Professional Certificate", "Interaction Design Foundation Certified Member"],
    "Marketing Manager": ["Google Analytics Individual Qualification", "HubSpot Inbound Marketing Certification"],
    "Digital Marketing Specialist": ["Google Ads Certification", "Facebook Certified Digital Marketing Associate"],
    "Content Writer": ["HubSpot Content Marketing Certification", "Copyblogger Certified Content Marketer"],
    "Graphic Designer": ["Adobe Certified Professional in Photoshop", "Adobe Certified Professional in Illustrator"],
    "HR Manager": ["SHRM-CP (Society for Human Resource Management)", "PHR (Professional in Human Resources)"],
    "Financial Analyst": ["CFA Charterholder", "FMVA (Financial Modeling & Valuation Analyst)"],
    "Accountant": ["CPA (Certified Public Accountant)", "ACCA (Association of Chartered Certified Accountants)"],
    "Sales Manager": ["Certified Sales Professional (CSP)", "HubSpot Frictionless Sales Certification"],
    "Business Analyst": ["CBAP (Certified Business Analysis Professional)", "PMI-PBA (PMI Professional in Business Analysis)"],
    "Project Manager": ["PMP (Project Management Professional)", "PRINCE2 Practitioner"],
    "DevOps Engineer": ["CKA: Certified Kubernetes Administrator", "AWS Certified DevOps Engineer - Professional", "HashiCorp Certified: Terraform Associate"],
    "QA Engineer": ["ISTQB Certified Tester Foundation Level", "Certified Software Manual Tester (CSMT)"],
    "Mobile Developer": ["Google Associate Android Developer", "Apple iOS Developer Academy Graduate"],
    "Machine Learning Engineer": ["TensorFlow Developer Certificate", "AWS Certified Machine Learning - Specialty"],
    "Cloud Architect": ["AWS Certified Solutions Architect - Professional", "Google Cloud Professional Cloud Architect"],
    "Cybersecurity Analyst": ["CompTIA Security+", "CISSP (Certified Information Systems Security Professional)", "CEH (Certified Ethical Hacker)"],
    "Technical Writer": ["Society for Technical Communication (STC) Certification", "Google Technical Writing Course Completion"],
    "Customer Success Manager": ["Certified Customer Success Manager (CCSM)", "SuccessHacker CSM Level 1"],
    "Supply Chain Manager": ["CSCP (Certified Supply Chain Professional)", "APICS Certified in Planning and Inventory Management"],
    "Operations Manager": ["Lean Six Sigma Green Belt", "Project Management Professional (PMP)"],
    "Mechanical Engineer": ["Professional Engineer (PE) License", "Certified SolidWorks Professional (CSWP)"],
    "Civil Engineer": ["Professional Engineer (PE) License", "Project Management Professional (PMP)"],
    "Electrical Engineer": ["Professional Engineer (PE) License", "IEEE Certified Member"],
    "Teacher": ["TEFL/TESOL 120-Hour Certificate", "State Teaching License"],
    "Nurse": ["Registered Nurse (RN) License", "Advanced Cardiovascular Life Support (ACLS)"],
    "Pharmacist": ["Licensed Pharmacist", "Board Certified Pharmacotherapy Specialist (BCPS)"],
    "Lawyer": ["Bar Association Admission License", "LL.M. (Master of Laws) in Corporate Law"]
}

HOBBIES_POOL = [
    "Photography, hiking, and exploring nature",
    "Playing chess, reading sci-fi novels, and coding side projects",
    "Running marathons, cycling, and fitness training",
    "Playing acoustic guitar, songwriting, and attending live music gigs",
    "Cooking international cuisines, food blogging, and coffee brewing",
    "Traveling, learning new languages, and cultural exchange",
    "Volunteering at local animal shelters, gardening, and DIY crafting",
    "Playing basketball, watching sports documentaries, and gaming",
    "Writing short stories, public speaking, and reading history",
    "Sketching, painting, and visiting contemporary art museums"
]

SKILLS_POOL = {
    "Software Engineer": ["Python", "Java", "C++", "Go", "Data Structures", "Algorithms", "Git", "Docker", "System Design"],
    "Frontend Developer": ["HTML5", "CSS3", "JavaScript", "TypeScript", "React.js", "Vue.js", "Tailwind CSS", "Redux", "Webpack"],
    "Backend Developer": ["Node.js", "Express.js", "Python", "Django", "Go", "PostgreSQL", "MongoDB", "Redis", "REST APIs", "gRPC"],
    "Data Analyst": ["SQL", "Python", "R", "Excel", "Tableau", "Power BI", "Data Visualization", "Statistical Analysis", "Pandas"],
    "Data Scientist": ["Python", "R", "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "SQL", "Pandas", "Scikit-Learn"],
    "Product Manager": ["Product Roadmap", "Agile/Scrum", "Jira", "Market Research", "SQL", "A/B Testing", "User Analytics", "Figma"],
    "UI/UX Designer": ["Figma", "Adobe XD", "Sketch", "Wireframing", "Prototyping", "User Research", "Information Architecture", "UI Design"],
    "Marketing Manager": ["Brand Strategy", "SEO", "SEM", "Content Strategy", "Google Analytics", "Budgeting", "Team Leadership", "Copywriting"],
    "Digital Marketing Specialist": ["Google Ads", "Facebook Ads", "SEO", "Google Analytics", "Email Marketing", "Copywriting", "SMM", "Mailchimp"],
    "Content Writer": ["SEO Writing", "Copywriting", "Content Strategy", "Proofreading", "Blogging", "WordPress", "Creative Writing"],
    "Graphic Designer": ["Adobe Photoshop", "Adobe Illustrator", "InDesign", "Branding", "Typography", "Layout Design", "Vector Illustration"],
    "HR Manager": ["Talent Acquisition", "Employee Relations", "HR Policies", "Onboarding", "Performance Management", "Conflict Resolution"],
    "Financial Analyst": ["Financial Modeling", "Excel VBA", "Corporate Finance", "Valuation", "SQL", "Financial Reporting", "Bloomberg"],
    "Accountant": ["Bookkeeping", "Tax Preparation", "QuickBooks", "Excel", "GAAP", "Financial Auditing", "Accounts Payable/Receivable"],
    "Sales Manager": ["B2B Sales", "Lead Generation", "CRM (Salesforce)", "Negotiation", "Account Management", "Sales Forecasting"],
    "Business Analyst": ["Requirements Gathering", "SQL", "Agile", "UML", "Process Mapping", "Jira", "Data Analysis", "Tableau"],
    "Project Manager": ["Agile", "Scrum", "Asana", "Jira", "Risk Management", "Budgeting", "Stakeholder Communication", "Resource Allocation"],
    "DevOps Engineer": ["Docker", "Kubernetes", "CI/CD (Jenkins, GitHub Actions)", "AWS", "Terraform", "Linux", "Bash Scripting", "Prometheus"],
    "QA Engineer": ["Selenium", "Playwright", "Manual Testing", "Automation Testing", "Jira", "Postman", "CI/CD", "Bug Tracking", "Python"],
    "Mobile Developer": ["Swift", "Kotlin", "React Native", "Flutter", "iOS Development", "Android Development", "REST APIs", "Git"],
    "Machine Learning Engineer": ["Python", "PyTorch", "TensorFlow", "Scikit-Learn", "NLP", "Computer Vision", "MLOps", "Docker", "CUDA"],
    "Cloud Architect": ["AWS", "Azure", "GCP", "Cloud Security", "Microservices", "Docker", "Terraform", "Networking", "IAM"],
    "Cybersecurity Analyst": ["Penetration Testing", "Wireshark", "SIEM", "Firewalls", "Network Security", "Cryptography", "Linux", "OWASP"],
    "Technical Writer": ["API Documentation", "Markdown", "GitBook", "Confluence", "DITA", "Technical Illustration", "Editing", "HTML"],
    "Customer Success Manager": ["Customer Retention", "Salesforce", "Intercom", "Onboarding", "Conflict Resolution", "Account Management"],
    "Supply Chain Manager": ["Logistics", "Inventory Management", "ERP (SAP)", "Procurement", "Vendor Negotiation", "Operations Planning"],
    "Operations Manager": ["Process Optimization", "Lean Six Sigma", "Budget Management", "Team Leadership", "KPI Tracking", "Change Management"],
    "Mechanical Engineer": ["SolidWorks", "AutoCAD", "Thermodynamics", "FEA", "GD&T", "Manufacturing Processes", "MATLAB", "Prototyping"],
    "Civil Engineer": ["AutoCAD Civil 3D", "Structural Analysis", "Project Estimation", "GIS", "Concrete Technology", "Site Supervision"],
    "Electrical Engineer": ["MATLAB", "Circuit Design", "Altium Designer", "PLC Programming", "Power Systems", "Microcontrollers", "IoT"],
    "Teacher": ["Curriculum Design", "Classroom Management", "Lesson Planning", "Educational Technology", "Student Assessment", "ESL Instruction"],
    "Nurse": ["Patient Assessment", "IV Therapy", "Wound Care", "Medication Administration", "EMR Systems", "CPR/BLS", "Triage"],
    "Pharmacist": ["Dispensing", "Pharmacology", "Drug Interactions", "Inventory Control", "Patient Counseling", "Pharmacy Software"],
    "Lawyer": ["Legal Research", "Contract Drafting", "Litigation", "Client Counseling", "Corporate Law", "Intellectual Property", "Negotiation"]
}

# Template lists for objectives and experience points by role and level
OBJECTIVE_TEMPLATES = {
    "Fresher": [
        "Enthusiastic and detail-oriented {role} graduate seeking an entry-level position to apply my academic foundation in {skills} and contribute to innovative projects.",
        "Aspiring {role} looking to leverage solid knowledge in {skills} to add value to a dynamic engineering team while building practical skills in a professional environment.",
        "Highly motivated individual seeking to start a career as a {role}, bringing strong academic project experience, proficiency in {skills}, and a passion for continuous learning."
    ],
    "Junior": [
        "Results-driven {role} with {years} years of hands-on experience in {skills}. Eager to join a growth-oriented company to further refine my skills and drive feature delivery.",
        "Dedicated {role} skilled in {skills}, seeking to leverage my {years} years of industry experience to build scalable applications and improve overall product efficiency.",
        "Proactive {role} with a proven track record of developing functional systems during my {years} years of experience. Excited to apply my expertise in {skills} to new engineering challenges."
    ],
    "Mid": [
        "Accomplished {role} with over {years} years of experience specializing in {skills}. Passionate about architecting efficient systems, optimizing performance, and mentoring junior engineers.",
        "Innovative {role} with {years}+ years of experience design and development. Proven ability to translate user requirements into robust solutions using {skills} to achieve key business goals.",
        "Dynamic {role} with {years} years of experience in managing applications and infrastructure. Seeking a challenging role to deploy cutting-edge solutions using my skills in {skills}."
    ],
    "Senior": [
        "Strategic and visionary {role} with {years}+ years of expertise in driving large-scale architectural designs and technical leadership. Expert in {skills} with a focus on high reliability and team scaling.",
        "Seasoned {role} with a {years}-year track record of architecting scalable applications and leading cross-functional teams. Passionate about leveraging {skills} to drive digital transformation.",
        "High-performing {role} with {years}+ years of leadership and development experience. Proven success in reducing operating costs, accelerating time-to-market, and spearheading projects using {skills}."
    ]
}

EXPERIENCE_BULLETS = {
    "Technical": {
        "Fresher": [
            "Developed an open-source {proj_name} project using {skills}, resulting in {metric1}% faster response times and over {metric2}+ downloads on GitHub.",
            "Designed and implemented database schemas for a {proj_name} academic project, improving query execution speeds by {metric1}% under heavy load simulation.",
            "Collaborated in a team of {team_size} to build a {proj_name} prototype, successfully demonstrating it to faculty members and earning top grades."
        ],
        "Junior": [
            "Maintained and enhanced {proj_name} modules using {skills}, which reduced application crashes by {metric1}% and resolved over {metric2}+ bug tickets.",
            "Refactored legacy code in {proj_name}, improving general code maintainability and decreasing technical debt by {metric1}% over {months} months.",
            "Participated in agile ceremonies and deployed {num_features}+ minor and major features using CI/CD pipelines, reducing deployment times by {metric2}%."
        ],
        "Mid": [
            "Led the backend/frontend development of {proj_name} serving {metric1}k+ active monthly users, increasing overall system availability to {metric2}%.",
            "Designed and implemented REST/GraphQL APIs and integrated third-party services, decreasing API latency by {metric1}% and saving {metric2}% on server costs.",
            "Mentored {team_size} junior developers and implemented code review guidelines, improving pull request approval velocity by {metric1}%."
        ],
        "Senior": [
            "Architected and migrated legacy monolith services to a microservices architecture using {skills}, boosting throughput by {metric1}% and reducing infra spend by {metric2}%.",
            "Directed a team of {team_size} engineers to deliver a high-traffic {proj_name} platform, generating ${revenue}M+ in annual recurring revenue (ARR).",
            "Spearheaded the implementation of automated QA and CI/CD pipelines, decreasing release cycle times from {months} weeks to under {metric2} hours."
        ]
    },
    "Non-Technical": {
        "Fresher": [
            "Led a student-run marketing campaign for {proj_name}, increasing social media engagement by {metric1}% and attracting {metric2}+ attendees.",
            "Coordinated a charity event involving {team_size} volunteers, raising over ${revenue} in funding and establishing partnerships with {metric2}+ local businesses.",
            "Prepared financial statements and analyzed budgets for university projects, identifying cost savings of {metric1}% across various departments."
        ],
        "Junior": [
            "Managed customer accounts for {proj_name}, resulting in a {metric1}% retention rate increase and resolving {metric2}+ support tickets monthly.",
            "Executed email marketing campaigns that improved click-through rates by {metric1}% and generated {metric2}+ qualified sales leads.",
            "Analyzed daily financial transactions and managed ledger entries using {skills}, reducing reconciliation discrepancies by {metric1}%."
        ],
        "Mid": [
            "Spearheaded recruitment campaigns that successfully hired {team_size}+ professionals, reducing average time-to-hire by {metric1}% and saving agency fees.",
            "Designed and implemented operational processes for {proj_name}, enhancing workflow efficiency by {metric1}% and reducing manual overhead by {metric2}%.",
            "Negotiated vendor contracts, securing {metric1}% cost reductions and improving supply chain delivery timelines by {metric2}%."
        ],
        "Senior": [
            "Formulated and executed market entry strategies that grew market share by {metric1}% and secured ${revenue}M in new B2B sales pipelines.",
            "Oversaw a department budget of ${revenue}k, optimizing resource allocation to achieve a {metric1}% reduction in operational expenses year-over-year.",
            "Directed cross-functional teams of {team_size}+ members on complex projects, delivering all milestones on schedule and increasing customer satisfaction (CSAT) by {metric2}%."
        ]
    }
}

PROJECT_NAMES = [
    "Enterprise Cloud Suite", "Smart Inventory Tracker", "Omnichannel Retail Platform",
    "Automated Billing Engine", "Customer Sentiment Pipeline", "Microservices Auth Gateway",
    "Predictive Maintenance API", "Collaborative Workspace App", "HR Onboarding Portal",
    "Healthcare Patient Dashboard"
]

def generate_random_gpa():
    return f"{random.uniform(3.0, 4.0):.2f}"

def get_role_category(role):
    tech_roles = [
        "Software Engineer", "Frontend Developer", "Backend Developer", "Data Analyst", 
        "Data Scientist", "UI/UX Designer", "DevOps Engineer", "QA Engineer", 
        "Mobile Developer", "Machine Learning Engineer", "Cloud Architect", 
        "Cybersecurity Analyst", "Mechanical Engineer", "Civil Engineer", "Electrical Engineer"
    ]
    return "Technical" if role in tech_roles else "Non-Technical"

def generate_candidate_info(role, level):
    is_vietnamese = random.choice([True, False])
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    fullName = f"{first_name} {last_name}"
    
    email_domain = random.choice(["gmail.com", "outlook.com", "yahoo.com", "corp.com"])
    email = f"{first_name.lower()}.{last_name.lower()}@{email_domain}"
    
    phone = f"+{random.choice(['84', '1'])} {random.randint(100, 999)} {random.randint(1000, 9999)}"
    currentLocation = random.choice(LOCATIONS)
    
    # Skills
    role_skills = SKILLS_POOL.get(role, ["Leadership", "Communication"])
    num_skills = random.randint(4, min(7, len(role_skills)))
    skills_list = random.sample(role_skills, num_skills)
    skills = ", ".join(skills_list)
    
    # Hobbies
    hobbies = random.choice(HOBBIES_POOL)
    
    # Certifications
    certs = CERTIFICATIONS_POOL.get(role, ["None"])
    certifications = random.choice(certs) if random.random() > 0.3 else "Not updated"
    
    # Education
    uni = random.choice(UNIVERSITIES)
    edu_cat = "Technical" if get_role_category(role) == "Technical" else "Business"
    if role in ["Lawyer", "Teacher", "Nurse", "Pharmacist"]:
        edu_cat = "General"
    major = random.choice(DEGREES[edu_cat])
    grad_year = random.randint(2010, 2025)
    gpa = generate_random_gpa()
    education = f"{major} - {uni} (GPA: {gpa}, Graduated: {grad_year})"
    
    # Experience Level Details
    if level == "Fresher":
        years = 0
    elif level == "Junior":
        years = random.randint(1, 3)
    elif level == "Mid":
        years = random.randint(3, 5)
    else:
        years = random.randint(5, 12)
        
    experience_str = ""
    if years > 0:
        num_jobs = 1 if years <= 3 else random.randint(2, 3)
        job_list = []
        remaining_years = years
        for i in range(num_jobs):
            job_years = remaining_years if i == num_jobs - 1 else random.randint(1, max(1, remaining_years - 1))
            remaining_years -= job_years
            company = random.choice(COMPANIES)
            job_role = role
            job_list.append(f"{job_role} at {company} ({job_years} years)")
        experience_str = " | ".join(job_list)
    else:
        experience_str = "No professional experience yet, completed university projects."
        
    return {
        "fullName": fullName,
        "email": email,
        "phone": phone,
        "role": role,
        "education": education,
        "experience": experience_str,
        "skills": skills,
        "certifications": certifications,
        "hobbies": hobbies,
        "currentLocation": currentLocation,
        "years": years
    }

def generate_rewrite(candidate_info, role, level):
    # Formulate Objective
    role_category = get_role_category(role)
    years = candidate_info["years"]
    skills_sample = ", ".join(candidate_info["skills"].split(", ")[:3])
    
    obj_templates = OBJECTIVE_TEMPLATES[level]
    obj = random.choice(obj_templates).format(role=role, skills=skills_sample, years=years)
    
    # Formulate Experience Bullets
    bullets_pool = EXPERIENCE_BULLETS[role_category][level]
    bullets_needed = 3 if level in ["Mid", "Senior"] else 2
    bullets_chosen = random.sample(bullets_pool, bullets_needed)
    
    formatted_bullets = []
    for bullet_tmpl in bullets_chosen:
        proj = random.choice(PROJECT_NAMES)
        skills_sample = random.choice(candidate_info["skills"].split(", "))
        metric1 = random.choice([15, 25, 30, 45, 60, 85])
        metric2 = random.choice([2, 5, 10, 20, 50, 100, 500])
        team = random.choice([3, 5, 8, 12])
        months = random.choice([3, 6, 9, 12])
        revenue = random.choice([10, 50, 100, 250, 500])
        num_features = random.choice([3, 5, 8, 12, 15])
        
        bullet = bullet_tmpl.format(
            proj_name=proj,
            skills=skills_sample,
            metric1=metric1,
            metric2=metric2,
            team_size=team,
            months=months,
            revenue=revenue,
            num_features=num_features
        )
        formatted_bullets.append(bullet)
        
    experience_bullets = "\n".join([f"- {b}" for b in formatted_bullets])
    
    # Construct output JSON
    output_json = {
        "objective": obj,
        "experience": experience_bullets,
        "education": candidate_info["education"],
        "skills": candidate_info["skills"],
        "certifications": candidate_info["certifications"],
        "hobbies": candidate_info["hobbies"]
    }
    
    return output_json

def generate_dataset():
    samples = []
    
    # Let's ensure balanced distribution of levels and roles
    # 1000 total samples
    # 1000 / 4 levels = 250 per level
    # 1000 / 34 roles = ~29.4 samples per role
    
    role_distribution = {role: 0 for role in ROLES}
    level_distribution = {lvl: 0 for lvl in LEVELS}
    
    for i in range(1000):
        # Determine level and role
        level = LEVELS[i % 4]
        role = ROLES[i % len(ROLES)]
        
        candidate_info = generate_candidate_info(role, level)
        output_json = generate_rewrite(candidate_info, role, level)
        
        role_distribution[role] += 1
        level_distribution[level] += 1
        
        # User input prompt format
        user_input_fields = [
            f"Full name: {candidate_info['fullName']}",
            f"Email: {candidate_info['email']}",
            f"Phone: {candidate_info['phone']}",
            f"Location: {candidate_info['currentLocation']}",
            f"Target role: {candidate_info['role']}",
            f"Education: {candidate_info['education']}",
            f"Raw experience: {candidate_info['experience']}",
            f"Skills: {candidate_info['skills']}",
            f"Certifications: {candidate_info['certifications']}",
            f"Hobbies: {candidate_info['hobbies']}"
        ]
        
        # Sometimes omit hobbies, certifications or phone to simulate missing fields
        if random.random() < 0.15:
            user_input_fields.remove(f"Hobbies: {candidate_info['hobbies']}")
        if random.random() < 0.15:
            user_input_fields.remove(f"Certifications: {candidate_info['certifications']}")
        if random.random() < 0.1:
            user_input_fields.remove(f"Phone: {candidate_info['phone']}")
            
        random.shuffle(user_input_fields)
        user_prompt = "\n".join(user_input_fields)
        
        full_text = (
            "<|system|>You are a professional CV writer. Return only valid JSON with these fields: "
            "objective, experience, education, skills, certifications, hobbies.<|end|>\n"
            f"<|user|>\n{user_prompt}<|end|>\n"
            f"<|assistant|>\n{json.dumps(output_json)}</s>"
        )
        
        samples.append({"text": full_text})
        
    # Write to JSONL
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s) + "\n")

    with open(PRETRAIN_CORPUS_FILE, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(s["text"])
            f.write("\n\n")
            
    print("Dataset generation completed!")
    print(f"Total samples saved: {len(samples)} to {OUTPUT_FILE}")
    print(f"Pretrain corpus saved to: {PRETRAIN_CORPUS_FILE}")
    print("\n--- Level Distribution ---")
    for lvl, count in level_distribution.items():
        print(f"  {lvl}: {count}")
    print("\n--- Role Distribution (top 5 & bottom 5) ---")
    sorted_roles = sorted(role_distribution.items(), key=lambda x: x[1], reverse=True)
    print("Top 5:")
    for role, count in sorted_roles[:5]:
        print(f"  {role}: {count}")
    print("Bottom 5:")
    for role, count in sorted_roles[-5:]:
        print(f"  {role}: {count}")

if __name__ == "__main__":
    generate_dataset()
