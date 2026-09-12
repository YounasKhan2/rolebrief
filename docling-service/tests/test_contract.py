from fastapi.testclient import TestClient

from app.main import app


def test_health_ready():
    client = TestClient(app)
    assert client.get("/internal/v1/health/ready").status_code == 200


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


def test_extract_requires_internal_credential(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "auto",
        "deadlineMs": "1000",
    }, files={"file": ("resume.pdf", make_pdf("Summary"), "application/pdf")}, headers={"X-RoleBrief-Contract": "docling-v1"})
    assert response.status_code == 401


def test_extract_valid_pdf_contract(monkeypatch):
    monkeypatch.setattr("app.main.TOKEN", "secret")
    client = TestClient(app)
    response = client.post("/internal/v1/documents/extract", data={
        "contractVersion": "1",
        "documentRef": "resume:test",
        "mediaType": "application/pdf",
        "ocrPolicy": "auto",
        "deadlineMs": "1000",
    }, files={"file": ("resume.pdf", make_pdf("Professional Summary"), "application/pdf")}, headers={
        "Authorization": "Bearer secret",
        "X-RoleBrief-Contract": "docling-v1",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["contractVersion"] == 1
    assert payload["parserName"] == "docling"
    assert payload["metrics"]["blockCount"] >= 1
