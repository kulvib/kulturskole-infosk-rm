export const apiUrl = process.env.REACT_APP_API_URL || "https://kulturskole-infosk-rm.onrender.com";

function getToken() {
  return localStorage.getItem("token");
}

export async function login(username, password) {
  const res = await fetch(`${apiUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) {
    let msg = "Forkert brugernavn eller kodeord";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function getClients() {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke hente klienter";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function getClient(id) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke hente klient";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function updateClient(id, updates) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/update`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    let msg = "Kunne ikke opdatere klient";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function approveClient(id) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke godkende klient";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function removeClient(id) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke fjerne klient";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
}

export async function pushKioskUrl(id, url) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/kiosk_url`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kiosk_url: url }),
  });
  if (!res.ok) {
    let msg = "Kunne ikke opdatere kiosk webadresse";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function clientAction(id, action) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/action`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    let msg = "Kunne ikke udføre handling";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export function openTerminal(id) {
  window.open(`${apiUrl}/api/clients/${id}/terminal`, "_blank", "noopener");
}

export function openRemoteDesktop(id) {
  window.open(`${apiUrl}/api/clients/${id}/remote-desktop`, "_blank", "noopener");
}

export function getClientStream(id) {
  return `${apiUrl}/api/clients/${id}/stream`;
}

export async function getHolidays() {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke hente helligdage";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function addHoliday(date, description) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, description }),
  });
  if (!res.ok) {
    let msg = "Kunne ikke tilføje helligdag";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function deleteHoliday(id) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/holidays/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke slette helligdag";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
}

// --- WRAPPER TIL KALENDER MARKED DAYS ---
export async function saveMarkedDays(payload) {
  const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = "Kunne ikke gemme kalender";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}
