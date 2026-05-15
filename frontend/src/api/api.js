// api.js
export const apiUrl = import.meta.env.VITE_API_URL || "https://kulturskole-infosk-rm.onrender.com";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return token
    ? { Authorization: `Bearer ${token}`, ...extra }
    : { ...extra };
}

function handle401() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  window.location.href = "/login";
}

async function extractError(res, fallback) {
  try {
    const data = await res.json();
    return data.detail || data.message || fallback;
  } catch {
    return fallback;
  }
}

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

export async function logout() {
  await fetch(`${apiUrl}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
}

export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter")); }
  return await res.json();
}

export async function getMyClients() {
  const res = await fetch(`${apiUrl}/api/clients/me`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter (me)")); }
  return await res.json();
}

export async function getClientsPublic() {
  const res = await fetch(`${apiUrl}/api/clients/public`);
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter")); }
  return await res.json();
}

export async function getClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klient")); }
  return await res.json();
}

export async function getChromeStatus(id, { fallbackToClient = false } = {}) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/chrome-status`, {
    headers: authHeaders({ Accept: "application/json" }),
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

export async function updateClient(id, updates) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/update`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere klient")); }
  return await res.json();
}

export async function approveClient(id, school_id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: school_id ? JSON.stringify({ school_id }) : undefined,
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke godkende klient")); }
  return await res.json();
}

export async function removeClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke fjerne klient")); }
}

export async function pushKioskUrl(id, url) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/kiosk_url`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ kiosk_url: url }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere kiosk webadresse")); }
  return await res.json();
}

export async function clientAction(id, action) {
  let url, method, payload;

  if (action === "chrome-start") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_chrome_action: "start", pending_chrome_action_source: "actionbutton" };
  } else if (action === "chrome-stop") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_chrome_action: "stop", pending_chrome_action_source: "actionbutton" };
  } else if (action === "livestream_start") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_chrome_action: "livestream_start", pending_chrome_action_source: "actionbutton" };
  } else if (action === "livestream_stop") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_chrome_action: "livestream_stop", pending_chrome_action_source: "actionbutton" };
  } else if (action === "sleep") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_chrome_action: "sleep", pending_chrome_action_source: "actionbutton" };
  } else if (action === "wakeup") {
    url = `${apiUrl}/api/clients/${id}/update`;
    method = "PUT";
    payload = { pending_chrome_action: "wakeup", pending_chrome_action_source: "actionbutton" };
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
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke udføre handling")); }
  return await res.json();
}

export async function setClientState(id, state) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/state`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ state }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke sætte klientens tilstand")); }
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
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente helligdage")); }
  return await res.json();
}

export async function addHoliday(date, description) {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
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
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke slette helligdag")); }
}

export async function saveMarkedDays(payload) {
  const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke gemme kalender")); }
  return await res.json();
}

// FIX: startDate og endDate er allerede YYYY-MM-DD strings fra ClientCalendarDialog.
// Kald IKKE .toISOString() på dem — det kaster TypeError på strings.
export async function getMarkedDays(season, client_id, startDate, endDate) {
  const params = new URLSearchParams({ season, client_id });
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const res = await fetch(`${apiUrl}/api/calendar/marked-days?${params.toString()}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { return { markedDays: {} }; }
  return await res.json();
}

export async function getCurrentSeason() {
  const res = await fetch(`${apiUrl}/api/calendar/season`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error("Kunne ikke hente aktuel sæson"); }
  return await res.json();
}

export async function getSchools() {
  const res = await fetch(`${apiUrl}/api/schools/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente skoler")); }
  return await res.json();
}

export async function addSchool(name) {
  const res = await fetch(`${apiUrl}/api/schools/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke tilføje skole")); }
  return await res.json();
}

export async function getSchoolTimes(schoolId) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/times`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente skoletider")); }
  return await res.json();
}

export async function updateSchoolTimes(schoolId, updates) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/times`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere skoletider")); }
  return await res.json();
}

export async function getUsers() {
  const res = await fetch(`${apiUrl}/api/users/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente brugere")); }
  return await res.json();
}

export async function createUser(userData) {
  const res = await fetch(`${apiUrl}/api/users/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
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
    headers: authHeaders({ "Content-Type": "application/json" }),
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
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke slette bruger")); }
}

export async function getSchoolClients(schoolId) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/clients/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente klienter for skole")); }
  return await res.json();
}

export async function deleteSchool(id) {
  const res = await fetch(`${apiUrl}/api/schools/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke slette skole")); }
}

export async function updateSchoolName(id, name) {
  const res = await fetch(`${apiUrl}/api/schools/${id}/`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke opdatere skolenavn")); }
  return await res.json();
}

export async function getLivestreamStatus(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/status/${clientId}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke hente livestream-status")); }
  return await res.json();
}

export async function startLivestream(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/start/${clientId}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke starte livestream")); }
  return await res.json();
}

export async function stopLivestream(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/stop/${clientId}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) { throw new Error(await extractError(res, "Kunne ikke stoppe livestream")); }
  return await res.json();
}
