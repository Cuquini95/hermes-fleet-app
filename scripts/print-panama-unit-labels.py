"""Print unit labels that open a scoped Hermes field report.

Run with ReportLab installed: python3 scripts/print-panama-unit-labels.py labels.pdf DZ203 EX401
Use the equipment codes from the authorized Panama inventory.
To print pilot labels, pass --base-url with the assigned HTTPS pilot origin.
"""
import argparse
import re
from urllib.parse import urlencode, urlsplit

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas


PRODUCTION_ORIGIN = "https://hermes-panama.vercel.app"


def https_origin(value):
    try:
        url = urlsplit(value)
        port = url.port
    except ValueError:
        raise argparse.ArgumentTypeError("Introduce un origen HTTPS válido.") from None
    if (
        url.scheme != "https" or not url.hostname or port == 0
        or url.username is not None or url.path not in ("", "/") or url.query or url.fragment
        or re.search(r"[\s\\]", value)
    ):
        raise argparse.ArgumentTypeError("Introduce un origen HTTPS sin ruta, credenciales ni parámetros.")
    return f"https://{url.netloc.lower().removesuffix(':443')}"


def render_label(canvas, x, y, unit, origin):
    url = origin + "/falla?" + urlencode({"unit": unit})
    size = 104
    qr = QrCodeWidget(url, barWidth=size, barHeight=size)
    drawing = Drawing(size, size)
    drawing.add(qr)
    canvas.roundRect(x, y, 168, 150, 8, stroke=1, fill=0)
    renderPDF.draw(drawing, canvas, x + 32, y + 34)
    font = "Helvetica-Bold"
    unit_font_size = min(14, 152 / canvas.stringWidth(unit, font, 1))
    canvas.setFont(font, unit_font_size)
    canvas.drawCentredString(x + 84, y + 20, unit)
    canvas.setFont("Helvetica", 8)
    subtitle = "Reportar falla" if origin == PRODUCTION_ORIGIN else "Piloto - Reportar falla"
    canvas.drawCentredString(x + 84, y + 8, f"Hermes Panama - {subtitle}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", help="Path for the print-ready PDF")
    parser.add_argument("units", nargs="+", help="Authorized Panama equipment codes")
    parser.add_argument("--base-url", type=https_origin, default=PRODUCTION_ORIGIN, help="HTTPS origin for pilot labels")
    args = parser.parse_args()
    units = dict.fromkeys(value.strip().upper() for value in args.units)
    if any(not re.fullmatch(r"[A-Z][A-Z0-9-]{1,19}", unit) for unit in units):
        parser.error("Los códigos deben tener entre 2 y 20 letras, dígitos o guiones.")
    with open(args.output, "xb") as output:
        canvas = Canvas(output, pagesize=A4)
        canvas.setTitle("Hermes Panama - Etiquetas de equipos")
        for index, unit in enumerate(units):
            slot = index % 15
            if index and slot == 0:
                canvas.showPage()
            render_label(canvas, 32 + 180 * (slot % 3), 649 - 157 * (slot // 3), unit, args.base_url)
        canvas.save()


if __name__ == "__main__":
    main()
