import sys

with open("server/routes.ts", "r") as f:
    content = f.read()

# Find the prompt block within generateEyeGazeQuizWithAI
# It starts after the levelDescriptions object closes with "};"
# and the prompt starts with "    const prompt = `You are an expert quiz creator for eye gaze"
# and ends before "    const res = await fetch(PERPLEXITY_API_URL"

search_start = "    const prompt = `You are an expert quiz creator for eye gaze"
search_end = "    const res = await fetch(PERPLEXITY_API_URL, {"

idx_start = content.find(search_start)
if idx_start == -1:
    print("ERROR: Could not find prompt start")
    sys.exit(1)

idx_end = content.find(search_end, idx_start)
if idx_end == -1:
    print("ERROR: Could not find prompt end")
    sys.exit(1)

old_block = content[idx_start:idx_end]

# Read the new code from file
with open("/tmp/new_prompt_code.txt", "r") as f:
    new_code = f.read()

content = content[:idx_start] + new_code + "\n\n" + content[idx_end:]

with open("server/routes.ts", "w") as f:
    f.write(content)

print(f"SUCCESS: Replaced {len(old_block)} chars with {len(new_code)} chars")
