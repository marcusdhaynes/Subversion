// The existing cloud server owns project storage, translation and collaboration.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://subversion.ai.studio' : '');
export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const target = typeof input === 'string' && input.startsWith('/api/') ? `${API_BASE_URL}${input}` : input;
  return fetch(target, init);
}
