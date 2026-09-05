import json
import requests
import time

SUPABASE_URL = "https://swsyalnajzizfwazqwpd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3c3lhbG5hanppemZ3YXpxd3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDgxOTIsImV4cCI6MjEwMzg4NDE5Mn0.WuxYK3_V-OcgNUSqFOF_OjvyYW_V6xkD73JkFcuMKV8"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# Load question batches
all_questions = {}
for i in range(1, 6):
    with open(f"questions_batch_{i}.json") as f:
        data = json.load(f)
        for book in data:
            all_questions[book["title"]] = book["questions"]

# Load book list
with open("new_books.json") as f:
    books = json.load(f)

# Get current max book ID
r = requests.get(f"{SUPABASE_URL}/rest/v1/books?select=id&order=id.desc&limit=1", headers=HEADERS)
existing = r.json()
next_id = (existing[0]["id"] + 1) if existing else 1
print(f"Starting at book ID: {next_id}")

success_count = 0
fail_count = 0

for idx, book in enumerate(books):
    title = book["title"]
    author = book["author"]
    points = book["points_value"]
    desc = book["description"]
    questions = all_questions.get(title, [])
    
    if not questions:
        print(f"  SKIP: No questions for '{title}'")
        fail_count += 1
        continue
    
    # Insert book
    book_payload = {
        "id": next_id,
        "title": title,
        "author": author,
        "age_group": "Middle Grade" if points <= 20 else "Young Adult",
        "description": desc,
        "points_value": points,
        "cover_url": None,
        "read_url": None,
    }
    
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/books",
        headers={**HEADERS, "Prefer": "return=representation"},
        json=book_payload,
    )
    
    if not r.ok:
        print(f"  FAIL book: {title} - {r.text[:200]}")
        fail_count += 1
        continue
    
    created = r.json()
    book_id = created[0]["id"] if isinstance(created, list) else created["id"]
    
    # Insert questions
    q_payload = []
    for q in questions:
        q_payload.append({
            "book_id": book_id,
            "question_text": q["question_text"],
            "option_a": q["option_a"],
            "option_b": q["option_b"],
            "option_c": q["option_c"],
            "option_d": q["option_d"],
            "correct_answer": q["correct_answer"],
            "question_order": q["question_order"],
        })
    
    r2 = requests.post(
        f"{SUPABASE_URL}/rest/v1/questions",
        headers=HEADERS,
        json=q_payload,
    )
    
    if r2.ok:
        success_count += 1
        if (idx + 1) % 10 == 0:
            print(f"  Progress: {idx+1}/{len(books)} books inserted ({success_count} ok, {fail_count} failed)")
    else:
        print(f"  FAIL questions for: {title} - {r2.text[:200]}")
        fail_count += 1
    
    next_id += 1

print(f"\nDone! {success_count} books inserted, {fail_count} failed")
print(f"Total questions inserted: {success_count * 10}")
