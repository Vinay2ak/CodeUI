import { describe, it, expect, vi } from 'vitest';
import { probeGrafana, isMixedContent } from './probe';

describe('probeGrafana logic', () => {
  it('1. returns reachable when /api/health resolves', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));

    const result = await probeGrafana('http://backend.internal:3001', {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result).toBe('reachable');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.internal:3001/api/health',
      expect.objectContaining({
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
      })
    );
  });

  it('2. returns unreachable on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await probeGrafana('http://backend.internal:3001', {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result).toBe('unreachable');
  });

  it('3. returns unreachable on request timeout', async () => {
    const mockFetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const result = await probeGrafana('http://backend.internal:3001', {
      timeoutMs: 50,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result).toBe('unreachable');
  });

  it('4. detects mixed content when app is https and target is http', () => {
    expect(isMixedContent('https:', 'http:')).toBe(true);
    expect(isMixedContent('http:', 'http:')).toBe(false);
    expect(isMixedContent('https:', 'https:')).toBe(false);
    expect(isMixedContent('http:', 'https:')).toBe(false);
  });
});
