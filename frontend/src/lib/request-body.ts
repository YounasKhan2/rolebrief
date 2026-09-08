export interface SerializedRequestBody {
  body: BodyInit | undefined;
  headers: Record<string, string>;
}

export function hasContentTypeHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
}

export function removeContentTypeHeader(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "content-type") {
      result[key] = value;
    }
  }
  return result;
}

export function serializeRequestBody(
  body: unknown,
  existingHeaders: Record<string, string> = {}
): SerializedRequestBody {
  let headers = { ...existingHeaders };

  if (body === undefined || body === null) {
    return { body: undefined, headers };
  }

  // Handle FormData: remove Content-Type to preserve browser boundary
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    headers = removeContentTypeHeader(headers);
    return { body: body as BodyInit, headers };
  }

  // Handle Blob
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return { body: body as BodyInit, headers };
  }

  // Handle ArrayBuffer or ArrayBufferView
  if (
    typeof ArrayBuffer !== "undefined" &&
    (body instanceof ArrayBuffer || (typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(body)))
  ) {
    return { body: body as BodyInit, headers };
  }

  // Handle URLSearchParams
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return { body: body as BodyInit, headers };
  }

  // Handle string: preserve raw string, do not automatically label as application/json.
  // Caller must supply the appropriate Content-Type header if required.
  if (typeof body === "string") {
    return { body, headers };
  }

  // Objects and Arrays: serialize to JSON and attach application/json if no Content-Type was specified
  if (typeof body === "object") {
    if (!hasContentTypeHeader(headers)) {
      headers["Content-Type"] = "application/json";
    }
    return { body: JSON.stringify(body), headers };
  }

  // Primitives (e.g. number, boolean)
  if (!hasContentTypeHeader(headers)) {
    headers["Content-Type"] = "application/json";
  }
  return { body: JSON.stringify(body), headers };
}
