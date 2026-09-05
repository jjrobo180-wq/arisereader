#!/usr/bin/env python3
"""Fix the distribution of correct answers across A, B, C, D."""

import json
import random

random.seed(42)  # For reproducibility

with open("/home/user/workspace/bookquiz/quizzes_batch_3.json", "r") as f:
    quizzes = json.load(f)

# For each question, we need to shuffle the options so the correct answer
# is distributed across A, B, C, D
# Strategy: for each book, assign a pattern of correct answers
# that distributes evenly across A, B, C, D

patterns = [
    ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B"],
    ["B", "C", "D", "A", "B", "C", "D", "A", "B", "C"],
    ["C", "D", "A", "B", "C", "D", "A", "B", "C", "D"],
    ["D", "A", "B", "C", "D", "A", "B", "C", "D", "A"],
    ["A", "C", "B", "D", "A", "C", "B", "D", "A", "C"],
    ["B", "D", "C", "A", "B", "D", "C", "A", "B", "D"],
    ["C", "A", "D", "B", "C", "A", "D", "B", "C", "A"],
    ["D", "B", "A", "C", "D", "B", "A", "C", "D", "B"],
]

for book_idx, book in enumerate(quizzes):
    pattern = patterns[book_idx % len(patterns)]
    
    for q_idx, question in enumerate(book["questions"]):
        target_correct = pattern[q_idx]
        
        # Current correct answer is always "A" (index 0)
        correct_option = question["options"][0]
        wrong_options = question["options"][1:]
        
        # Shuffle the wrong options
        random.shuffle(wrong_options)
        
        # Place the correct answer at the target position
        new_options = []
        correct_placed = False
        wrong_idx = 0
        
        for letter_idx in range(4):
            if letter_idx == ord(target_correct) - ord('A'):
                new_options.append(correct_option)
                correct_placed = True
            else:
                new_options.append(wrong_options[wrong_idx])
                wrong_idx += 1
        
        question["options"] = new_options
        question["correct"] = target_correct

# Verify distribution
from collections import Counter
for i, book in enumerate(quizzes):
    answers = [q["correct"] for q in book["questions"]]
    dist = Counter(answers)
    for letter in ["A", "B", "C", "D"]:
        if dist[letter] < 2:
            print(f"WARNING: Book {i+1} ({book['title']}) has only {dist[letter]} answers for {letter}")

# Print distribution summary
print("\nDistribution summary:")
for i, book in enumerate(quizzes):
    answers = [q["correct"] for q in book["questions"]]
    dist = Counter(answers)
    print(f"Book {i+1} ({book['title']}): A={dist['A']}, B={dist['B']}, C={dist['C']}, D={dist['D']}")

# Save
with open("/home/user/workspace/bookquiz/quizzes_batch_3.json", "w") as f:
    json.dump(quizzes, f, indent=2)

print("\nSaved updated quizzes to /home/user/workspace/bookquiz/quizzes_batch_3.json")
print(f"Total books: {len(quizzes)}")
print(f"Total questions: {sum(len(b['questions']) for b in quizzes)}")
