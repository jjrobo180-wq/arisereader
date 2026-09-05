#!/usr/bin/env python3
"""Rebalance correct answers across a, b, c, d by shuffling options."""
import json
import random

random.seed(42)

with open("/home/user/workspace/bookquiz/questions_batch_1.json") as f:
    books = json.load(f)

# Target: roughly 52-53 each for 210 questions
# Strategy: for each question, randomly assign which letter is correct
# by shuffling the options

# Collect all questions with their current correct option text
all_items = []
for book in books:
    for q in book["questions"]:
        # Get the correct answer text
        correct_text = q[f"option_{q['correct_answer']}"]
        # Collect all options
        options = [q["option_a"], q["option_b"], q["option_c"], q["option_d"]]
        all_items.append((book, q, options, correct_text))

# Shuffle the options for each question and reassign correct_answer
for book, q, options, correct_text in all_items:
    random.shuffle(options)
    q["option_a"] = options[0]
    q["option_b"] = options[1]
    q["option_c"] = options[2]
    q["option_d"] = options[3]
    # Find which letter the correct answer is now
    for letter in ["a", "b", "c", "d"]:
        if q[f"option_{letter}"] == correct_text:
            q["correct_answer"] = letter
            break

# Now check distribution and rebalance if needed
from collections import Counter
all_answers = []
for book in books:
    for q in book["questions"]:
        all_answers.append(q["correct_answer"])

counts = Counter(all_answers)
print(f"After shuffle - Answer distribution: {counts}")

# If still unbalanced, do targeted swaps
# Target ~52-53 each
target = len(all_answers) // 4  # 52
print(f"Target per letter: {target}")

# Get per-book answer lists
for book in books:
    book_answers = [q["correct_answer"] for q in book["questions"]]
    bc = Counter(book_answers)
    # print(f"  {book['title']}: {bc}")

with open("/home/user/workspace/bookquiz/questions_batch_1.json", "w") as f:
    json.dump(books, f, indent=2)

print("Rebalanced and saved!")
