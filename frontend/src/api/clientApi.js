// Wrapper for all API calls to the backend, using JWT token from localStorage

const API_BASE = "https://kulturskole-infoskaerm-backend.onrender.com/api"; // Ret hvis din backend har anden base

// Helper: get JWT token from storage
function getToken() {
  // Bruger "access_token" for at matche login-komponenten
  return localStorage.getItem("access_token");
}

// Helper: default headers with JWT
function authHeaders(extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// Login, returns { access_token, ... }
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return await res.json();
}

// Hent alle klienter (forside)
export async function fetchClients() {
  const res = await fetch(`${API_BASE}/clients`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Fejl ved hentning af klienter");
  return await res.json();
}

// Hent kun pending clients (NYT)
export async function fetchPendingClients() {
  const res = await fetch(`${API_BASE}/clients/pending`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Fejl ved hentning af pending klienter");
  return await res.json();
}

// Hent én klient (info-side)
export async function fetchClient(clientId) {
  const res = await fetch(`${API_BASE}/clients/${clientId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Fejl ved hentning af klient");
  return await res.json();
}

// Opdater visningsnavn eller webadresse for klient
export async function updateClient(clientId, data) {
  const res = await fetch(`${API_BASE}/clients/${clientId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Opdatering fejlede");
  return await res.json();
}

// Godkend klient (PATCH /clients/:id/approve)
export async function approveClient(clientId, display_name) {
  // Tilføj display_name hvis det skal ændres ved godkendelse
  const body = display_name ? JSON.stringify({ display_name }) : undefined;
  const res = await fetch(`${API_BASE}/clients/${clientId}/approve`, {
    method: "PATCH",
    headers: authHeaders(),
    body: body,
  });
  if (!res.ok) throw new Error("Godkendelse fejlede");
  return await res.json();
}

// Handlinger: start, stop, restart, shutdown, browser shutdown
export async function clientAction(clientId, action) {
  const res = await fetch(`${API_BASE}/clients/${clientId}/action`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("Handling fejlede");
  return await res.json();
}

// WebSocket URL for terminal
export function getTerminalWsUrl(clientId) {
  // Ret evt. til wss hvis din backend kræver det!
  return `wss://kulturskole-infoskaerm-backend.onrender.com/api/clients/${clientId}/terminal/ws?token=${getToken()}`;
}

// MJPEG/stream URL
export function getStreamUrl(clientId) {
  return `${API_BASE}/clients/${clientId}/stream?token=${getToken()}`;
}
