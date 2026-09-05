#!/usr/bin/env python3
"""Targeted rebalancing: swap options in questions to even out distribution."""
import json
from collections import Counter

with open("/home/user/workspace/bookquiz/questions_batch_1.json") as f:
    books = json.load(f)

# Current distribution
all_answers = []
for book in books:
    for q in book["questions"]:
        all_answers.append(q["correct_answer"])

counts = Counter(all_answers)
print(f"Before targeted rebalance: {counts}")

target = len(all_answers) // 4  # 52
# We need to move some from 'a' to 'b'
# 'a' has 63, 'b' has 43 -- need to move ~10 from a to b
# For each question where correct_answer is 'a', swap option_a and option_b

swaps_needed = (counts['a'] - counts['b']) // 2  # ~10
print(f"Need {swaps_needed} swaps from a->b")

swapped = 0
for book in books:
    for q in book["questions"]:
        if swapped >= swaps_needed:
            break
        if q["correct_answer"] == "a":
            # Swap option_a and option_b
            q["option_a"], q["option_b"] = q["option_b"], q["option_a"]
            q["correct_answer"] = "b"
            swapped += 1
    if swapped >= swaps_needed:
        break

# Check again
all_answers = []
for book in books:
    for q in book["questions"]:
        all_answers.append(q["correct_answer"])

counts = Counter(all_answers)
print(f"After targeted rebalance: {counts}")

# Now check per-book distribution
for book in books:
    book_answers = [q["correct_answer"] for q in book["questions"]]
    bc = Counter(book_answers)
    print(f"  {book['title'][:40]}: {dict(bc)}")

with open("/home/user/workspace/bookquiz/questions_batch_1.json", "w") as f:
    json.dump(books, f, indent=2)

print("Saved!")
