const apiUrl = process.env.REACT_APP_API_URL;

function getToken() {
  return localStorage.getItem("token");
}

export async function login(username, password) {
  const res = await fetch(`${apiUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) throw new Error("Forkert brugernavn eller kodeord");
  return await res.json(); // { access_token, token_type }
}

export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });
  if (!res.ok) throw new Error("Kunne ikke hente klienter");
  return await res.json();
}

// ... resten af dine API-funktioner her (getHolidays, addHoliday, osv.)
