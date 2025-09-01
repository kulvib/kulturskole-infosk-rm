export const apiUrl = process.env.REACT_APP_API_URL || "https://kulturskole-infosk-rm.onrender.com";

// TOKEN
export function getToken() {
  return localStorage.getItem("token");
}

// LOGIN
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

// HENT KLIENTER (login)
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

// HENT KLIENT-LISTE PUBLIC
export async function getClientsPublic() {
  const res = await fetch(`${apiUrl}/api/clients/public`);
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

// HENT ÉN KLIENT (login)
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

// OPDATÉR KLIENT (login)
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

// GODKEND KLIENT
export async function approveClient(id, school_id) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const opts = {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: school_id ? JSON.stringify({ school_id }) : undefined,
  };
  const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, opts);
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

// FJERN KLIENT
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

// KIOSK URL
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

// KLIENT ACTIONS
export async function clientAction(id, action) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");

  let url = "";
  let body = null;
  let method = "POST";

  if (action === "restart") {
    url = `${apiUrl}/api/clients/${id}/restart`;
  } else if (action === "shutdown") {
    url = `${apiUrl}/api/clients/${id}/shutdown`;
  } else if (action === "chrome-shutdown") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    body = JSON.stringify({ action: "stop" });
  } else if (action === "chrome-start") {
    url = `${apiUrl}/api/clients/${id}/chrome-command`;
    body = JSON.stringify({ action: "start" });
  } else {
    url = `${apiUrl}/api/clients/${id}/action`;
    body = JSON.stringify({ action });
  }

  const headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body,
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

// SÆT KLIENTENS STATE (fx til 'normal' eller 'sleep')
export async function setClientState(id, state) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/clients/${id}/state`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) {
    let msg = "Kunne ikke sætte klientens tilstand";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
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

// HELLIGDAGE / KALENDER
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

export async function saveMarkedDays(payload) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
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

// OPDATERET! Nu med startDate og endDate som optionale parametre
export async function getMarkedDays(season, client_id, startDate, endDate) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const params = new URLSearchParams({
    season,
    client_id,
  });
  if (startDate) params.append("start_date", startDate.toISOString().slice(0, 10));
  if (endDate) params.append("end_date", endDate.toISOString().slice(0, 10));

  const res = await fetch(`${apiUrl}/api/calendar/marked-days?${params.toString()}`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    return { markedDays: {} };
  }
  return await res.json();
}

export async function getCurrentSeason() {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/calendar/season`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    throw new Error("Kunne ikke hente aktuel sæson");
  }
  return await res.json();
}

// SKOLER
export async function getSchools() {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/schools/`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    let msg = "Kunne ikke hente skoler";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function addSchool(name) {
  const token = getToken();
  if (!token) throw new Error("Token mangler - du er ikke logget ind");
  const res = await fetch(`${apiUrl}/api/schools/`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    let msg = "Kunne ikke tilføje skole";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

// LIVESTREAM API FUNKTIONER PR. KLIENT
export async function getLivestreamStatus(clientId) {
  const token = getToken();
  const res = await fetch(`${apiUrl}/api/livestream/status/${clientId}`, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!res.ok) {
    let msg = "Kunne ikke hente livestream-status";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json(); // {active: true/false}
}

export async function startLivestream(clientId) {
  const token = getToken();
  const res = await fetch(`${apiUrl}/api/livestream/start/${clientId}`, {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!res.ok) {
    let msg = "Kunne ikke starte livestream";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function stopLivestream(clientId) {
  const token = getToken();
  const res = await fetch(`${apiUrl}/api/livestream/stop/${clientId}`, {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!res.ok) {
    let msg = "Kunne ikke stoppe livestream";
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

// SÆT KLIENTENS STATE TIL 'normal' EFTER DVALE
// Brug: await setClientState(id, "normal");
