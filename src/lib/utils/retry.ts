// src/lib/utils/retry.ts
/**
 * Exponential backoff retry utility
 * Handles transient errors in cron jobs and external API calls
 */

export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Initial delay (ms, default: 1000) */
  initialDelay?: number;
  /** Delay multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay (ms, default: 30000) */
  maxDelay?: number;
  /** Predicate deciding which errors are retryable */
  shouldRetry?: (error: Error) => boolean;
  /** Callback invoked on each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> =
  {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
  };

/**
 * Default check for retryable errors
 * Network errors, timeouts, 5xx errors, etc.
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network-related errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  // Rate limiting
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return true;
  }

  // Server errors (5xx)
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true;
  }

  return false;
}

/**
 * Run a function with exponential backoff retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Throw on the last attempt
      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      // Throw immediately for non-retryable errors
      const shouldRetryFn = opts.shouldRetry || isRetryableError;
      if (!shouldRetryFn(lastError)) {
        throw lastError;
      }

      // Compute the exponential backoff delay
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      // Retry callback
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1, delay);
      }

      console.warn(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms:`,
        lastError.message
      );

      // Wait
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should be unreachable in theory
  throw lastError || new Error("Unexpected retry failure");
}

/**
 * Process a batch job in chunks (avoids timeouts)
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  options: {
    /** Delay between batches (ms) */
    delayBetweenBatches?: number;
    /** Callback when a batch starts */
    onBatchStart?: (batchIndex: number, totalBatches: number) => void;
    /** Whether to continue after a failed item */
    continueOnError?: boolean;
  } = {}
): Promise<{ results: R[]; errors: { item: T; error: Error }[] }> {
  const results: R[] = [];
  const errors: { item: T; error: Error }[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  for (let i = 0; i < items.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize);
    const batch = items.slice(i, i + batchSize);

    if (options.onBatchStart) {
      options.onBatchStart(batchIndex, totalBatches);
    }

    // Process items in parallel within a batch
    const batchResults = await Promise.allSettled(batch.map(processor));

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const error =
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason));
        errors.push({ item: batch[j], error });

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    // Wait between batches (avoids rate limits)
    if (options.delayBetweenBatches && i + batchSize < items.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, options.delayBetweenBatches)
      );
    }
  }

  return { results, errors };
}
