export interface CreatePresignedPutOptions {
  key: string;
  contentType: string;
  contentLength: number;
  sha256: string;
  expiresInSeconds: number;
}

export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectHead {
  exists: boolean;
  contentLength: number | null;
  contentType: string | null;
  sha256: string | null;
  metadata: Record<string, string>;
}

export interface ObjectStorage {
  createPresignedPut(options: CreatePresignedPutOptions): PresignedUpload;
  headObject(key: string): Promise<ObjectHead>;
}
