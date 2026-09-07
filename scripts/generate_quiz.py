#!/usr/bin/env python3
"""Generate a 10-question quiz for a book using AI via pplx_sdk.

Usage: python3 generate_quiz.py "Book Title" "Author" "age_group"
Output: JSON on stdout: {"questions": [...]} or {"error": "..."}
"""
import sys
import json
import os

def to_dict(obj):
    """Convert an object to dict, handling ExtractedItem and other types."""
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, '__dict__'):
        d = {}
        for k in dir(obj):
            if not k.startswith('_'):
                try:
                    v = getattr(obj, k)
                    if not callable(v):
                        d[k] = v
                except:
                    pass
        return d
    return {}

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate_quiz.py <book_title> <author> [age_group]"}))
        sys.exit(1)

    book_title = sys.argv[1]
    author = sys.argv[2]
    age_group = sys.argv[3] if len(sys.argv) > 3 else "middle school"

    try:
        import pplx_sdk
    except ImportError:
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pplx-python-sdks-llm-api"], capture_output=True)
        try:
            import pplx_sdk
        except ImportError:
            print(json.dumps({"error": "pplx_sdk not available"}))
            sys.exit(1)

    # If env vars not set, try reading from .llm_env file (for local testing)
    if not os.environ.get('PPLX_SDK_API_KEY') and not os.environ.get('PPLX_LLM_API_KEY'):
        env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.llm_env')
        if os.path.exists(env_file):
            with open(env_file) as f:
                env_data = json.load(f)
            for k, v in env_data.items():
                os.environ[k] = v

    # First, search for information about the book
    context = ""
    try:
        results = pplx_sdk.search.web(f"{book_title} by {author} book summary plot characters themes")
        context = "\n".join([h.snippet for h in results[:5] if hasattr(h, 'snippet')])
    except Exception:
        pass

    # Use llm.extract to generate structured quiz questions
    try:
        result = pplx_sdk.llm.extract(
            items=[f"Book: {book_title} by {author}\n{context}" if context else f"Book: {book_title} by {author}"],
            instruction=f"Generate 10 multiple-choice reading comprehension questions about this book. Each question should have 4 options (A, B, C, D) and one correct answer. Focus on plot, characters, and themes. Make questions appropriate for {age_group} students. Do NOT ask about the author's life or publication details.",
            output_schema={
                "type": "object",
                "properties": {
                    "questions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "question": {"type": "string"},
                                "option_a": {"type": "string"},
                                "option_b": {"type": "string"},
                                "option_c": {"type": "string"},
                                "option_d": {"type": "string"},
                                "correct": {"type": "string", "enum": ["A", "B", "C", "D"]}
                            },
                            "required": ["question", "option_a", "option_b", "option_c", "option_d", "correct"]
                        }
                    }
                },
                "required": ["questions"]
            }
        )

        # result is a list of ExtractResult objects with a .result dict attribute
        extracted = {}
        if isinstance(result, list) and len(result) > 0:
            item = result[0]
            # ExtractResult has a .result attribute that's a dict
            if hasattr(item, 'result') and isinstance(item.result, dict):
                extracted = item.result
            elif isinstance(item, dict):
                extracted = item.get('result', item)
        elif isinstance(result, dict):
            extracted = result.get('result', result)

        questions_raw = extracted.get('questions', [])

        if not questions_raw or len(questions_raw) < 5:
            print(json.dumps({"error": "AI generated too few questions"}))
            sys.exit(1)

        # Convert to the format expected by the server
        valid = []
        for q in questions_raw[:10]:
            if isinstance(q, dict):
                valid.append({
                    "question": q.get("question", ""),
                    "options": [
                        q.get("option_a", ""),
                        q.get("option_b", ""),
                        q.get("option_c", ""),
                        q.get("option_d", ""),
                    ],
                    "correct": q.get("correct", "A").upper()[:1],
                })

        if len(valid) < 5:
            print(json.dumps({"error": "AI generated too few valid questions"}))
            sys.exit(1)

        print(json.dumps({"questions": valid}))

    except Exception as e:
        print(json.dumps({"error": f"AI generation failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
