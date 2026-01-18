export async function bpFetch(path, { method = "GET", body } = {}) {
  const url = `${window.BOOKPOINT.restUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-WP-Nonce": window.BOOKPOINT.nonce,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}
