import re
from typing import List, Dict, Any

def parse_line_options(text):
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
    if len(options) == 2:
        opt_texts = {o["option_text"].strip().lower() for o in options}
        if opt_texts == {"true", "false"} or opt_texts == {"yes", "no"}:
            return "true_false"
    if correct_answer.lower() in ("true", "false", "yes", "no") and len(options) <= 2:
        return "true_false"
    correct_count = sum(1 for o in options if o.get("is_correct"))
    if correct_count > 1:
        return "mcq_multi"
    if len(options) > 1 and correct_answer:
        letters_found = [l.upper() for l in re.findall(r'\b([A-Za-z0-9])\b', correct_answer)]
        if len(letters_found) > 1:
            valid_letters = [chr(65 + i) for i in range(len(options))]
            if all(l in valid_letters for l in letters_found):
                return "mcq_multi"
    if not options:
        if correct_answer.lower() in ("true", "false", "yes", "no"):
            return "true_false"
        return "fill_blank"
    return "mcq_single"

def is_roman_numeral_line(text: str) -> bool:
    return bool(re.match(r'^(?:[IVX]+)[\.\)]\s+(.*)', text, re.IGNORECASE))

def parse_raw_text_to_questions(lines: List[str]) -> List[Dict[str, Any]]:
    questions = []
    current_q = None
    pending_context_lines = []
    
    for line in lines:
        text = line.strip()
        if not text:
            continue
            
        q_match = re.match(r'^(?:Q|Question)\s*[:\.\-]?\s*(.*)', text, re.IGNORECASE)
        num_match = re.match(r'^(\d+)[\.\)]\s+(.*)', text)
        
        inline_opts = parse_line_options(text)
        if inline_opts and current_q:
            for opt_letter, opt_text in inline_opts:
                current_q["options"].append({
                    "option_text": opt_text,
                    "is_correct": False
                })
            continue
            
        opt_match = re.match(r'^([A-Fa-f])[\.\)]\s*(.*)', text) or re.match(r'^\(([A-Fa-f0-9])\)\s*(.*)', text)
        ans_match = re.match(r'^(?:Correct\s*Option|Correct\s*Answer|Ans|Answer|Key)\s*[:\.\-]?\s*(.*)', text, re.IGNORECASE)
        exp_match = re.match(r'^(?:Exp|Explanation)\s*[:\.\-]?\s*(.*)', text, re.IGNORECASE)
        
        if q_match:
            if current_q:
                questions.append(current_q)
            q_text = q_match.group(1).strip()
            if pending_context_lines:
                q_text = "\n".join(pending_context_lines) + "\n" + q_text
                pending_context_lines = []
            current_q = {
                "question_text": q_text,
                "options": [],
                "correct_answer": "",
                "explanation": "",
                "difficulty": "Medium",
                "type": "mcq_single"
            }
        elif num_match and not opt_match:
            if current_q:
                questions.append(current_q)
            q_text = num_match.group(2).strip()
            if pending_context_lines:
                q_text = "\n".join(pending_context_lines) + "\n" + q_text
                pending_context_lines = []
            current_q = {
                "question_text": q_text,
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
            # If the current question already has a correct answer, and this line doesn't match any pattern,
            # it means we are past the correct answer. If we have an explanation, it could be multi-line explanation.
            # Otherwise, it must be a passage/context for the next question!
            if current_q["correct_answer"] and not current_q["explanation"]:
                questions.append(current_q)
                current_q = None
                pending_context_lines.append(text)
            elif current_q["explanation"]:
                current_q["explanation"] += "\n" + text
            elif not current_q["options"]:
                current_q["question_text"] += "\n" + text
            elif current_q["options"]:
                current_q["options"][-1]["option_text"] += "\n" + text
        else:
            pending_context_lines.append(text)

    if current_q:
        questions.append(current_q)
        
    # Post-process correct answer match & determine question type
    for q in questions:
        # Heuristic: Extract options from the bottom of the question text lines
        if not q["options"] and q["correct_answer"] and q["question_text"]:
            ans_str = q["correct_answer"].strip().upper()
            if len(ans_str) == 1 and 'A' <= ans_str <= 'F':
                q_lines = q["question_text"].split("\n")
                collected_opts = []
                for line_idx in range(len(q_lines) - 1, -1, -1):
                    line_text = q_lines[line_idx].strip()
                    if not line_text:
                        continue
                    if is_roman_numeral_line(line_text) or line_text.lower().startswith("statements:"):
                        break
                    collected_opts.append(line_text)
                    if len(collected_opts) >= 6:
                        break
                
                required_count = ord(ans_str) - ord('A') + 1
                if len(collected_opts) >= required_count and len(collected_opts) >= 2:
                    collected_opts.reverse()
                    q["options"] = [{"option_text": opt, "is_correct": False} for opt in collected_opts]
                    remaining_lines = q_lines[:-len(collected_opts)]
                    q["question_text"] = "\n".join(remaining_lines).strip()
        
        # Match correct options
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
                q["correct_answer"] = ", ".join(q["options"][idx]["option_text"] for idx in matched_indices)
        
        # Classify the type of question
        q["type"] = determine_question_type(q)
                
    return questions

test_lines = """
28) Statements:
B > M >= C = D; D < A = R; P < M <= G = H
Conclusions:
I. D <= G
II. H > B
III. M = A
A. Only conclusion I is true
B. Only conclusion II is true
C. Both conclusions I and II are true
D. Both conclusions II and III are true
E. None is true
Correct Option : A
Study the following information carefully and answer the below questions
A family of three generations consists of eight members and three married couples. P is the only daughter of the one who is the mother-in- law of S. Q is the only daughter of S who is the daughter-in-law of U. U is the father-in-law of N who is the brother-in-law of R. V is the maternal grandmother of O who is the same gender of R.
29) How N is related to V?
a) Brother-in-law
b) Son-in-law
c) Son
d) Brother
e) Uncle
Correct Option : B
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
