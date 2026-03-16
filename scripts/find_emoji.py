import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find lines in AdminPanel region with \uXXXX as visible JSX string content
# These show as literal text like "\u2713" instead of ✓
suspect = []
for i, line in enumerate(lines, 1):
    if i < 5800 or i > 9500:
        continue
    stripped = line.strip()
    # Look for \uXXXX patterns inside JSX string literals or template literals
    # that would render as visible text (not CSS, not font props)
    if re.search(r'\\u[0-9A-Fa-f]{4}', stripped):
        if any(x in stripped for x in ['fontFamily', '@import', 'font-', 'content:', 'url(']):
            continue
        suspect.append((i, stripped[:150]))

print(f"Suspect lines: {len(suspect)}")
for ln, text in suspect[:80]:
    print(f"{ln}: {text}")
