const apiUrl = process.env.REACT_APP_API_URL || "https://kulturskole-infosk-rm.onrender.com";

/** Hent token fra localStorage */
function getToken() {
  return localStorage.getItem("token");
}

/** Login og hent access token */
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

/** Hent alle klienter (kræver authentication) */
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

/** Hent én klient (kræver authentication) */
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

/** Opdater en klient (fx locality eller sort_order) (kræver authentication) */
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

/** Godkend en klient (kræver authentication) */
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

/** Fjern en klient (kræver authentication) */
export async function removeClient(id) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "POST",
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

/** Opdater kiosk webadresse på klient + push til klient */
export async function pushKioskUrl(id, url) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  // Antag backend endpoint: /api/clients/{id}/kiosk_url
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

/** Send handling til klient (start, restart, shutdown, chrome-shutdown) */
export async function clientAction(id, action) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  // Antag backend endpoint: /api/clients/{id}/action
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

/** Åbn terminal på klient (WebSocket shell proxy) */
export function openTerminal(id) {
  // Her skal du åbne en ny side eller modal med WebSocket shell proxy
  window.open(`${apiUrl}/api/clients/${id}/terminal`, "_blank", "noopener");
}

/** Åbn fjernskrivebord på klient (Ubuntu remote desktop) */
export function openRemoteDesktop(id) {
  window.open(`${apiUrl}/api/clients/${id}/remote-desktop`, "_blank", "noopener");
}

/** Hent URL til livestream fra klient (MJPEG/WebRTC) */
export function getClientStream(id) {
  return `${apiUrl}/api/clients/${id}/stream`; // Bruges som <img src={getClientStream(id)} /> eller <video ...>
}

/** Hent alle helligdage (kræver authentication) */
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

/** Tilføj ny helligdag (kræver authentication) */
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

/** Slet en helligdag (kræver authentication) */
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
