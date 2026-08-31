export interface IndexedText {
  idx: number;
  text: string;
}

export interface Batch {
  items: IndexedText[];
}

/** Split texts into batches limited by item count and total characters. */
export function chunkTexts(items: IndexedText[], maxItems: number, maxChars: number): Batch[] {
  const batches: Batch[] = [];
  let current: IndexedText[] = [];
  let chars = 0;
  for (const item of items) {
    const len = item.text.length;
    if (current.length > 0 && (current.length >= maxItems || chars + len > maxChars)) {
      batches.push({ items: current });
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += len;
  }
  if (current.length > 0) batches.push({ items: current });
  return batches;
}

/** Run an async fn over items with a concurrency limit, preserving order of results. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Retry with exponential backoff. Auth-style errors are not retried. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // don't retry on auth/config errors
      if (/\b(401|403|invalid[_ ]api[_ ]key|unauthorized)\b/i.test(msg)) throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}
