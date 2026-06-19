import sys

def print_file_lines(file_path, start_line, num_lines):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx in range(start_line - 1, min(start_line - 1 + num_lines, len(lines))):
        print(f"{idx + 1}: {lines[idx].rstrip()}")

if __name__ == '__main__':
    if len(sys.argv) == 4:
        print_file_lines(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))
