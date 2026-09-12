FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTEST_ADDOPTS="-p no:cacheprovider"

WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir .
COPY app /app/app
COPY tests /app/tests
USER app
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
