"""Print unit labels that open a scoped Hermes field report.

Run with ReportLab installed: python3 scripts/print-panama-unit-labels.py labels.pdf DZ203 EX401
Use the equipment codes from the authorized Panama inventory.
"""
import argparse
import re
from urllib.parse import urlencode

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas


def render_label(canvas, x, y, unit):
    url = "https://hermes-panama.vercel.app/falla?" + urlencode({"unit": unit})
    size = 104
    qr = QrCodeWidget(url, barWidth=size, barHeight=size)
    drawing = Drawing(size, size)
    drawing.add(qr)
    canvas.roundRect(x, y, 168, 150, 8, stroke=1, fill=0)
    renderPDF.draw(drawing, canvas, x + 32, y + 34)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawCentredString(x + 84, y + 20, unit)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(x + 84, y + 8, "Hermes Panama - Reportar falla")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", help="Path for the print-ready PDF")
    parser.add_argument("units", nargs="+", help="Authorized Panama equipment codes")
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
            render_label(canvas, 32 + 180 * (slot % 3), 649 - 157 * (slot // 3), unit)
        canvas.save()


if __name__ == "__main__":
    main()
