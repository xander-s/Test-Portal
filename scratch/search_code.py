import sys
import re

def search(filename, pattern):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    matches = re.finditer(pattern, content, re.IGNORECASE)
    lines = content.splitlines()
    for m in matches:
        # Find line number
        offset = m.start()
        line_no = content.count('\n', 0, offset) + 1
        print(f"Match found at line {line_no}:")
        print(f"  {lines[line_no-1].strip()}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python search_code.py <filename> <pattern>")
    else:
        search(sys.argv[1], sys.argv[2])
