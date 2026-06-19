import re

def print_section(start, count):
    with open('../frontend/src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx in range(start - 1, min(start - 1 + count, len(lines))):
        print(f"{idx + 1}: {lines[idx].rstrip()}")

if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3:
        print_section(int(sys.argv[1]), int(sys.argv[2]))
