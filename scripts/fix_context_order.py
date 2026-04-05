"""Fix context_loader to put matched JSON parts FIRST, then extracted text."""
path = "/root/.hermes/hermes-agent/gateway/context_loader.py"
with open(path, "r") as f:
    code = f.read()

# Move JSON catalog BEFORE extracted text in the output
old = """    parts = []

    # 1. Search extracted PDF text for relevant pages
    txt_files = _find_files(equipo, EXTRACTED_DIR, ".txt")"""

new = """    parts = []

    # 1. FIRST: Load JSON catalog (structured, most reliable for part numbers)
    catalog_file = MODEL_TO_CATALOG.get(model_key)
    if catalog_file:
        catalog_path = os.path.join(JSON_CATALOG_DIR, catalog_file)
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                json_lines = _format_json_catalog(data, equipo)
                if json_lines:
                    parts.append("=== CATALOGO OFICIAL DE PARTES (FUENTE PRINCIPAL) ===\\n" + json_lines)
            except Exception:
                pass

    # 2. THEN: Load extracted PDF text (secondary, for additional context)
    txt_files = _find_files(equipo, EXTRACTED_DIR, ".txt")"""

code = code.replace(old, new)

# Remove the duplicate JSON loading that was after the extracted text
old2 = """    # 2. Also load extracted PDF text if available (adds diagrams, procedures)
    prefixes = MODEL_TO_EXTRACTED.get(model_key, [])
    remaining = max_chars - sum(len(p) for p in parts)

    if remaining > 50000:  # Only add if we have room
        for prefix in prefixes[:1]:  # Just the catalog extract, not workshop (save tokens)
            for txt_file in glob.glob(os.path.join(EXTRACTED_DIR, f"{prefix}*.txt")):
                try:
                    with open(txt_file, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    if len(content) > remaining:
                        content = content[:remaining]
                    parts.append(content)
                    remaining -= len(content)
                except Exception:
                    pass"""

new2 = """    # 2. Add extracted PDF text for additional context
    prefixes = MODEL_TO_EXTRACTED.get(model_key, [])
    remaining = max_chars - sum(len(p) for p in parts)

    if remaining > 50000:
        for prefix in prefixes[:1]:
            for txt_file in glob.glob(os.path.join(EXTRACTED_DIR, f"{prefix}*.txt")):
                try:
                    with open(txt_file, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    if len(content) > remaining:
                        content = content[:remaining]
                    parts.append(content)
                    remaining -= len(content)
                except Exception:
                    pass"""

code = code.replace(old2, new2)

# Remove the old JSON loading block that was inside the txt loop area
# (it was the original block that loaded JSON after extracted text)
old3 = """    # 1. Load FULL JSON catalog (the structured parts data)
    catalog_file = MODEL_TO_CATALOG.get(model_key)
    if catalog_file:
        catalog_path = os.path.join(JSON_CATALOG_DIR, catalog_file)
        if os.path.exists(catalog_path):"""

if old3 in code:
    # Find and remove the entire old JSON block
    idx = code.index(old3)
    # Find the next "# 2." marker
    next_marker = code.index("# 2.", idx)
    code = code[:idx] + code[next_marker:]

# Add the _format_json_catalog helper function
helper = '''
def _format_json_catalog(data, equipo):
    """Format JSON catalog with relevant systems first."""
    q_terms = [t.lower() for t in equipo.replace("-", " ").split() if len(t) >= 3]
    lines = []

    if "parts" in data and isinstance(data["parts"], list):
        by_system = {}
        for p in data["parts"]:
            sys_name = p.get("system", "GENERAL")
            if sys_name not in by_system:
                by_system[sys_name] = []
            by_system[sys_name].append(p)

        scored = []
        for sys_name, plist in by_system.items():
            score = 0
            for t in q_terms:
                if t in sys_name.lower():
                    score += 10
                for p in plist:
                    if t in p.get("description", "").lower():
                        score += 2
            scored.append((score, sys_name, plist))

        scored.sort(key=lambda x: -x[0])

        for score, sys_name, plist in scored:
            lines.append("\\n[" + sys_name + "]")
            for p in plist:
                pn = p["part_number"]
                desc = p["description"]
                lines.append("  " + pn + ": " + desc)
    else:
        for section, items in data.items():
            if isinstance(items, dict) and items:
                lines.append("\\n[" + section + "]")
                for pn, desc in items.items():
                    lines.append("  " + pn + ": " + desc)

    return "\\n".join(lines)

'''

# Insert helper before load_catalog_context
code = code.replace("def load_catalog_context(", helper + "def load_catalog_context(")

with open(path, "w") as f:
    f.write(code)
print("Fixed context ordering — JSON catalog first")
