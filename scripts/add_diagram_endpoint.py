"""Add diagram page image endpoint to VPS API server."""
path = "/root/.hermes/hermes-agent/gateway/api_server.py"
with open(path, "r") as f:
    code = f.read()

endpoint_code = '''

# ─── Diagram Page Image Endpoint ─────────────────────────────────────────────

import json as _json
from pathlib import Path

DIAGRAM_DIR = Path("/root/.hermes/references/maintenance/diagrams")
INDEX_DIR = DIAGRAM_DIR / "indexes"

# Map equipment model keywords to diagram PDF + index
DIAGRAM_MAP = {
    "D155": ("D155AX6_Diagramas.pdf", "d155_index.json"),
    "D65": ("D155AX6_Diagramas.pdf", "d155_index.json"),  # Uses D155 diagrams as fallback
    "HM400": ("HM400-3_Diagramas.pdf", "hm400_index.json"),
    "CAT": ("D155AX6_Diagramas.pdf", "d155_index.json"),  # No CAT diagram PDF yet
    "740": ("D155AX6_Diagramas.pdf", "d155_index.json"),
    "DX225": ("DX225LCA_Diagramas.pdf", "dx225_index.json"),
    "DX340": ("DX340LC_Diagramas.pdf", "dx340_index.json"),
    "DX360": ("DX340LC_Diagramas.pdf", "dx340_index.json"),  # Uses DX340 as fallback
    "DL420": ("DL420A_Diagramas.pdf", "d155_index.json"),
    "Mack": ("MACK_GR84B_Diagramas.pdf", "mack_index.json"),
    "GR84": ("MACK_GR84B_Diagramas.pdf", "mack_index.json"),
}


def _find_diagram_page(equipo: str, search_term: str) -> tuple:
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
    return pdf_name, None, None


@app.get("/diagrams/page/{pdf_name}/{page_num}")
async def get_diagram_page_image(pdf_name: str, page_num: int):
    """Render a specific page from a diagram PDF as a JPEG image."""
    import pypdfium2

    pdf_path = DIAGRAM_DIR / pdf_name
    if not pdf_path.exists():
        raise HTTPException(404, f"PDF not found: {pdf_name}")

    try:
        pdf = pypdfium2.PdfDocument(str(pdf_path))
        if page_num < 0 or page_num >= len(pdf):
            raise HTTPException(400, f"Page {page_num} out of range (0-{len(pdf)-1})")

        page = pdf[page_num]
        bitmap = page.render(scale=2)  # 2x for good quality
        pil_image = bitmap.to_pil()

        import io
        buf = io.BytesIO()
        pil_image.save(buf, format="JPEG", quality=85)
        buf.seek(0)

        from starlette.responses import StreamingResponse
        return StreamingResponse(buf, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(500, f"Error rendering page: {e}")


@app.get("/diagrams/find")
async def find_diagram(equipo: str = "", search: str = ""):
    """Find the diagram page for a part or section search."""
    pdf_name, page_num, section_name = _find_diagram_page(equipo, search)

    if pdf_name and page_num is not None:
        return {
            "found": True,
            "pdf": pdf_name,
            "page": page_num,
            "section": section_name,
            "image_url": f"/diagrams/page/{pdf_name}/{page_num}",
        }
    elif pdf_name:
        return {
            "found": False,
            "pdf": pdf_name,
            "message": f"PDF found but no matching section for '{search}'",
        }
    else:
        return {
            "found": False,
            "message": f"No diagram available for '{equipo}'",
        }
'''

code += endpoint_code

with open(path, "w") as f:
    f.write(code)
print("Added diagram page image endpoint")
