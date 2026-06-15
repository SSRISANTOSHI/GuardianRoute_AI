import os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io

# All PDFs in backend folder — auto-discovered, no manual listing needed
MAX_PAGES_PER_PDF = 6
MAX_CHARS_PER_PDF = 2500
MIN_TEXT_CHARS = 80  # below this threshold → treat page as scanned image

STATIC_CONTEXT = """
GuardianRoute AI — Core Safety Knowledge:
- Emergency: 112 | Police: 100 | Ambulance: 108 | Women Helpline: 181 | Railway Safety: 139
- One Stop Centres (OSCs): Govt-run crisis centers for women — provide shelter, medical, legal aid.
- ERSS (Emergency Response Support System): Single national 112 number integrates police, fire, ambulance.
- NERS: Nationwide Emergency Response System — dispatches nearest responder via GPS.
- Women Helpline 181: Free, 24x7, pan-India helpline for women in distress.
- Mission Shakti: GoI scheme for safety, security, and empowerment of women.
- Night travel safety: Use well-lit routes, share live location, stay near transport hubs.
- High safety score (80-100): Well-lit, crowded, near emergency services, good transport.
- Moderate score (60-79): Some isolation or limited transport; use caution.
- Low score (<60): Avoid if possible, especially at night.
- Safe Zones: Police stations, hospitals, railway/metro stations, OSCs, pharmacies.
"""


def _ocr_page(page) -> str:
    """Render a PDF page to image and OCR it with tesseract."""
    try:
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR accuracy
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
        return " ".join(text.split())
    except Exception:
        return ""


def extract_pdf_text(path: str, max_pages: int = MAX_PAGES_PER_PDF) -> str:
    """
    Extract text from a PDF.
    - For digital PDFs: uses PyMuPDF direct text extraction (fast).
    - For scanned/image PDFs: falls back to Tesseract OCR per page.
    """
    try:
        doc = fitz.open(path)
        pages_to_read = min(max_pages, doc.page_count)
        chunks = []
        for i in range(pages_to_read):
            page = doc[i]
            text = page.get_text().strip()
            if len(text) < MIN_TEXT_CHARS:
                # Scanned page — use OCR
                text = _ocr_page(page)
            if text:
                chunks.append(" ".join(text.split()))
        return " ".join(chunks)[:MAX_CHARS_PER_PDF]
    except Exception:
        return ""


def build_rag_context() -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    chunks = [STATIC_CONTEXT]

    pdf_files = sorted(f for f in os.listdir(base_dir) if f.endswith(".pdf"))
    for filename in pdf_files:
        path = os.path.join(base_dir, filename)
        text = extract_pdf_text(path)
        if text:
            label = filename.replace(".pdf", "").strip()
            chunks.append(f"\n--- {label} ---\n{text}")

    full = "\n".join(chunks)
    print(f"[RAG] Loaded {len(pdf_files)} PDFs → {len(full):,} chars total context")
    return full


# Built once at process start — cached for lifetime
RAG_CONTEXT = build_rag_context()
