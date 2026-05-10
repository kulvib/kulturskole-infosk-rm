// api.js
export const apiUrl = process.env.REACT_APP_API_URL || "https://kulturskole-infosk-rm.onrender.com";

// INTERN HJÆLPER: fælles fejlhåndtering for 401
function handle401() {
  // Fjern brugersession fra localStorage og omdirigér til login
  localStorage.removeItem("user");
  window.location.href = "/login";
}

// INTERN HJÆLPER: læs fejlbesked fra response
async function extractError(res, fallback) {
  try {
    const data = await res.json();
    return data.detail || data.message || fallback;
  } catch {
    return fallback;
  }
}

// LOGIN
export async function login(username, password) {
  const res = await fetch(`${apiUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    credentials: "include",
  });
  if (!res.ok) {
    const msg = await extractError(res, "Forkert brugernavn eller kodeord");
    throw new Error(msg);
  }
  return await res.json();
}

// LOGOUT
export async function logout() {
  await fetch(`${apiUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

// HENT KLIENTER (admin)
export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter")); }
  return await res.json();
}

// HENT KLIENTER (bruger - kun egne godkendte)
export async function getMyClients() {
  const res = await fetch(`${apiUrl}/api/clients/me`, {
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter (me)")); }
  return await res.json();
}

// HENT KLIENT-LISTE PUBLIC
export async function getClientsPublic() {
  const res = await fetch(`${apiUrl}/api/clients/public`);
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter")); }
  return await res.json();
}

// HENT ÉN KLIENT
export async function getClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/`, {
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klient")); }
  return await res.json();
}

// HENT KIOSK/CHROME STATUS
export async function getChromeStatus(id, { fallbackToClient = false } = {}) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/chrome-status`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) {
    if (fallbackToClient) {
      const full = await getClient(id);
      return {
        chrome_status: full.chrome_status ?? null,
        chrome_color: full.chrome_color ?? null,
        chrome_last_updated: full.chrome_last_updated ?? null,
        last_seen: full.last_seen ?? null,
        uptime: full.uptime ?? null,
      };
    }
    throw new Error(await extractError(res, "Kunne ikke hente chrome status"));
  }
  const json = await res.json();
  if (fallbackToClient) {
    const missingLastSeen = json?.last_seen == null;
    const missingUptime = json?.uptime == null;
    if (missingLastSeen || missingUptime) {
      try {
        const full = await getClient(id);
        return { ...json, last_seen: json.last_seen ?? full.last_seen ?? null, uptime: json.uptime ?? full.uptime ?? null };
      } catch {
        return json;
      }
    }
  }
  return json;
}

// OPDATÉR KLIENT
export async function updateClient(id, updates) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere klient")); }
  return await res.json();
}

// GODKEND KLIENT
export async function approveClient(id, school_id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: school_id ? JSON.stringify({ school_id }) : undefined,
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke godkende klient")); }
  return await res.json();
}

// FJERN KLIENT
export async function removeClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke fjerne klient")); }
}

// KIOSK URL
export async function pushKioskUrl(id, url) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/kiosk_url`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ kiosk_url: url }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere kiosk webadresse")); }
  return await res.json();
}

// KLIENT ACTIONS
export async function clientAction(id, action) {
  let url, method, payload;

  if (action === "chrome-start") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    method = "POST";
    payload = { action: "start" };
  } else if (action === "chrome-shutdown") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    method = "POST";
    payload = { action: "stop" };
  } else if (action === "livestream_start") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    method = "POST";
    payload = { action: "livestream_start" };
  } else if (action === "livestream_stop") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    method = "POST";
    payload = { action: "livestream_stop" };
  } else if (action === "sleep") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    method = "POST";
    payload = { action: "sleep" };
  } else if (action === "wakeup") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    method = "POST";
    payload = { action: "wakeup" };
  } else if (action === "restart") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_reboot: true };
  } else if (action === "shutdown") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_shutdown: true };
  } else {
    throw new Error("Ukendt action: " + action);
  }

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke udføre handling")); }
  return await res.json();
}

// SÆT KLIENTENS STATE
export async function setClientState(id, state) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ state }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke sætte klientens tilstand")); }
  return await res.json();
}

// ÅBN TERMINAL / REMOTE DESKTOP
export function openTerminal(id) {
  window.open(`${apiUrl}/api/clients/${id}/terminal`, "_blank", "noopener");
}

export function openRemoteDesktop(id) {
  window.open(`${apiUrl}/api/clients/${id}/remote-desktop`, "_blank", "noopener");
}

export function getClientStream(id) {
  return `${apiUrl}/api/clients/${id}/stream`;
}

// HELLIGDAGE
export async function getHolidays() {
  const res = await fetch(`${apiUrl}/api/holidays/`, { credentials: "include" });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente helligdage")); }
  return await res.json();
}

export async function addHoliday(date, description) {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ date, description }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke tilføje helligdag")); }
  return await res.json();
}

export async function deleteHoliday(id) {
  const res = await fetch(`${apiUrl}/api/holidays/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke slette helligdag")); }
}

// KALENDER
export async function saveMarkedDays(payload) {
  const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke gemme kalender")); }
  return await res.json();
}

export async function getMarkedDays(season, client_id, startDate, endDate) {
  const params = new URLSearchParams({ season, client_id });
  if (startDate) params.append("start_date", startDate.toISOString().slice(0, 10));
  if (endDate) params.append("end_date", endDate.toISOString().slice(0, 10));
  const res = await fetch(`${apiUrl}/api/calendar/marked-days?${params.toString()}`, {
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { return { markedDays: {} }; }
  return await res.json();
}

export async function getCurrentSeason() {
  const res = await fetch(`${apiUrl}/api/calendar/season`, { credentials: "include" });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error("Kunne ikke hente aktuel sæson"); }
  return await res.json();
}

// SKOLER
export async function getSchools() {
  const res = await fetch(`${apiUrl}/api/schools/`, { credentials: "include" });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente skoler")); }
  return await res.json();
}

export async function addSchool(name) {
  const res = await fetch(`${apiUrl}/api/schools/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke tilføje skole")); }
  return await res.json();
}

export async function getSchoolTimes(schoolId) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/times`, { credentials: "include" });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente skoletider")); }
  return await res.json();
}

export async function updateSchoolTimes(schoolId, updates) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/times`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere skoletider")); }
  return await res.json();
}

// BRUGERE (admin)
export async function getUsers() {
  const res = await fetch(`${apiUrl}/api/users/`, { credentials: "include" });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente brugere")); }
  return await res.json();
}

export async function createUser(userData) {
  const res = await fetch(`${apiUrl}/api/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(userData),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke oprette bruger")); }
  return await res.json();
}

export async function updateUser(id, updates) {
  const res = await fetch(`${apiUrl}/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere bruger")); }
  return await res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${apiUrl}/api/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke slette bruger")); }
}

export async function getSchoolClients(schoolId) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/clients/`, { credentials: "include" });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter for skole")); }
  return await res.json();
}

export async function deleteSchool(id) {
  const res = await fetch(`${apiUrl}/api/schools/${id}/`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke slette skole")); }
}

export async function updateSchoolName(id, name) {
  const res = await fetch(`${apiUrl}/api/schools/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere skolenavn")); }
  return await res.json();
}

// LIVESTREAM
export async function getLivestreamStatus(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/status/${clientId}`, {
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente livestream-status")); }
  return await res.json();
}

export async function startLivestream(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/start/${clientId}`, {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke starte livestream")); }
  return await res.json();
}

export async function stopLivestream(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/stop/${clientId}`, {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke stoppe livestream")); }
  return await res.json();
}

