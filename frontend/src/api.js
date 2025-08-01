import { useAuth } from "./auth/authcontext";

const apiUrl = process.env.REACT_APP_API_URL || "https://kulturskole-infosk-rm.onrender.com";

/**
 * Custom hook til at få adgang til API-funktionerne med token fra context
 */
export function useApi() {
  const { token } = useAuth();

  /**
   * Login and fetch access token
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{access_token: string, token_type: string}>}
   */
  async function login(username, password) {
    const res = await fetch(`${apiUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) throw new Error("Forkert brugernavn eller kodeord");
    return await res.json(); // { access_token, token_type }
  }

  /**
   * Get all clients (requires authentication)
   * @returns {Promise<any[]>}
   */
  async function getClients() {
    const res = await fetch(`${apiUrl}/api/clients/`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    if (!res.ok) throw new Error("Kunne ikke hente klienter");
    return await res.json();
  }

  /**
   * Get all holidays (requires authentication)
   * @returns {Promise<any[]>}
   */
  async function getHolidays() {
    const res = await fetch(`${apiUrl}/api/holidays/`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    if (!res.ok) throw new Error("Kunne ikke hente helligdage");
    return await res.json();
  }

  /**
   * Add a new holiday (requires authentication)
   * @param {string} date
   * @param {string} description
   * @returns {Promise<any>}
   */
  async function addHoliday(date, description) {
    const res = await fetch(`${apiUrl}/api/holidays/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date, description }),
    });
    if (!res.ok) throw new Error("Kunne ikke tilføje helligdag");
    return await res.json();
  }

  /**
   * Delete a holiday (requires authentication)
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async function deleteHoliday(id) {
    const res = await fetch(`${apiUrl}/api/holidays/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    if (!res.ok) throw new Error("Kunne ikke slette helligdag");
  }

  /**
   * Approve a client (requires authentication)
   * @param {string|number} id
   * @returns {Promise<any>}
   */
  async function approveClient(id) {
    const res = await fetch(`${apiUrl}/api/clients/${id}/approve`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    if (!res.ok) throw new Error("Kunne ikke godkende klient");
    return await res.json();
  }

  /**
   * Remove a client (requires authentication)
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async function removeClient(id) {
    const res = await fetch(`${apiUrl}/api/clients/${id}/remove`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    if (!res.ok) throw new Error("Kunne ikke fjerne klient");
  }

  // Evt. tilføj flere endpoints her...

  return {
    login,
    getClients,
    getHolidays,
    addHoliday,
    deleteHoliday,
    approveClient,
    removeClient,
  };
}
