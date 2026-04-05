"""Add pre-search to context_loader: search catalog for query terms,
return ONLY matching parts instead of the entire catalog."""
path = "/root/.hermes/hermes-agent/gateway/context_loader.py"
with open(path, "r") as f:
    code = f.read()

# Add a search function before load_catalog_context
search_func = '''
def search_catalog_parts(equipo, query, max_results=50):
    """Search JSON catalog for parts matching query terms.
    Returns a focused list of matching parts instead of the full catalog.
    """
    model_key = _get_model_key(equipo)
    if not model_key:
        return ""

    catalog_file = MODEL_TO_CATALOG.get(model_key)
    if not catalog_file:
        return ""

    catalog_path = os.path.join(JSON_CATALOG_DIR, catalog_file)
    if not os.path.exists(catalog_path):
        return ""

    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return ""

    # Build search terms from query
    terms = [t.lower() for t in query.replace("-", " ").split() if len(t) >= 3]

    # Bilingual expansion
    expansions = {
        "arranque": ["starter", "starting", "arranque"],
        "alternador": ["alternator", "alternador"],
        "motor": ["motor", "engine"],
        "freno": ["brake", "freno"],
        "hidraulico": ["hydraulic", "hidraulico"],
        "filtro": ["filter", "filtro"],
        "aceite": ["oil", "aceite"],
        "bomba": ["pump", "bomba"],
        "transmision": ["transmission", "transmision"],
        "direccion": ["steering", "direccion"],
        "correa": ["belt", "correa"],
        "turbo": ["turbo", "turbocharger"],
        "refrigerante": ["coolant", "refrigerante"],
        "valvula": ["valve", "valvula"],
        "cilindro": ["cylinder", "cilindro"],
        "sello": ["seal", "sello"],
        "manguera": ["hose", "manguera"],
        "starter": ["starter", "starting", "arranque"],
        "alternator": ["alternator", "alternador"],
        "hydraulic": ["hydraulic", "hidraulico"],
        "filter": ["filter", "filtro"],
        "pump": ["pump", "bomba"],
        "brake": ["brake", "freno"],
    }

    expanded = set(terms)
    for t in terms:
        for key, vals in expansions.items():
            if key in t or t in vals:
                expanded.update(vals)
    terms = list(expanded)

    matches = []

    if "parts" in data and isinstance(data["parts"], list):
        # CAT/Mack format
        for p in data["parts"]:
            desc = p.get("description", "").lower()
            sys_name = p.get("system", "").lower()
            score = sum(1 for t in terms if t in desc or t in sys_name)
            if score > 0:
                matches.append((score, p["part_number"], p["description"], p.get("system", "")))
    else:
        # Komatsu/Doosan format
        for section, items in data.items():
            if not isinstance(items, dict):
                continue
            section_lower = section.lower()
            for pn, desc in items.items():
                desc_lower = str(desc).lower()
                score = sum(1 for t in terms if t in desc_lower or t in section_lower)
                if score > 0:
                    matches.append((score, pn, desc, section))

    # Sort by relevance, take top results
    matches.sort(key=lambda x: -x[0])
    matches = matches[:max_results]

    if not matches:
        return ""

    lines = ["PARTES ENCONTRADAS EN CATALOGO (USAR ESTOS NUMEROS EXACTOS):"]
    for score, pn, desc, section in matches:
        lines.append(f"  P/N {pn}: {desc} [{section}]")

    return "\\n".join(lines)

'''

# Insert before load_catalog_context
code = code.replace(
    "def load_catalog_context(",
    search_func + "def load_catalog_context("
)

with open(path, "w") as f:
    f.write(code)
print("Added search_catalog_parts function")
