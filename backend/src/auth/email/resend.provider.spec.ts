import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ResendEmailProvider } from "./resend.provider";
import { EmailProviderError } from "./email.types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function provider(status?: number) {
  const config = {
    auth: {
      email: {
        resendApiKey: "test_resend_key",
        from: "RoleBrief <security@example.invalid>",
        replyTo: ""
      }
    }
  };
  if (status) {
    globalThis.fetch = (async () => new Response("{}", { status })) as typeof fetch;
  }
  return new ResendEmailProvider(config as never);
}

test("classifies 429 as temporary for queue retry", async () => {
  await assert.rejects(
    provider(429).send({ to: "person@example.invalid", subject: "Subject", text: "Body", html: "<p>Body</p>" }, "dedupe"),
    (error) => error instanceof EmailProviderError && error.temporary && error.code === "resend_429"
  );
});

test("classifies validation errors as permanent", async () => {
  await assert.rejects(
    provider(422).send({ to: "person@example.invalid", subject: "Subject", text: "Body", html: "<p>Body</p>" }, "dedupe"),
    (error) => error instanceof EmailProviderError && !error.temporary && error.code === "resend_422"
  );
});

test("sends Resend idempotency key without exposing credentials", async () => {
  let headers: HeadersInit | undefined;
  globalThis.fetch = (async (_url, init) => {
    headers = init?.headers;
    return Response.json({ id: "email_123" });
  }) as typeof fetch;

  const result = await provider().send({ to: "person@example.invalid", subject: "Subject", text: "Body", html: "<p>Body</p>" }, "delivery-key");

  assert.equal(result.messageId, "email_123");
  assert.equal((headers as Record<string, string>)["Idempotency-Key"], "delivery-key");
  assert.equal((headers as Record<string, string>).Authorization, "Bearer test_resend_key");
});
