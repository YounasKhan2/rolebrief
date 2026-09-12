import time

from fastapi.testclient import TestClient

from app.main import app


def make_pdf(text: str) -> bytes:
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream.encode('utf-8'))} >>\nstream\n{stream}\nendstream",
    ]
    body = "%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(body.encode("utf-8")))
        body += f"{index} 0 obj\n{obj}\nendobj\n"
    xref = len(body.encode("utf-8"))
    body += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    body += "".join(f"{offset:010d} 00000 n \n" for offset in offsets[1:])
    body += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return body.encode("utf-8")


def make_positioned_pdf(operations: list[str]) -> bytes:
    stream = "\n".join(operations)
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream.encode('utf-8'))} >>\nstream\n{stream}\nendstream",
    ]
    body = "%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(body.encode("utf-8")))
        body += f"{index} 0 obj\n{obj}\nendobj\n"
    xref = len(body.encode("utf-8"))
    body += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    body += "".join(f"{offset:010d} 00000 n \n" for offset in offsets[1:])
    body += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return body.encode("utf-8")


def test_health_ready():
    client = TestClient(app)
    response = client.get("/internal/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["nativePdfEngine"] == "pdfplumber"


def test_extract_requires_internal_credential(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "auto",
        "deadlineMs": "1000",
    }, files={"file": ("resume.pdf", make_pdf("Summary"), "application/pdf")}, headers={"X-RoleBrief-Contract": "document-parser-v1"})
    assert response.status_code == 401


def test_extract_valid_pdf_contract(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "disabled",
        "deadlineMs": "3000",
    }, files={"file": ("resume.pdf", make_pdf("Professional Summary"), "application/pdf")}, headers={
        "Authorization": "Bearer secret",
        "X-RoleBrief-Contract": "document-parser-v1",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["contractVersion"] == 1
    assert payload["parser"]["nativePdfEngine"].startswith("pdfplumber")
    assert payload["metrics"]["blockCount"] >= 1
    assert payload["blocks"][0]["extractionMethod"] == "NATIVE_PDF"


def test_extract_rejects_unsupported_media_type(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "text/plain",
        "ocrPolicy": "disabled",
        "deadlineMs": "3000",
    }, files={"file": ("resume.txt", b"hello", "text/plain")}, headers={
        "Authorization": "Bearer secret",
        "X-RoleBrief-Contract": "document-parser-v1",
    })
    assert response.status_code == 415


def test_extract_enforces_input_size_limit(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    monkeypatch.setattr("app.main.MAX_BYTES", 10)
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "disabled",
        "deadlineMs": "3000",
    }, files={"file": ("resume.pdf", make_pdf("This is too large for the test limit"), "application/pdf")}, headers={
        "Authorization": "Bearer secret",
        "X-RoleBrief-Contract": "document-parser-v1",
    })
    assert response.status_code == 413


def test_multi_column_pdf_has_deterministic_column_order(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    client = TestClient(app)
    pdf = make_positioned_pdf([
        "BT /F1 12 Tf 72 720 Td (Left Column Summary) Tj ET",
        "BT /F1 12 Tf 72 690 Td (Left Column Experience) Tj ET",
        "BT /F1 12 Tf 360 720 Td (Right Column Skills) Tj ET",
        "BT /F1 12 Tf 360 690 Td (Right Column Education) Tj ET",
    ])
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "disabled",
        "deadlineMs": "3000",
    }, files={"file": ("resume.pdf", pdf, "application/pdf")}, headers={
        "Authorization": "Bearer secret",
        "X-RoleBrief-Contract": "document-parser-v1",
    })
    assert response.status_code == 200
    texts = [block["text"] for block in response.json()["blocks"]]
    assert texts == [
        "Left Column Summary",
        "Left Column Experience",
        "Right Column Skills",
        "Right Column Education",
    ]


def test_timeout_returns_parser_timeout_and_cleans_temp(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")

    def slow_extract_pdf(*_args, **_kwargs):
        time.sleep(1.2)
        return [], [], [], 0

    monkeypatch.setattr("app.main.extract_pdf", slow_extract_pdf)
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "disabled",
        "deadlineMs": "1000",
    }, files={"file": ("resume.pdf", make_pdf("Timeout"), "application/pdf")}, headers={
        "Authorization": "Bearer secret",
        "X-RoleBrief-Contract": "document-parser-v1",
    })
    assert response.status_code == 504
