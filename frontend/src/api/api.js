// Brug Netlify env variable (Create React App)
const apiUrl = process.env.REACT_APP_API_URL;

// Standard fetch med token fra localStorage
export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });
  return await res.json();
}

// Tilføj de andre API-funktioner på samme måde, fx:
export async function getHolidays() {
  const res = await fetch(`${apiUrl}/api/holidays/`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });
  return await res.json();
}

// osv. til POST, DELETE, APPROVE, REMOVE, etc.
