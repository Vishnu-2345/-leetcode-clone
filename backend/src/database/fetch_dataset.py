import urllib.request
import json
import os
import re

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'leetcode_dataset.json')

def slug_to_title(slug: str) -> str:
    return ' '.join(word.capitalize() for word in slug.split('-'))

def clean_description(text: str) -> str:
    if not text:
        return ""
    # Remove non-breaking spaces and artifact characters
    text = text.replace('\ufffd', ' ').replace('\xa0', ' ')
    # Normalize excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def parse_examples_and_constraints(description: str):
    examples = []
    constraints = ""

    # Try extracting constraints
    parts = re.split(r'Constraints?:', description, flags=re.IGNORECASE)
    if len(parts) > 1:
        constraints = parts[1].split('Follow-up:')[0].strip()
        body = parts[0]
    else:
        body = description

    # Extract examples if pattern matches Example X:
    example_blocks = re.findall(r'Example \d+:(.*?)(?=(?:Example \d+:|$))', body, flags=re.DOTALL | re.IGNORECASE)
    for block in example_blocks:
        inp_match = re.search(r'Input:\s*(.+?)(?=\nOutput:|\nExplanation:|$)', block, re.DOTALL | re.IGNORECASE)
        out_match = re.search(r'Output:\s*(.+?)(?=\nExplanation:|$)', block, re.DOTALL | re.IGNORECASE)
        exp_match = re.search(r'Explanation:\s*(.+?)$', block, re.DOTALL | re.IGNORECASE)

        if inp_match and out_match:
            examples.append({
                'input': inp_match.group(1).strip(),
                'output': out_match.group(1).strip(),
                'explanation': exp_match.group(1).strip() if exp_match else None
            })

    return examples, constraints

def fetch_leetcode_dataset(target_count: int = 50):
    os.makedirs(DATA_DIR, exist_ok=True)
    all_problems = []
    offset = 0

    print(f"Fetching {target_count} real LeetCode problems from Hugging Face...")

    while len(all_problems) < target_count:
        url = f"https://datasets-server.huggingface.co/rows?dataset=newfacade%2FLeetCodeDataset&config=default&split=train&offset={offset}&limit=100"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                rows = data.get('rows', [])
                if not rows:
                    break

                for item in rows:
                    row = item.get('row', {})
                    slug = row.get('task_id', '').strip()
                    if not slug:
                        continue

                    raw_desc = clean_description(row.get('problem_description', ''))
                    examples, constraints = parse_examples_and_constraints(raw_desc)
                    raw_io = row.get('input_output', [])

                    # Format test cases: first 3 are public, remaining are hidden
                    formatted_test_cases = []
                    for idx, tc in enumerate(raw_io):
                        inp = str(tc.get('input', '')).strip()
                        out = str(tc.get('output', '')).strip()
                        if not inp or not out:
                            continue
                        formatted_test_cases.append({
                            'input': inp,
                            'expectedOutput': out,
                            'isHidden': idx >= 3,
                            'orderIndex': idx
                        })

                    if not formatted_test_cases:
                        continue

                    diff = row.get('difficulty', 'Medium')
                    if diff.lower() == 'easy':
                        difficulty = 'Easy'
                    elif diff.lower() == 'hard':
                        difficulty = 'Hard'
                    else:
                        difficulty = 'Medium'

                    all_problems.append({
                        'title': slug_to_title(slug),
                        'slug': slug,
                        'description': raw_desc,
                        'difficulty': difficulty,
                        'constraints': constraints,
                        'examples': examples,
                        'tags': row.get('tags', []),
                        'entryPoint': row.get('entry_point', ''),
                        'starterCode': row.get('starter_code', ''),
                        'testCases': formatted_test_cases
                    })

                    print(f"[{len(all_problems)}/{target_count}] Processed {slug} ({len(formatted_test_cases)} test cases)")

                    if len(all_problems) >= target_count:
                        break

                offset += len(rows)

        except Exception as e:
            print(f"Error fetching batch at offset {offset}: {e}")
            break

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_problems, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully saved {len(all_problems)} problems to {OUTPUT_FILE}!")

if __name__ == '__main__':
    fetch_leetcode_dataset(50)

