// src/api.js
// Centralisér alle API-kald her og brug environment variable til API-url

const apiUrl = process.env.REACT_APP_API_URL;

// Hjælpefunktion til at hente token fra localStorage (eller anden kilde)
function getToken() {
  return localStorage.getItem("token");
}

// Hent alle klienter
export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke hente klienter");
  return await res.json();
}

// Hent alle helligdage
export async function getHolidays() {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke hente helligdage");
  return await res.json();
}

// Tilføj helligdag
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

// Slet helligdag
export async function deleteHoliday(id) {
  const res = await fetch(`${apiUrl}/api/holidays/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke slette helligdag");
}

// Godkend klient
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

// Fjern klient
export async function removeClient(id) {
  const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke fjerne klient");
}
