from PIL import Image
import pytesseract
import fitz  # PyMuPDF
import io
import logging

def extract_text_with_ocr(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using OCR when text extraction fails.
    """
    try:
        text = ""
        pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page_num, page in enumerate(pdf):
            try:
                # Get page as image
                pix = page.get_pixmap()
                img_data = pix.tobytes("png")
                
                # Convert to PIL Image
                image = Image.open(io.BytesIO(img_data))
                
                # Extract text using OCR
                page_text = pytesseract.image_to_string(image)
                text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                
            except Exception as e:
                logging.error(f"Error processing page {page_num + 1}: {e}")
                continue
        
        pdf.close()
        return text.strip()
        
    except Exception as e:
        logging.error(f"Error in OCR extraction: {e}")
        return f"OCR extraction failed: {str(e)}"
