/*
  api.js

  Alle backend-kald samlet ét sted.

  FIX: getMarkedDays(season, client_id, startDate, endDate)
    — parametrene var byttet om i ClientDetailsPageWrapper (id, season)
    — signaturen er nu tydelig dokumenteret med JSDoc
    — bruges korrekt i ClientCalendarDialog og ClientDetailsPageWrapper

  FIX: clientAction mapper "start"/"stop"/"reboot"/"shutdown" korrekt
    — "reboot" → pending_reboot: true
    — "shutdown" → pending_shutdown: true
    — "start" → pending_chrome_action: "start"
    — "stop" → pending_chrome_action: "stop"

  FIX: getChromeStatus fallback returnerer nu altid uptime + last_seen
    fra getClient() hvis chrome-status endpointet ikke returnerer dem.
*/

export const apiUrl =
  import.meta.env.VITE_API_URL ||
  "https://kulturskole-infosk-rm.onrender.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export function getAuthToken() {
  return localStorage.getItem("token") || "";
}

export function getWsApiUrl() {
  if (apiUrl.startsWith("https://")) return `wss://${apiUrl.slice("https://".length)}`;
  if (apiUrl.startsWith("http://")) return `ws://${apiUrl.slice("http://".length)}`;
  return apiUrl;
}

export function getTerminalBrowserWsUrl(clientId, mode = "user") {
  const token = getAuthToken();
  const params = new URLSearchParams();
  params.set("mode", mode === "admin" ? "admin" : "user");
  if (token) params.set("token", token);
  return `${getWsApiUrl()}/api/terminal/browser/${encodeURIComponent(clientId)}/ws?${params.toString()}`;
}

async function extractError(res, fallback) {
  try {
    const data = await res.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(username, password) {
  const res = await fetch(`${apiUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(
      await extractError(res, "Forkert brugernavn eller kodeord")
    );
  return res.json();
}

export async function logout() {
  await fetch(`${apiUrl}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
}

// ---------------------------------------------------------------------------
// Klienter
// ---------------------------------------------------------------------------

export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente klienter"));
  return res.json();
}

export async function getMyClients() {
  const res = await fetch(`${apiUrl}/api/clients/me`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente klienter (me)"));
  return res.json();
}

export async function getClientsPublic() {
  const res = await fetch(`${apiUrl}/api/clients/public`);
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente klienter"));
  return res.json();
}

export async function getClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente klient"));
  return res.json();
}

/**
 * Hent chrome-status for en klient.
 * @param {number|string} id - Klient ID
 * @param {{ fallbackToClient?: boolean }} options
 * @returns {{ chrome_status, chrome_color, chrome_last_updated, last_seen, uptime }}
 */
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

  // FIX: Supplér last_seen + uptime fra getClient hvis chrome-status
  // endpointet ikke returnerer dem (ikke alle backends gør det).
  if (fallbackToClient && (json?.last_seen == null || json?.uptime == null)) {
    try {
      const full = await getClient(id);
      return {
        ...json,
        last_seen: json.last_seen ?? full.last_seen ?? null,
        uptime: json.uptime ?? full.uptime ?? null,
      };
    } catch {
      return json;
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
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke opdatere klient"));
  return res.json();
}

export async function approveClient(id, school_id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: school_id ? JSON.stringify({ school_id }) : undefined,
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke godkende klient"));
  return res.json();
}

export async function removeClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke fjerne klient"));
}

export async function pushKioskUrl(id, url) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/kiosk_url`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ kiosk_url: url }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke opdatere kiosk webadresse"));
  return res.json();
}

/**
 * Udfør en handling på en klient.
 *
 * Gyldige actions:
 *   "start"            → pending_chrome_action: "start"
 *   "stop"             → pending_chrome_action: "stop"
 *   "restart"          → pending_reboot: true  (genstart maskine)
 *   "reboot"           → pending_reboot: true
 *   "shutdown"         → pending_shutdown: true
 *   "sleep"            → pending_chrome_action: "sleep"
 *   "wakeup"           → pending_chrome_action: "wakeup"
 *   "livestream_start" → pending_chrome_action: "livestream_start"
 *   "livestream_stop"  → pending_chrome_action: "livestream_stop"
 */
export async function clientAction(id, action) {
  let payload;

  switch (action) {
    case "start":
      payload = {
        pending_chrome_action: "start",
        pending_chrome_action_source: "actionbutton",
      };
      break;
    case "stop":
      payload = {
        pending_chrome_action: "stop",
        pending_chrome_action_source: "actionbutton",
      };
      break;
    case "restart":
    case "reboot":
      payload = { pending_reboot: true };
      break;
    case "shutdown":
      payload = { pending_shutdown: true };
      break;
    case "sleep":
      payload = {
        pending_chrome_action: "sleep",
        pending_chrome_action_source: "actionbutton",
      };
      break;
    case "wakeup":
      payload = {
        pending_chrome_action: "wakeup",
        pending_chrome_action_source: "actionbutton",
      };
      break;
    case "livestream_start":
      payload = {
        pending_chrome_action: "livestream_start",
        pending_chrome_action_source: "actionbutton",
      };
      break;
    case "livestream_stop":
      payload = {
        pending_chrome_action: "livestream_stop",
        pending_chrome_action_source: "actionbutton",
      };
      break;
    default:
      throw new Error("Ukendt action: " + action);
  }

  const res = await fetch(`${apiUrl}/api/clients/${id}/update`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke udføre handling"));
  return res.json();
}

export async function setClientState(id, state) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/state`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ state }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke sætte klientens tilstand"));
  return res.json();
}

