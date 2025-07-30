// Henter API-url fra Netlify environment variable
const apiUrl = import.meta.env.VITE_API_URL;

// Eksempel på fetch
export async function getClients() {
  const res = await fetch(`${apiUrl}/api/clients/`, {
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token") // hvis du bruger token
    }
  });
  return await res.json();
}
