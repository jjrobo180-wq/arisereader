#!/usr/bin/env python3
"""Rebalance answer distribution across all questions."""

import json
import random

random.seed(42)

with open("/home/user/workspace/bookquiz/questions_batch_3.json", "r") as f:
    data = json.load(f)

# Collect all questions
all_questions = []
for book in data:
    for q in book["questions"]:
        all_questions.append((book["title"], q))

# Current distribution
dist = {"a": 0, "b": 0, "c": 0, "d": 0}
for _, q in all_questions:
    dist[q["correct_answer"]] += 1
print(f"Before: {dist}")

# Target: ~52-53 per letter
target = len(all_questions) // 4  # 52
print(f"Target per letter: {target}")

# For each question, we can swap the correct answer option with another option
# We'll track which questions need to change from which letter to which letter

# Flatten questions with their current correct answers
q_states = []
for title, q in all_questions:
    q_states.append({
        "title": title,
        "question": q,
        "current": q["correct_answer"],
        "options": {
            "a": q["option_a"],
            "b": q["option_b"],
            "c": q["option_c"],
            "d": q["option_d"],
        }
    })

# Calculate how many to move from each letter to each letter
# Current: a=81, b=91, c=24, d=14
# Target: ~52-53 each
# Need to move: a: -29, b: -39, c: +28-29, d: +38-39

# Strategy: for each question whose correct answer is 'a' or 'b',
# randomly swap the correct option text with a 'c' or 'd' option,
# then update correct_answer

# Determine how many 'a' questions to convert to 'c' and 'd'
a_excess = dist["a"] - target  # 29
b_excess = dist["b"] - target  # 39
c_deficit = target - dist["c"]  # 28
d_deficit = target - dist["d"]  # 38

print(f"Excess: a={a_excess}, b={b_excess}")
print(f"Deficit: c={c_deficit}, d={d_deficit}")

# Assign conversions
# From a: some to c, some to d
a_to_c = min(a_excess, c_deficit)
c_deficit -= a_to_c
a_excess -= a_to_c
a_to_d = min(a_excess, d_deficit)
d_deficit -= a_to_d
a_excess -= a_to_d

# From b: some to c, some to d
b_to_c = min(b_excess, c_deficit)
c_deficit -= b_to_c
b_excess -= b_to_c
b_to_d = min(b_excess, d_deficit)
d_deficit -= b_to_d
b_excess -= b_to_d

print(f"Conversions: a->c={a_to_c}, a->d={a_to_d}, b->c={b_to_c}, b->d={b_to_d}")

# Now apply conversions
# Get indices of questions with correct_answer 'a' and 'b'
a_indices = [i for i, qs in enumerate(q_states) if qs["current"] == "a"]
b_indices = [i for i, qs in enumerate(q_states) if qs["current"] == "b"]

random.shuffle(a_indices)
random.shuffle(b_indices)

# Function to swap correct option text with target option, update correct_answer
def swap_answer(qs, target_letter):
    current_letter = qs["current"]
    if current_letter == target_letter:
        return
    # Swap the text of the correct option with the target option
    qs["options"][current_letter], qs["options"][target_letter] = \
        qs["options"][target_letter], qs["options"][current_letter]
    qs["current"] = target_letter

# Apply a->c conversions
for i in range(a_to_c):
    swap_answer(q_states[a_indices[i]], "c")
# Apply a->d conversions
for i in range(a_to_d):
    swap_answer(q_states[a_indices[a_to_c + i]], "d")
# Apply b->c conversions
for i in range(b_to_c):
    swap_answer(q_states[b_indices[i]], "c")
# Apply b->d conversions
for i in range(b_to_d):
    swap_answer(q_states[b_indices[b_to_c + i]], "d")

# Now rebuild the questions
for qs in q_states:
    q = qs["question"]
    q["option_a"] = qs["options"]["a"]
    q["option_b"] = qs["options"]["b"]
    q["option_c"] = qs["options"]["c"]
    q["option_d"] = qs["options"]["d"]
    q["correct_answer"] = qs["current"]

# Rebuild data structure
for book in data:
    for q in book["questions"]:
        pass  # Already updated in place since q_states references same objects

# Verify new distribution
new_dist = {"a": 0, "b": 0, "c": 0, "d": 0}
for _, q in all_questions:
    new_dist[q["correct_answer"]] += 1
print(f"After: {new_dist}")

# Verify all questions still have valid structure
for book in data:
    assert len(book["questions"]) == 10, f"Book '{book['title']}' has wrong number of questions"
    for i, q in enumerate(book["questions"]):
        assert q["question_order"] == i + 1
        assert q["correct_answer"] in ["a", "b", "c", "d"]
        # Verify the correct answer text is actually in the correct option
        correct_text = q[f"option_{q['correct_answer']}"]
        assert len(correct_text) > 0

# Write back
with open("/home/user/workspace/bookquiz/questions_batch_3.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"\nSuccessfully rebalanced and wrote {len(data)} books with 10 questions each")
