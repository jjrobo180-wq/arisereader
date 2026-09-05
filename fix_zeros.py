#!/usr/bin/env python3
"""Fix books where one answer letter has 0 correct answers by swapping options."""
import json

with open("/home/user/workspace/bookquiz/questions_batch_4.json") as f:
    books = json.load(f)

def get_counts(book):
    answers = [q["correct_answer"] for q in book["questions"]]
    return {l: answers.count(l) for l in "abcd"}

def swap_option_letter(q, target_letter):
    """Swap the correct answer to target_letter by swapping option positions."""
    current = q["correct_answer"]
    if current == target_letter:
        return
    # Swap the text of current correct option with target_letter option
    correct_text = q[f"option_{current}"]
    target_text = q[f"option_{target_letter}"]
    q[f"option_{current}"] = target_text
    q[f"option_{target_letter}"] = correct_text
    q["correct_answer"] = target_letter

for book in books:
    counts = get_counts(book)
    zero_letters = [l for l in "abcd" if counts[l] == 0]
    for zl in zero_letters:
        # Find a question with the most-represented answer letter to swap
        max_letter = max(counts, key=lambda l: counts[l])
        # Find a question with that answer
        for q in book["questions"]:
            if q["correct_answer"] == max_letter and counts[max_letter] > 1:
                swap_option_letter(q, zl)
                counts[max_letter] -= 1
                counts[zl] += 1
                break

# Verify
for book in books:
    counts = get_counts(book)
    print(f"{book['title']}: a={counts['a']}, b={counts['b']}, c={counts['c']}, d={counts['d']}")

with open("/home/user/workspace/bookquiz/questions_batch_4.json", "w") as f:
    json.dump(books, f, indent=2)

print("\nDone! All books now have answers spread across a, b, c, d.")
