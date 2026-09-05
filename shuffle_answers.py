#!/usr/bin/env python3
"""Shuffle answer options to balance correct_answer distribution across a,b,c,d."""
import json
import random

random.seed(42)

with open("/home/user/workspace/bookquiz/questions_batch_4.json") as f:
    books = json.load(f)

for book in books:
    for q in book["questions"]:
        options = [
            ("a", q["option_a"]),
            ("b", q["option_b"]),
            ("c", q["option_c"]),
            ("d", q["option_d"]),
        ]
        correct_text = q[f"option_{q['correct_answer']}"]
        
        # Shuffle the options
        random.shuffle(options)
        
        # Reassign
        letters = ["a", "b", "c", "d"]
        for i, (letter, text) in enumerate(options):
            q[f"option_{letters[i]}"] = text
            if text == correct_text:
                q["correct_answer"] = letters[i]

# Verify
for book in books:
    answers = [q["correct_answer"] for q in book["questions"]]
    print(f"{book['title']}: a={answers.count('a')}, b={answers.count('b')}, c={answers.count('c')}, d={answers.count('d')}")

with open("/home/user/workspace/bookquiz/questions_batch_4.json", "w") as f:
    json.dump(books, f, indent=2)

print("\nDone! Questions written with balanced answer distribution.")
