"""Add part-number-to-page search in engine PDFs for diagram endpoint."""
path = "/root/.hermes/hermes-agent/gateway/api_server.py"
with open(path, "r") as f:
    code = f.read()

# Add ENGINE_PDF_MAP after DIAGRAM_MAP
old_marker = '''@app.get("/diagrams/page/{pdf_name}/{page_num}")'''
new_code = '''# Engine catalog PDFs (for engine component diagrams)
ENGINE_PDF_MAP = {
    "D155": "D155AX6_Engine.pdf",
    "D65": "D155AX6_Engine.pdf",  # Same engine family
    "HM400": "HM400-3_Engine.pdf",
    "Komatsu": "HM400-3_Engine.pdf",
}


def _search_pdf_for_part(pdf_name: str, part_number: str) -> int:
    """Search a PDF for a page containing the part number. Returns page index or -1."""
    import pypdfium2
    pdf_path = DIAGRAM_DIR / pdf_name
    if not pdf_path.exists():
        return -1
    try:
        pdf = pypdfium2.PdfDocument(str(pdf_path))
        for i in range(len(pdf)):
            text = pdf[i].get_textpage().get_text_range()
            if part_number in text:
                return i
    except Exception:
        pass
    return -1


@app.get("/diagrams/page/{pdf_name}/{page_num}")'''

code = code.replace(old_marker, new_code)

# Now update _find_diagram_page to use engine PDF search as fallback
# Add before "return pdf_name, None, None" at the end
old_end = '''    if best_match:
        return pdf_name, best_match[1], best_match[0]
    return pdf_name, None, None'''

new_end = '''    if best_match:
        return pdf_name, best_match[1], best_match[0]

    # Strategy 3: Search engine PDF for part number directly
    equipo_upper_2 = equipo.upper() if equipo else ""
    for key, engine_pdf in ENGINE_PDF_MAP.items():
        if key.upper() in equipo_upper_2:
            page_idx = _search_pdf_for_part(engine_pdf, search_term)
            if page_idx >= 0:
                return engine_pdf, page_idx, f"Engine diagram (page {page_idx + 1})"
            break

    return pdf_name, None, None'''

code = code.replace(old_end, new_end)

with open(path, "w") as f:
    f.write(code)
print("Added engine PDF part number search")
