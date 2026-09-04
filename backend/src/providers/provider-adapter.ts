export interface ProviderPage<TRecord> {
  records: TRecord[];
  nextCursor: string | null;
  fetchedAt: Date;
  partialFailures: ProviderFailure[];
}

export interface ProviderFailure {
  cursor: string | null;
  status?: number;
  message: string;
  retryable: boolean;
}

export interface ProviderAdapter<TRecord> {
  readonly providerId: string;
  fetchPage(cursor: string | null): Promise<ProviderPage<TRecord>>;
}
