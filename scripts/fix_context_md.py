"""Update context_loader to prioritize markdown lookup files."""
path = "/root/.hermes/hermes-agent/gateway/context_loader.py"
with open(path, "r") as f:
    code = f.read()

# Add MD lookup mapping after the MODEL_TO_EXTRACTED dict
old_marker = "def _get_model_key(equipo):"
new_mapping = '''# Verified markdown lookup files — these have confirmed OEM part numbers
# These are the same files the WhatsApp Hermes bot used
MODEL_TO_MD_LOOKUP = {
    "D155": ["D155AX6_PARTS_LOOKUP.md"],
    "D65": ["D65PX16_PARTS_LOOKUP.md", "D65PX16_PARTES_ES.md"],
    "HM400": ["HM400-3_PARTS_LOOKUP.md"],
    "CAT": ["CAT740B_PARTS_LOOKUP.md", "CAT740B_PARTES_ES.md"],
    "740": ["CAT740B_PARTS_LOOKUP.md", "CAT740B_PARTES_ES.md"],
    "DX225": ["DX225LCA_PARTS_LOOKUP.md"],
    "DX340": ["DX340LCA_PARTS_LOOKUP.md", "DX340LCA_PARTES_ES.md"],
    "DX360": ["DX360LCA_PARTS_LOOKUP.md", "DX360LCA_PARTES_ES.md"],
    "DL420": ["DL420_PARTS_LOOKUP.md"],
    "Mack": ["MACK_GR84B_PARTS_LOOKUP.md", "mack_gr84b_pm_v2.md"],
    "GR84": ["MACK_GR84B_PARTS_LOOKUP.md", "mack_gr84b_pm_v2.md"],
    "Doosan": ["DX340LCA_PARTS_LOOKUP.md"],
    "Komatsu": ["D155AX6_PARTS_LOOKUP.md"],
}

def _get_model_key(equipo):'''
code = code.replace(old_marker, new_mapping)

# Now update load_catalog_context to load MD files FIRST
old_load = '    parts = []'
new_load = '''    parts = []

    # PRIORITY 1: Load verified markdown lookup files (same data as WhatsApp bot)
    md_files = MODEL_TO_MD_LOOKUP.get(model_key, [])
    for md_name in md_files:
        md_path = os.path.join(JSON_CATALOG_DIR, md_name)
        if os.path.exists(md_path):
            try:
                with open(md_path, "r", encoding="utf-8") as f:
                    content = f.read()
                parts.append("=== " + md_name + " (REFERENCIA VERIFICADA) ===\\n" + content)
            except Exception:
                pass'''

# Only replace the first occurrence (in load_catalog_context)
idx = code.index(old_load)
code = code[:idx] + new_load + code[idx + len(old_load):]

with open(path, "w") as f:
    f.write(code)
print("Updated context loader to use MD lookup files first")