export function openTerminal(id) {
  // Gammel placeholder bevares for bagudkompatibilitet.
  // Den rigtige terminal åbnes nu via ClientTerminalDialog + WebSocket.
  return getTerminalBrowserWsUrl(id);
}

export function openRemoteDesktop(id) {
  // Åbn frontend-siden for fjernskrivebord.
  // Backend-placeholderen /api/clients/{id}/remote-desktop bruges ikke til
  // Remote Desktop v2, da den rigtige forbindelse kører via WebSocket
  // fra frontend-routen /remote-desktop/:clientId.
  window.open(`/remote-desktop/${id}`, "_blank", "noopener");
}

export function getClientStream(id) {
  return `${apiUrl}/api/clients/${id}/stream`;
}

// ---------------------------------------------------------------------------
// Helligdage
// ---------------------------------------------------------------------------

export async function getHolidays() {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente helligdage"));
  return res.json();
}

export async function addHoliday(date, description) {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ date, description }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke tilføje helligdag"));
  return res.json();
}

export async function deleteHoliday(id) {
  const res = await fetch(`${apiUrl}/api/holidays/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke slette helligdag"));
}

// ---------------------------------------------------------------------------
// Kalender
// ---------------------------------------------------------------------------

export async function saveMarkedDays(payload) {
  const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke gemme kalender"));
  return res.json();
}

/**
 * Hent markerede dage for en klient i en sæson.
 *
 * FIX: Parametrene er (season, client_id) — IKKE (client_id, season).
 * ClientDetailsPageWrapper kaldte tidligere getMarkedDays(id, season)
 * hvilket gav tomme resultater. Korrekt kald: getMarkedDays(season, id).
 *
 * @param {string|number} season      - Sæson ID
 * @param {string|number} client_id   - Klient ID
 * @param {string}        [startDate] - YYYY-MM-DD
 * @param {string}        [endDate]   - YYYY-MM-DD
 */
export async function getMarkedDays(season, client_id, startDate, endDate) {
  const params = new URLSearchParams({
    season: String(season),
    client_id: String(client_id),
  });
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const res = await fetch(
    `${apiUrl}/api/calendar/marked-days?${params.toString()}`,
    { headers: authHeaders(), credentials: "include" }
  );
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) return { markedDays: {} };
  return res.json();
}

export async function getCurrentSeason() {
  const res = await fetch(`${apiUrl}/api/calendar/season`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error("Kunne ikke hente aktuel sæson");
  return res.json();
}

// ---------------------------------------------------------------------------
// Skoler
// ---------------------------------------------------------------------------

export async function getSchools() {
  const res = await fetch(`${apiUrl}/api/schools/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente skoler"));
  return res.json();
}

export async function addSchool(name) {
  const res = await fetch(`${apiUrl}/api/schools/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke tilføje skole"));
  return res.json();
}

export async function getSchoolTimes(schoolId, season) {
  const url = season
    ? `${apiUrl}/api/schools/${schoolId}/season-times/${encodeURIComponent(season)}`
    : `${apiUrl}/api/schools/${schoolId}/times`;
  const res = await fetch(url, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente skoletider"));
  return res.json();
}

export async function updateSchoolTimes(schoolId, season, updates) {
  const res = await fetch(
    `${apiUrl}/api/schools/${schoolId}/season-times/${encodeURIComponent(season)}`,
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(updates),
    }
  );
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke opdatere skoletider"));
  return res.json();
}

export async function applySeasonTimes(schoolId, season) {
  const res = await fetch(
    `${apiUrl}/api/schools/${schoolId}/apply-season-times/${encodeURIComponent(season)}`,
    { method: "POST", headers: authHeaders(), credentials: "include" }
  );
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(
      await extractError(res, "Kunne ikke anvende sæsontider på klienter")
    );
  return res.json();
}

export async function getSeasonSummary() {
  const res = await fetch(`${apiUrl}/api/schools/season-summary`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke hente sæson-oversigt"));
  return res.json();
}

export async function getSchoolClients(schoolId) {
  const res = await fetch(`${apiUrl}/api/schools/${schoolId}/clients/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(
      await extractError(res, "Kunne ikke hente klienter for skole")
    );
  return res.json();
}

export async function deleteSchool(id) {
  const res = await fetch(`${apiUrl}/api/schools/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke slette skole"));
}

export async function updateSchoolName(id, name) {
  const res = await fetch(`${apiUrl}/api/schools/${id}/`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke opdatere skolenavn"));
  return res.json();
}

// ---------------------------------------------------------------------------
// Brugere
// ---------------------------------------------------------------------------

export async function getUsers() {
  const res = await fetch(`${apiUrl}/api/users/`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke hente brugere"));
  return res.json();
}

export async function createUser(userData) {
  const res = await fetch(`${apiUrl}/api/users/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(userData),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke oprette bruger"));
  return res.json();
}

export async function updateUser(id, updates) {
  const res = await fetch(`${apiUrl}/api/users/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke opdatere bruger"));
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${apiUrl}/api/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok) throw new Error(await extractError(res, "Kunne ikke slette bruger"));
}

// ---------------------------------------------------------------------------
// OS opdatering
// ---------------------------------------------------------------------------

export async function requestOsUpdate(clientId) {
  const res = await fetch(`${apiUrl}/api/clients/${clientId}/request-os-update`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke anmode om OS opdatering"));
  return res.json();
}


// ---------------------------------------------------------------------------
// ClientFlow selfupdate
// ---------------------------------------------------------------------------

export async function requestClientflowUpdate(clientId) {
  const res = await fetch(`${apiUrl}/api/clients/${clientId}/clientflow-update`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke anmode om ClientFlow-opdatering"));
  return res.json();
}

// ---------------------------------------------------------------------------
// Livestream
// ---------------------------------------------------------------------------

export async function getLivestreamStatus(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/status/${clientId}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke hente livestream-status"));
  return res.json();
}

export async function startLivestream(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/start/${clientId}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke starte livestream"));
  return res.json();
}

export async function stopLivestream(clientId) {
  const res = await fetch(`${apiUrl}/api/livestream/stop/${clientId}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke stoppe livestream"));
  return res.json();
}

// ---------------------------------------------------------------------------
// Installationskoder / Enrollment tokens
// ---------------------------------------------------------------------------

export async function createEnrollmentToken({ expires_in_hours = 72, note = null } = {}) {
  const res = await fetch(`${apiUrl}/api/admin/enrollment-tokens`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify({ expires_in_hours, note }),
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke oprette installationskode"));
  return res.json();
}

export async function getEnrollmentTokens() {
  const res = await fetch(`${apiUrl}/api/admin/enrollment-tokens`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke hente installationskoder"));
  return res.json();
}

export async function revokeEnrollmentToken(id) {
  const res = await fetch(`${apiUrl}/api/admin/enrollment-tokens/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke tilbagekalde installationskode"));
  return res.json();
}

// ---------------------------------------------------------------------------
// Client-secret administration for existing clients
// ---------------------------------------------------------------------------

export async function getClientSecretStatus(clientId) {
  const res = await fetch(`${apiUrl}/api/clients/${encodeURIComponent(clientId)}/client-secret/status`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke hente client-secret status"));
  return res.json();
}

export async function rotateClientSecret(clientId) {
  const res = await fetch(`${apiUrl}/api/clients/${encodeURIComponent(clientId)}/client-secret/rotate`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke generere client-secret"));
  return res.json();
}

export async function revokeClientSecret(clientId) {
  const res = await fetch(`${apiUrl}/api/clients/${encodeURIComponent(clientId)}/client-secret/revoke`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
  });
  if (res.status === 401) { handle401(); throw new Error("Login udløbet"); }
  if (!res.ok)
    throw new Error(await extractError(res, "Kunne ikke tilbagekalde client-secret"));
  return res.json();
}
