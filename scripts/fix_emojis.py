import re

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

orig = len(content)

# Step 1: Replace surrogate pairs \uD800-\uDFFF first (before single-char replacements)
def replace_surrogate_pair(m):
    h = int(m.group(1), 16)  # high surrogate: D800-DBFF
    l = int(m.group(2), 16)  # low surrogate: DC00-DFFF
    cp = 0x10000 + (h - 0xD800) * 0x400 + (l - 0xDC00)
    return chr(cp)

# High surrogates: D800-DBFF, Low surrogates: DC00-DFFF
content, n_pairs = re.subn(
    r'\\u([Dd][89AaBb][0-9A-Fa-f]{2})\\u([Dd][CcDdEeFf][0-9A-Fa-f]{2})',
    replace_surrogate_pair, content
)
print(f"Surrogate pairs replaced: {n_pairs}")

# Step 2: Replace remaining single \uXXXX (non-surrogate BMP characters)
def replace_bmp(m):
    cp = int(m.group(1), 16)
    if 0xD800 <= cp <= 0xDFFF:
        return m.group(0)  # lone surrogate — leave as-is
    return chr(cp)

content, n_bmp = re.subn(r'\\u([0-9A-Fa-f]{4})', replace_bmp, content)
print(f"BMP escapes replaced: {n_bmp}")

# Sanity check: brace balance
opens = content.count('{')
closes = content.count('}')
print(f"Brace balance: {opens - closes}")

# Make sure GCSS block is intact
if "Russo One" in content and "Chakra Petch" in content:
    print("GCSS block intact")
else:
    print("WARNING: GCSS may be affected")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. Size change: {len(content) - orig:+d} chars (expected negative — escapes shorter than actual chars in some cases)")
print("Total replacements:", n_pairs + n_bmp)
