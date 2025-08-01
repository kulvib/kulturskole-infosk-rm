const apiUrl = process.env.REACT_APP_API_URL || "https://kulturskole-infosk-rm.onrender.com";

/**
 * Hent token fra localStorage
 */
function getToken() {
  return localStorage.getItem("token");
}

/**
 * Login og hent access token
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{access_token: string, token_type: string}>}
 */
export async function login(username, password) {
  const res = await fetch(`${apiUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) throw new Error("Forkert brugernavn eller kodeord");
  return await res.json();
}

/**
 * Hent alle klienter (kræver authentication)
 * @returns {Promise<any[]>}
 */
export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke hente klienter");
  return await res.json();
}

/**
 * Hent alle helligdage (kræver authentication)
 * @returns {Promise<any[]>}
 */
export async function getHolidays() {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke hente helligdage");
  return await res.json();
}

/**
 * Tilføj ny helligdag (kræver authentication)
 * @param {string} date
 * @param {string} description
 * @returns {Promise<any>}
 */
export async function addHoliday(date, description) {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + getToken(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, description }),
  });
  if (!res.ok) throw new Error("Kunne ikke tilføje helligdag");
  return await res.json();
}

/**
 * Slet en helligdag (kræver authentication)
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export async function deleteHoliday(id) {
  const res = await fetch(`${apiUrl}/api/holidays/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke slette helligdag");
}

/**
 * Godkend en klient (kræver authentication)
 * @param {string|number} id
 * @returns {Promise<any>}
 */
export async function approveClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke godkende klient");
  return await res.json();
}

/**
 * Fjern en klient (kræver authentication)
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export async function removeClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke fjerne klient");
}
