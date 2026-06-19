import re

def parse_line_options(text):
    # Regex to find option markers: e.g., (a), (A), a., A., a), A)
    # Allow letters from A-Z and a-z, and digits 1-9
    # Ensure they are preceded by start of string or whitespace to avoid matching middle of words
    pattern = r'(?:^|\s+)(?:\(([a-zA-Z0-9])\)|([a-zA-Z0-9])[\.\)])\s+'
    matches = list(re.finditer(pattern, text))
    
    if len(matches) <= 1:
        # Just a normal single option line or no options
        return None
        
    options = []
    for idx, match in enumerate(matches):
        start_idx = match.end()
        end_idx = matches[idx+1].start() if idx+1 < len(matches) else len(text)
        opt_text = text[start_idx:end_idx].strip()
        opt_letter = match.group(1) or match.group(2)
        options.append((opt_letter.upper(), opt_text))
    return options

test_cases = [
    "(a) Only I (b) Either I only or II only (c) Only II and III (d) Only I and either II or III",
    "A. Option 1  B. Option 2  C. Option 3  D. Option 4",
    "A) Yes  B) No  C) Maybe",
    "(1) Apple (2) Banana (3) Orange",
    "This is a normal line with some text like (a) inside parenthetical but not starting with it."
]

for tc in test_cases:
    print(f"\nInput: {repr(tc)}")
    opts = parse_line_options(tc)
    if opts:
        print("Parsed inline options:")
        for letter, val in opts:
            print(f"  {letter}: {repr(val)}")
    else:
        print("Not inline options line.")
