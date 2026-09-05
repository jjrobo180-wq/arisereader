import json
import random

random.seed(42)

with open("/home/user/workspace/bookquiz/quizzes_batch_4.json", "r") as f:
    quizzes = json.load(f)

# For each question, shuffle the options and update the correct answer
for book in quizzes:
    for q in book["questions"]:
        options = q["options"]
        correct_idx = ord(q["correct"]) - ord("A")
        correct_text = options[correct_idx]
        
        # Shuffle the options
        indices = list(range(4))
        random.shuffle(indices)
        
        # Build new options list
        new_options = [options[i] for i in indices]
        
        # Find where the correct answer ended up
        new_correct_idx = indices.index(correct_idx)
        new_correct = chr(ord("A") + new_correct_idx)
        
        q["options"] = new_options
        q["correct"] = new_correct

# Verify all books have exactly 10 questions
for i, book in enumerate(quizzes):
    assert len(book["questions"]) == 10, f"Book {i+1} '{book['title']}' has {len(book['questions'])} questions, expected 10"

# Verify correct answer distribution
for i, book in enumerate(quizzes):
    answers = [q["correct"] for q in book["questions"]]
    print(f"Book {i+1}: {book['title']} - A:{answers.count('A')}, B:{answers.count('B')}, C:{answers.count('C')}, D:{answers.count('D')}")

print(f"\nTotal books: {len(quizzes)}")
print(f"Total questions: {sum(len(b['questions']) for b in quizzes)}")

# Save to file
with open("/home/user/workspace/bookquiz/quizzes_batch_4.json", "w") as f:
    json.dump(quizzes, f, indent=2)

print("\nSaved to /home/user/workspace/bookquiz/quizzes_batch_4.json")
