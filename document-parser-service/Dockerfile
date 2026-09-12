FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTEST_ADDOPTS="-p no:cacheprovider"

WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir .
COPY app /app/app
COPY tests /app/tests
RUN chown -R app:app /app
USER app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
