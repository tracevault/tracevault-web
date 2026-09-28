import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { watchSync } from '@/lib/api/sync';
vi.mock('@/lib/api/client', () => ({ apiClient: vi.fn() }));
const request = vi.mocked(apiClient);

beforeEach(() => { vi.useFakeTimers(); request.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('bounded authenticated sync polling', () => {
  it('uses the actual status endpoint and stops after completion', async () => {
    request.mockResolvedValueOnce({ status: 'syncing', events_synced: 0 }).mockResolvedValueOnce({ status: 'completed', events_synced: 5 });
    const onProgress = vi.fn(), onCompleted = vi.fn();
    const stop = watchSync('connection', { onProgress, onCompleted });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe('/api/v1/connections/connection/status');
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(onProgress.mock.calls[1][0].events_synced).toBe(5);
    stop();
  });
  it('does not treat failure as completed and bounds network retries', async () => {
    request.mockRejectedValue(new Error('offline'));
    const onError = vi.fn(), onCompleted = vi.fn();
    const stop = watchSync('connection', { onProgress: vi.fn(), onError, onCompleted });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(request).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledWith('offline');
    expect(onCompleted).not.toHaveBeenCalled(); stop();
  });
  it('ignores an in-flight response after unmount', async () => {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(new Promise(done => { resolve = done; }));
    const onProgress = vi.fn();
    const stop = watchSync('connection', { onProgress });
    stop(); resolve({ status: 'completed', events_synced: 2 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onProgress).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledTimes(1);
  });
  it('ends with a visible timeout if the job never finishes', async () => {
    request.mockResolvedValue({ status: 'syncing', events_synced: 1 });
    const onError = vi.fn();
    const stop = watchSync('connection', { onProgress: vi.fn(), onError, maxDurationMs: 1000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onError).toHaveBeenCalledOnce(); stop();
  });
});
