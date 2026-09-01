# -*- coding: utf-8 -*-
"""Stamps a running footer and page numbers onto the rendered playbook PDF."""

import io
import os

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "Pet-Affiliate-90-Day-Playbook.pdf")
OUT = os.path.join(HERE, "Pet-Affiliate-90-Day-Playbook-final.pdf")

MM = 72 / 25.4
LEFT = "Pet Affiliate Playbook  ·  India  ·  Dogs & Cats"
GREY = HexColor("#9aa9b4")
ACCENT = HexColor("#0f6f66")


def overlay(page_no, total):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, _ = A4
    y = 8.5 * MM
    c.setStrokeColor(HexColor("#e6ecef"))
    c.setLineWidth(0.4)
    c.line(14 * MM, y + 3.6 * MM, w - 14 * MM, y + 3.6 * MM)
    c.setFont("Helvetica", 6.6)
    c.setFillColor(GREY)
    c.drawString(14 * MM, y, LEFT)
    c.setFont("Helvetica-Bold", 6.8)
    c.setFillColor(ACCENT)
    c.drawRightString(w - 14 * MM, y, f"{page_no}  /  {total}")
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def main():
    reader = PdfReader(SRC)
    total = len(reader.pages)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i > 0:  # no footer on the cover
            page.merge_page(overlay(i + 1, total))
        writer.add_page(page)
    writer.add_metadata({
        "/Title": "Pet Affiliate Playbook — 90-Day Launch Plan, Category Master List & Research Brief",
        "/Subject": "India · Dogs & Cats · Affiliate marketing content plan and category research",
        "/Keywords": "pet affiliate marketing, India, dogs, cats, 90 day content plan, product categories",
        "/Creator": "Pet Affiliate Playbook builder",
    })
    with open(OUT, "wb") as f:
        writer.write(f)
    print(f"stamped {total} pages -> {OUT} ({os.path.getsize(OUT)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
