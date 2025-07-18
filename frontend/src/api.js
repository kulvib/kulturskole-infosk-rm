const BASE_URL = import.meta.env.VITE_API_BASE;

export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  });
  if (!res.ok) throw new Error("Forkert login");
  return res.json();
}

export async function fetchClients(token) {
  const res = await fetch(`${BASE_URL}/clients`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchClient(token, clientId) {
  const res = await fetch(`${BASE_URL}/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setCustomName(token, clientId, name) {
  const res = await fetch(`${BASE_URL}/clients/${clientId}/set_custom_name`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({name})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setWebUrl(token, clientId, webUrl) {
  const res = await fetch(`${BASE_URL}/clients/${clientId}/set_web_url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({web_url: webUrl})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendClientCommand(token, clientId, command) {
  const res = await fetch(`${BASE_URL}/clients/${clientId}/command`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({command})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
