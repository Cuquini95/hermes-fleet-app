
# ─── Workshop manual page endpoints ──────────────────────────────────────────

WORKSHOP_PDF_DIR = "/root/.hermes/references/workshop_pdf"

_WORKSHOP_PDF_MAP = {
    "HM400": "HM400-3_workshop.pdf",
    "D155":  "D155AX6_workshop.pdf",
    "D65":   "D65EX16_workshop.pdf",
    "DX225": "DX225LCA_workshop.pdf",
    "DX340": "DX340LC_workshop.pdf",
    "DX360": "DX360LC_workshop.pdf",
    "DL420": "DL420_workshop.pdf",
    "CAT":   "CAT740_maintenance.pdf",
    "740":   "CAT740_maintenance.pdf",
}


@app.get("/diagrams/workshop-page/{pdf_name}/{page_num}")
async def get_workshop_page_image(pdf_name: str, page_num: int):
    """Render a page from a workshop manual PDF as JPEG (1-indexed)."""
    import pypdfium2, io
    from starlette.responses import StreamingResponse
    pdf_path = os.path.join(WORKSHOP_PDF_DIR, pdf_name)
    if not os.path.exists(pdf_path):
        raise HTTPException(404, "Workshop PDF not found: " + pdf_name)
    try:
        pdf = pypdfium2.PdfDocument(str(pdf_path))
        total = len(pdf)
        if page_num < 1 or page_num > total:
            raise HTTPException(400, "Page " + str(page_num) + " out of range (1-" + str(total) + ")")
        page = pdf[page_num - 1]
        bitmap = page.render(scale=1.5)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="JPEG", quality=82)
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, "Error rendering page: " + str(e))


@app.get("/ai/fault_code_pages")
async def fault_code_pages(equipo: str, codigo_falla: str):
    """Return the workshop manual page numbers for a given fault code."""
    import re as _re
    from gateway.context_loader import search_fault_code_in_workshop, _get_model_key
    excerpt = search_fault_code_in_workshop(equipo, codigo_falla)
    if not excerpt:
        return {"found": False, "message": "Codigo " + codigo_falla + " no encontrado en manuales disponibles"}
    m = _re.search(r"--- Page (\d+) ---", excerpt)
    if not m:
        return {"found": False, "message": "Pagina no determinada en el manual"}
    page = int(m.group(1))
    mk = _get_model_key(equipo)
    if not mk:
        for k in _WORKSHOP_PDF_MAP:
            if k.upper() in equipo.upper():
                mk = k
                break
    pdf = _WORKSHOP_PDF_MAP.get(mk, "") if mk else ""
    if not pdf:
        return {"found": False, "message": "Manual no disponible para: " + equipo}
    full_path = os.path.join(WORKSHOP_PDF_DIR, pdf)
    if not os.path.exists(full_path):
        return {"found": False, "message": "Archivo " + pdf + " no encontrado en servidor"}
    return {
        "found": True,
        "pdf": pdf,
        "page_start": page,
        "page_end": page + 1,
        "codigo": codigo_falla,
    }
