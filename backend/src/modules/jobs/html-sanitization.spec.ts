import assert from "node:assert/strict";
import { test } from "node:test";

function sanitizeHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/<form[\s\S]*?>[\s\S]*?<\/form>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/href=["']data:[^"']*["']/gi, 'href="#"')
    .replace(/href=["']vbscript:[^"']*["']/gi, 'href="#"');
}

test("independently sanitizes malicious script, iframe, and inline event handlers", () => {
  const payload = `
    <div>
      <h2>Software Engineer</h2>
      <p>Great opportunity!</p>
      <script>alert('xss')</script>
      <iframe src="http://malicious.example"></iframe>
      <img src="valid.png" onerror="alert('pwned')" />
      <a href="javascript:stealToken()" onclick="sendCookies()">Click here</a>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data link</a>
      <a href="https://legitimate.example/apply">Legitimate apply link</a>
    </div>
  `;

  const cleaned = sanitizeHtml(payload);
  assert.ok(cleaned);
  assert.equal(cleaned.includes("<script>"), false);
  assert.equal(cleaned.includes("alert('xss')"), false);
  assert.equal(cleaned.includes("<iframe"), false);
  assert.equal(cleaned.includes("onerror="), false);
  assert.equal(cleaned.includes("onclick="), false);
  assert.equal(cleaned.includes("javascript:"), false);
  assert.equal(cleaned.includes("data:text/html"), false);
  assert.equal(cleaned.includes("https://legitimate.example/apply"), true);
  assert.equal(cleaned.includes("<h2>Software Engineer</h2>"), true);
  assert.equal(cleaned.includes("<p>Great opportunity!</p>"), true);
});
