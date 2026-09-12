import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, createHash } from "node:crypto";
import { AppConfigService } from "../../common/config/app-config.service";
import { ObjectHead, ObjectStorage, PresignedUpload, CreatePresignedPutOptions } from "./s3-storage.types";

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function amzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(date: Date) {
  return amzDate(date).slice(0, 8);
}

function encodePathSegment(segment: string) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalPath(key: string) {
  return key.split("/").map(encodePathSegment).join("/");
}

@Injectable()
export class S3StorageService implements ObjectStorage {
  constructor(private readonly config: AppConfigService) {}

  createPresignedPut(options: CreatePresignedPutOptions): PresignedUpload {
    const cfg = this.config.resumes.storage;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + options.expiresInSeconds * 1000);
    const endpoint = new URL(cfg.publicEndpoint);
    const internalEndpoint = new URL(cfg.endpoint);
    const bucket = cfg.bucket;
    const path = cfg.forcePathStyle ? `/${bucket}/${canonicalPath(options.key)}` : `/${canonicalPath(options.key)}`;
    const host = cfg.forcePathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
    const credentialScope = `${dateStamp(now)}/${cfg.region}/s3/aws4_request`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-meta-sha256";
    const credential = `${cfg.accessKeyId}/${credentialScope}`;
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate(now),
      "X-Amz-Expires": String(options.expiresInSeconds),
      "X-Amz-SignedHeaders": signedHeaders
    });
    const headers = {
      "content-type": options.contentType,
      host,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "x-amz-meta-sha256": options.sha256
    };
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}\n`)
      .join("");
    const canonicalRequest = [
      "PUT",
      path,
      query.toString(),
      canonicalHeaders,
      signedHeaders,
      "UNSIGNED-PAYLOAD"
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate(now),
      credentialScope,
      hash(canonicalRequest)
    ].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp(now)), cfg.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    query.set("X-Amz-Signature", signature);
    const url = new URL(path, `${endpoint.protocol}//${host}`);
    url.search = query.toString();

    // Keep the internal endpoint referenced so misconfigured public endpoints
    // fail early in tests/config validation rather than at confirmation time.
    void internalEndpoint;

    return {
      url: url.toString(),
      method: "PUT",
      headers: {
        "Content-Type": options.contentType,
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
        "x-amz-meta-sha256": options.sha256
      },
      expiresAt
    };
  }

  async headObject(key: string): Promise<ObjectHead> {
    const cfg = this.config.resumes.storage;
    const endpoint = new URL(cfg.endpoint);
    const host = cfg.forcePathStyle ? endpoint.host : `${cfg.bucket}.${endpoint.host}`;
    const path = cfg.forcePathStyle ? `/${cfg.bucket}/${canonicalPath(key)}` : `/${canonicalPath(key)}`;
    const now = new Date();
    const credentialScope = `${dateStamp(now)}/${cfg.region}/s3/aws4_request`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const headers = {
      host,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "x-amz-date": amzDate(now)
    };
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([header, value]) => `${header}:${value}\n`)
      .join("");
    const canonicalRequest = ["HEAD", path, "", canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate(now), credentialScope, hash(canonicalRequest)].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp(now)), cfg.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const url = new URL(path, `${endpoint.protocol}//${host}`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        headers: {
          Host: host,
          "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
          "x-amz-date": amzDate(now),
          Authorization: authorization
        },
        signal: AbortSignal.timeout(2000)
      });
    } catch {
      throw new ServiceUnavailableException("Resume storage is temporarily unavailable.");
    }

    if (response.status === 404) {
      return { exists: false, contentLength: null, contentType: null, sha256: null, metadata: {} };
    }
    if (!response.ok) {
      throw new ServiceUnavailableException("Resume storage is temporarily unavailable.");
    }

    const metadata: Record<string, string> = {};
    response.headers.forEach((value, header) => {
      if (header.toLowerCase().startsWith("x-amz-meta-")) {
        metadata[header.toLowerCase().slice("x-amz-meta-".length)] = value;
      }
    });
    return {
      exists: true,
      contentLength: Number(response.headers.get("content-length") ?? "0"),
      contentType: response.headers.get("content-type"),
      sha256: metadata.sha256 ?? response.headers.get("x-amz-checksum-sha256"),
      metadata
    };
  }

  async getObjectBuffer(key: string, maxBytes: number): Promise<Buffer> {
    const response = await this.signedFetch("GET", key, AbortSignal.timeout(5000));
    if (response.status === 404) {
      throw new ServiceUnavailableException("Resume storage object is unavailable.");
    }
    if (!response.ok || !response.body) {
      throw new ServiceUnavailableException("Resume storage is temporarily unavailable.");
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          throw new ServiceUnavailableException("Resume storage object exceeds the processing limit.");
        }
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Resume storage is temporarily unavailable.");
    }
    return Buffer.concat(chunks, total);
  }

  private async signedFetch(method: "GET", key: string, signal: AbortSignal) {
    const cfg = this.config.resumes.storage;
    const endpoint = new URL(cfg.endpoint);
    const host = cfg.forcePathStyle ? endpoint.host : `${cfg.bucket}.${endpoint.host}`;
    const path = cfg.forcePathStyle ? `/${cfg.bucket}/${canonicalPath(key)}` : `/${canonicalPath(key)}`;
    const now = new Date();
    const credentialScope = `${dateStamp(now)}/${cfg.region}/s3/aws4_request`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const headers = {
      host,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "x-amz-date": amzDate(now)
    };
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([header, value]) => `${header}:${value}\n`)
      .join("");
    const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate(now), credentialScope, hash(canonicalRequest)].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp(now)), cfg.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const url = new URL(path, `${endpoint.protocol}//${host}`);
    try {
      return await fetch(url, {
        method,
        headers: {
          Host: host,
          "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
          "x-amz-date": amzDate(now),
          Authorization: authorization
        },
        signal
      });
    } catch {
      throw new ServiceUnavailableException("Resume storage is temporarily unavailable.");
    }
  }
}
