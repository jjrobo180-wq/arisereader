import re

with open("server/routes.ts", "r") as f:
    content = f.read()

# Step 1: Update function signature
old_sig = "async function generateEyeGazeQuizWithAI(topic: string, description?: string, sourceLink?: string, level: number = 1, questionCount: number = 5, exactMode: boolean = false, allPics: boolean = true):"
new_sig = "async function generateEyeGazeQuizWithAI(topic: string, description?: string, sourceLink?: string, level: number = 1, questionCount: number = 5, exactMode: boolean = false, allPics: boolean = true, customQuestions?: string):"
if old_sig in content:
    content = content.replace(old_sig, new_sig)
    print("1. Signature updated")
else:
    print("1. ERROR: signature not found")

# Step 2: Find the prompt block and replace it
marker_start = "    const prompt = `You are an expert"
idx_start = content.find(marker_start)
if idx_start == -1:
    print("2. ERROR: prompt start not found")
else:
    # Find the end: the closing backtick-semicolon after "Return exactly"
    search_area = content[idx_start:]
    end_pattern = "Return exactly ${questionCount} questions"
    end_idx = search_area.find(end_pattern)
    if end_idx == -1:
        print("2. ERROR: end pattern not found")
    else:
        closing_idx = search_area.find("`;", end_idx)
        if closing_idx == -1:
            print("2. ERROR: closing backtick not found")
        else:
            old_prompt = search_area[:closing_idx + 2]
            print(f"2. Old prompt length: {len(old_prompt)} chars")
            
            # Write the new code to a separate file
            with open("/tmp/new_prompt_code.txt", "r") as nf:
                new_code = nf.read()
            
            content = content[:idx_start] + new_code + content[idx_start + len(old_prompt):]
            print("2. SUCCESS: prompt replaced")

# Step 3: Update the endpoint to pass customQuestions
old_endpoint = "      const result = await generateEyeGazeQuizWithAI(topic.trim(), description, sourceLink, quizLevel, quizCount, useExactMode, useAllPics);"
new_endpoint = "      const result = await generateEyeGazeQuizWithAI(topic.trim(), description, sourceLink, quizLevel, quizCount, useExactMode, useAllPics, exactMode ? req.body.customQuestions : undefined);"
if old_endpoint in content:
    content = content.replace(old_endpoint, new_endpoint)
    print("3. Endpoint updated")
else:
    print("3. ERROR: endpoint call not found")

with open("server/routes.ts", "w") as f:
    f.write(content)

print("Done!")
