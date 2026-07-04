/**
 * Qontint API Client
 * Centralized fetch wrapper for backend communication.
 */

/**
 * In development:  empty string → Vite proxy forwards /api/* to localhost:8000
 * In production:   VITE_API_BASE_URL is injected by Render at build time
 *                  pointing to the backend service URL.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = endpoint.includes('/generate') ? 300_000 : 120_000,
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(formatFetchError(err));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    let msg = errorBody.detail;
    if (Array.isArray(msg)) {
      msg = msg.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
    }
    throw new Error(msg || `API Error: ${response.status}`);
  }

  return response.json();
}

function formatFetchError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Analysis timed out after 2 minutes. Wait for the backend to finish loading models, then try again.';
    }
    return err.message;
  }
  return 'Request failed';
}
