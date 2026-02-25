const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTodaysTopic: () => apiFetch('/topics/today'),
  getTopicBySlug: (slug) => apiFetch(`/topics/${slug}`),
  listTopics: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return apiFetch(`/topics${qs ? `?${qs}` : ''}`);
  },
  getCategories: () => apiFetch('/topics/categories'),
};
