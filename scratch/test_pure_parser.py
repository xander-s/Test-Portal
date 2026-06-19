import re
from typing import List, Dict, Any

def parse_line_options(text):
    # Match inline option markers like (a), (A), a., A., a), A)
    # Allow letters from A-F / a-f, and digits 1-9
    pattern = r'(?:^|\s+)(?:\(([a-fA-F0-9])\)|([a-fA-F])[\.\)])\s+'
    matches = list(re.finditer(pattern, text))
    
    if len(matches) <= 1:
        return None
        
    options = []
    for idx, match in enumerate(matches):
        start_idx = match.end()
        end_idx = matches[idx+1].start() if idx+1 < len(matches) else len(text)
        opt_text = text[start_idx:end_idx].strip()
        opt_letter = match.group(1) or match.group(2)
        options.append((opt_letter.upper(), opt_text))
    return options

def determine_question_type(q: Dict[str, Any]) -> str:
    options = q.get("options", [])
    correct_answer = q.get("correct_answer", "").strip()
    
    # 1. TrueOrFalse (true_false)
    if len(options) == 2:
        opt_texts = {o["option_text"].strip().lower() for o in options}
        if opt_texts == {"true", "false"} or opt_texts == {"yes", "no"}:
            return "true_false"
    if correct_answer.lower() in ("true", "false", "yes", "no") and len(options) <= 2:
        return "true_false"
        
    # 2. MCQMultiple (mcq_multi)
    correct_count = sum(1 for o in options if o.get("is_correct"))
    if correct_count > 1:
        return "mcq_multi"
    if len(options) > 1 and correct_answer:
        letters_found = [l.upper() for l in re.findall(r'\b([A-Za-z0-9])\b', correct_answer)]
        if len(letters_found) > 1:
            valid_letters = [chr(65 + i) for i in range(len(options))]
            if all(l in valid_letters for l in letters_found):
                return "mcq_multi"

    # 3. FillInTheBlanks (fill_blank)
    if not options:
        if correct_answer.lower() in ("true", "false", "yes", "no"):
            return "true_false"
        return "fill_blank"
        
    # 4. MCQSingle (mcq_single)
    return "mcq_single"

def parse_raw_text_to_questions(lines: List[str]) -> List[Dict[str, Any]]:
    questions = []
    current_q = None
    
    for line in lines:
        text = line.strip()
        if not text:
            continue
            
        q_match = re.match(r'^(?:Q|Question)\s*[:\.\-]?\s*(.*)', text, re.IGNORECASE)
        num_match = re.match(r'^(\d+)[\.\)]\s+(.*)', text)
        
        # Check if the line has multiple options written horizontally
        inline_opts = parse_line_options(text)
        if inline_opts and current_q:
            for opt_letter, opt_text in inline_opts:
                current_q["options"].append({
                    "option_text": opt_text,
                    "is_correct": False
                })
            continue
            
        # Support options A-F and digits (only inside parentheses for digits)
        opt_match = re.match(r'^([A-Fa-f])[\.\)]\s*(.*)', text) or re.match(r'^\(([A-Fa-f0-9])\)\s*(.*)', text)
        ans_match = re.match(r'^(?:Correct\s*Option|Correct\s*Answer|Ans|Answer|Key)\s*[:\.\-]?\s*(.*)', text, re.IGNORECASE)
        exp_match = re.match(r'^(?:Exp|Explanation)\s*[:\.\-]?\s*(.*)', text, re.IGNORECASE)
        
        if q_match:
            if current_q:
                questions.append(current_q)
            current_q = {
                "question_text": q_match.group(1).strip(),
                "options": [],
                "correct_answer": "",
                "explanation": "",
                "difficulty": "Medium",
                "type": "mcq_single"
            }
        elif num_match and not opt_match:
            if current_q:
                questions.append(current_q)
            current_q = {
                "question_text": num_match.group(2).strip(),
                "options": [],
                "correct_answer": "",
                "explanation": "",
                "difficulty": "Medium",
                "type": "mcq_single"
            }
        elif opt_match and current_q:
            opt_letter = opt_match.group(1).upper()
            opt_text = opt_match.group(2).strip()
            current_q["options"].append({
                "option_text": opt_text,
                "is_correct": False
            })
        elif ans_match and current_q:
            current_q["correct_answer"] = ans_match.group(1).strip()
        elif exp_match and current_q:
            current_q["explanation"] = exp_match.group(1).strip()
        elif current_q:
            # Append multi-line content
            if not current_q["options"]:
                current_q["question_text"] += "\n" + text
            elif current_q["explanation"]:
                current_q["explanation"] += "\n" + text
            elif current_q["options"]:
                current_q["options"][-1]["option_text"] += "\n" + text

    if current_q:
        questions.append(current_q)
        
    # Post-process correct answer match & determine question type
    for q in questions:
        if q["options"] and q["correct_answer"]:
            ans_str = q["correct_answer"].strip().upper()
            letters_found = [l.upper() for l in re.findall(r'\b([A-Za-z0-9])\b', ans_str)]
            
            letters = [chr(65 + i) for i in range(len(q["options"]))]
            matched_indices = []
            
            for idx, opt in enumerate(q["options"]):
                opt_letter = letters[idx]
                if opt_letter in letters_found or opt["option_text"].upper() == ans_str:
                    matched_indices.append(idx)
                    
            if matched_indices:
                for idx in matched_indices:
                    q["options"][idx]["is_correct"] = True
                
                # Re-save correct answer text representation
                q["correct_answer"] = ", ".join(q["options"][idx]["option_text"] for idx in matched_indices)
        
        # Classify the type of question
        q["type"] = determine_question_type(q)
                
    return questions

test_lines = """
19. Four subjects - Physics, Chemistry, Mathematics and Biology - were taught in four consecutive periods of one hour each starting from 8.00 a.m. At what time was the Chemistry period scheduled? 
Statements: 
I. Mathematics period ended at 10.00 a.m., which was preceded by Biology. 
II. Physics was scheduled in the last period. 
III. Mathematics period was immediately followed by Chemistry. 
(a) Only I 
(b) Either I only or II only 
(c) Only II and III 
(d) Only I and either II or III
Correct Option : D

20. Who is the tallest among six boys P, T, N, D, Q and R? 
Statements: 
I. P is taller than D and N but not-as tall as T. 
II. R is taller than Q but not as tall as T. 
III. Q is not taller than T and R. 
(a) Only I and II 
(b) Only II and III 
(c) Only I and III 
(d) All I, II and III
Correct Option : A

21. Python is an interpreted programming language.
A) True
B) False
Correct Answer: A

22. Fill in the blank: The keyword used to define a function in Python is ________.
Correct Answer: def

23. Which of the following are programming languages?
(a) Python (b) HTML (c) C++ (d) CSS
Correct Option : A and C
""".strip().split("\n")

questions = parse_raw_text_to_questions(test_lines)
print(f"Parsed {len(questions)} questions.")
for idx, q in enumerate(questions):
    print(f"\n--- Question {idx+1} ---")
    print("Text:", repr(q["question_text"]))
    print("Type:", q["type"])
    print("Options:")
    for o in q["options"]:
        print(f"  {o['option_text']} (Correct: {o['is_correct']})")
    print("Correct Answer:", q["correct_answer"])
