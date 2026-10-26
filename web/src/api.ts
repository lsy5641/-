async function req(url: string, options?: RequestInit): Promise<any> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  let body: any = null;
  try { body = await res.json(); } catch { /* ignore non-json */ }
  if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `请求失败(${res.status})`);
  return body?.data;
}

export const api = {
  listItems: () => req('/api/profile/items'),
  createItem: (d: object) => req('/api/profile/items', { method: 'POST', body: JSON.stringify(d) }),
  updateItem: (id: number, d: object) => req(`/api/profile/items/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteItem: (id: number) => req(`/api/profile/items/${id}`, { method: 'DELETE' }),
  listVersions: (id: number) => req(`/api/profile/items/${id}/versions`),
  restoreVersion: (id: number, versionId: number) =>
    req(`/api/profile/items/${id}/restore`, { method: 'POST', body: JSON.stringify({ version_id: versionId }) }),
  getSettings: () => req('/api/settings'),
  saveSettings: (ai: object) => req('/api/settings', { method: 'PUT', body: JSON.stringify({ ai }) }),
  testSettings: () => req('/api/settings/test', { method: 'POST' }),
  createJd: (d: object) => req('/api/jds', { method: 'POST', body: JSON.stringify(d) }),
  listJds: () => req('/api/jds'),
  deleteJd: (id: number) => req(`/api/jds/${id}`, { method: 'DELETE' }),
  analyzeJd: (id: number) => req(`/api/jds/${id}/analyze`, { method: 'POST' }),
  listKeywords: () => req('/api/keywords'),
  addKeyword: (d: object) => req('/api/keywords', { method: 'POST', body: JSON.stringify(d) }),
  updateKeyword: (id: number, d: object) => req(`/api/keywords/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteKeyword: (id: number) => req(`/api/keywords/${id}`, { method: 'DELETE' }),
  listMaterials: () => req('/api/materials'),
  createMaterial: (d: object) => req('/api/materials', { method: 'POST', body: JSON.stringify(d) }),
  updateMaterial: (id: number, d: object) => req(`/api/materials/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteMaterial: (id: number) => req(`/api/materials/${id}`, { method: 'DELETE' }),
  aiBullets: (text: string) => req('/api/ai/bullets', { method: 'POST', body: JSON.stringify({ text }) }),
};
