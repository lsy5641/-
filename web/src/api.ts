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
};
