FROM python:3.12-slim

# Environment variables for Python runtime
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Install minimal system dependencies for OCR + numpy/scipy
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      libtesseract5 \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# TORCH_GPU=1 (default): install PyTorch with CUDA 12.1 for production (embeddings + matching).
# TORCH_GPU=0: install CPU-only PyTorch for dev. We only install torch (no torchvision/torchaudio).
ARG TORCH_GPU=1
RUN pip install --upgrade pip setuptools wheel && \
    if [ "$TORCH_GPU" = "1" ]; then \
      pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cu121; \
    else \
      pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu; \
    fi

# Install application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y torchvision torchaudio 2>/dev/null || true

# Copy application code
COPY . .

EXPOSE 8000

# Start uvicorn with configurable worker count
CMD uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}