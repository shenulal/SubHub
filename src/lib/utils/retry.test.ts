// src/lib/utils/retry.test.ts
import { describe, expect, it, vi } from "vitest";
import { isRetryableError, processInBatches, withRetry } from "./retry";

describe("retry utilities", () => {
  describe("isRetryableError", () => {
    it("treats network errors as retryable", () => {
      expect(isRetryableError(new Error("network error"))).toBe(true);
      expect(isRetryableError(new Error("timeout occurred"))).toBe(true);
      expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
    });

    it("treats rate limit errors as retryable", () => {
      expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("Too many requests"))).toBe(true);
    });

    it("treats server errors as retryable", () => {
      expect(isRetryableError(new Error("500 Internal Server Error"))).toBe(
        true
      );
      expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    });

    it("treats generic errors as non-retryable", () => {
      expect(isRetryableError(new Error("validation error"))).toBe(false);
      expect(isRetryableError(new Error("user not found"))).toBe(false);
      expect(isRetryableError(new Error("unauthorized"))).toBe(false);
    });
  });

  describe("withRetry", () => {
    it("returns the result on success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries after a transient failure and succeeds", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, {
        initialDelay: 10,
        maxRetries: 3,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("fails immediately on non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("validation error"));

      await expect(
        withRetry(fn, { initialDelay: 10, maxRetries: 3 })
      ).rejects.toThrow("validation error");

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws once the maximum retries are exceeded", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("network error"));

      await expect(
        withRetry(fn, { initialDelay: 10, maxRetries: 2 })
      ).rejects.toThrow("network error");

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("invokes the onRetry callback", async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValue("success");

      await withRetry(fn, {
        initialDelay: 10,
        maxRetries: 3,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      );
    });
  });

  describe("processInBatches", () => {
    it("processes items in batches", async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi
        .fn()
        .mockImplementation((n) => Promise.resolve(n * 2));

      const { results, errors } = await processInBatches(items, 2, processor);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(errors).toHaveLength(0);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it("continues processing on error when continueOnError is true", async () => {
      const items = [1, 2, 3];
      const processor = vi.fn().mockImplementation((n) => {
        if (n === 2) return Promise.reject(new Error("failed"));
        return Promise.resolve(n);
      });

      const { results, errors } = await processInBatches(items, 1, processor, {
        continueOnError: true,
      });

      expect(results).toEqual([1, 3]);
      expect(errors).toHaveLength(1);
      expect(errors[0].item).toBe(2);
    });

    it("invokes the onBatchStart callback", async () => {
      const items = [1, 2, 3, 4];
      const onBatchStart = vi.fn();
      const processor = vi.fn().mockResolvedValue(1);

      await processInBatches(items, 2, processor, { onBatchStart });

      expect(onBatchStart).toHaveBeenCalledTimes(2);
      expect(onBatchStart).toHaveBeenCalledWith(0, 2);
      expect(onBatchStart).toHaveBeenCalledWith(1, 2);
    });
  });
});
