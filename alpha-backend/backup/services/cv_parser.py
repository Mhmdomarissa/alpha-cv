import fitz  # for PDF
import docx  # for DOCX
from pathlib import Path

def extract_text_from_pdf(file_path: Path) -> str:
    text = ""
    with fitz.open(file_path) as pdf:
        for page in pdf:
            text += page.get_text()
    return text.strip()

def extract_text_from_docx(file_path: Path) -> str:
    doc = docx.Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])
