"""Fix diagram find to search by part number → section → page."""
path = "/root/.hermes/hermes-agent/gateway/api_server.py"
with open(path, "r") as f:
    code = f.read()

# Replace the _find_diagram_page function
old = '''def _find_diagram_page(equipo: str, search_term: str) -> tuple:
    """Find the diagram PDF and page number for a part/section search."""
    equipo_upper = equipo.upper() if equipo else ""

    pdf_name = None
    index_name = None
    for key, (pdf, idx) in DIAGRAM_MAP.items():
        if key.upper() in equipo_upper:
            pdf_name = pdf
            index_name = idx
            break

    if not pdf_name or not index_name:
        return None, None, None

    index_path = INDEX_DIR / index_name
    if not index_path.exists():
        return pdf_name, None, None

    with open(index_path, "r") as f:
        index_data = _json.load(f)

    # Search index for matching section
    search_lower = search_term.lower()
    best_match = None
    best_score = 0

    for section_name, page_num in index_data.items():
        section_lower = section_name.lower()
        score = 0
        for word in search_lower.split():
            if len(word) >= 3 and word in section_lower:
                score += 1
        if score > best_score:
            best_score = score
            best_match = (section_name, page_num)

    if best_match:
        return pdf_name, best_match[1], best_match[0]
    return pdf_name, None, None'''

new = '''def _find_diagram_page(equipo: str, search_term: str) -> tuple:
    """Find the diagram PDF and page number.
    Searches by: 1) part number in catalog → section → page, 2) section name match."""
    equipo_upper = equipo.upper() if equipo else ""

    pdf_name = None
    index_name = None
    for key, (pdf, idx) in DIAGRAM_MAP.items():
        if key.upper() in equipo_upper:
            pdf_name = pdf
            index_name = idx
            break

    if not pdf_name or not index_name:
        return None, None, None

    index_path = INDEX_DIR / index_name
    if not index_path.exists():
        return pdf_name, None, None

    with open(index_path, "r") as f:
        index_data = _json.load(f)

    # Strategy 1: If search_term looks like a part number, find its section in the catalog
    import re as _re
    if _re.match(r"[A-Z0-9]{2,}-", search_term) or _re.match(r"\\d{5,}", search_term):
        # Search catalog for this part number to find its section
        catalog_dir = Path("/root/.hermes/references/maintenance")
        for cat_file in catalog_dir.glob("*_parts_catalog.json"):
            try:
                with open(cat_file, "r") as f:
                    cat_data = _json.load(f)
                if "parts" in cat_data and isinstance(cat_data["parts"], list):
                    for p in cat_data["parts"]:
                        if p.get("part_number") == search_term:
                            system = p.get("system", "")
                            # Search index for this system
                            for sec, pg in index_data.items():
                                if system.lower() in sec.lower() or sec.lower() in system.lower():
                                    return pdf_name, pg, sec
                else:
                    for section, items in cat_data.items():
                        if isinstance(items, dict) and search_term in items:
                            # Found the part — now find section in diagram index
                            sec_lower = section.lower()
                            for idx_sec, pg in index_data.items():
                                idx_lower = idx_sec.lower()
                                # Match key words from section name
                                words = [w for w in sec_lower.replace(",", " ").split() if len(w) >= 4]
                                matches = sum(1 for w in words if w in idx_lower)
                                if matches >= 2:
                                    return pdf_name, pg, idx_sec
            except Exception:
                pass

    # Strategy 2: Direct section name search
    search_lower = search_term.lower()
    # Bilingual expansion
    expansions = {
        "inyector": "injector", "alternador": "alternator", "arranque": "starting",
        "bomba": "pump", "filtro": "filter", "freno": "brake", "correa": "belt",
        "radiador": "radiator", "turbo": "turbo", "motor": "engine",
        "hidraulico": "hydraulic", "transmision": "transmission",
    }
    expanded = search_lower
    for es, en in expansions.items():
        expanded = expanded.replace(es, en)

    best_match = None
    best_score = 0
    for section_name, page_num in index_data.items():
        section_lower = section_name.lower()
        score = 0
        for word in expanded.split():
            if len(word) >= 3 and word in section_lower:
                score += 1
        if score > best_score:
            best_score = score
            best_match = (section_name, page_num)

    if best_match:
        return pdf_name, best_match[1], best_match[0]
    return pdf_name, None, None'''

code = code.replace(old, new)

with open(path, "w") as f:
    f.write(code)
print("Fixed diagram find with part number lookup")
