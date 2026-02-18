type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ApiError {
  status: number;
  error: string;
}

class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, retries = 1): Promise<T> {
  const headers: HeadersInit = {};
  if (body) headers['Content-Type'] = 'application/json';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const data = (await res.json()) as ApiError;
          errorMsg = data.error || errorMsg;
        } catch { /* use default */ }
        throw new ApiClientError(res.status, errorMsg);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiClientError && err.status < 500) throw err;
      if (attempt === retries) throw err;
      // Wait before retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error('Unreachable');
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { ApiClientError };
