const BASE_URL = "http://localhost:8000/api";

export async function getClients(token) {
  const res = await fetch(`${BASE_URL}/clients/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Auth fejlede");
  return await res.json();
}

export async function getHolidays(token) {
  const res = await fetch(`${BASE_URL}/holidays/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Auth fejlede");
  return await res.json();
}

export async function addHoliday(token, {date, description}) {
  const res = await fetch(`${BASE_URL}/holidays/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({date, description}),
  });
  if (!res.ok) throw new Error("Oprettelse fejlede");
  return await res.json();
}
