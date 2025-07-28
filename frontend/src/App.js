import React, { useEffect, useState } from "react";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("access_token") || "");
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login-funktion
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        setToken(data.access_token);
        setUsername("");
        setPassword("");
      } else {
        setError(data.detail || "Login fejlede");
      }
    } catch (err) {
      setError("Login fejlede");
    }
    setLoading(false);
  };

  // Hent klienter
  const fetchClients = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      } else {
        setError("Kunne ikke hente klienter");
      }
    } catch {
      setError("Kunne ikke hente klienter");
    }
    setLoading(false);
  };

  // Godkend klient
  const approveClient = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchClients();
      } else {
        setError("Kunne ikke godkende klient");
      }
    } catch {
      setError("Kunne ikke godkende klient");
    }
    setLoading(false);
  };

  // Fjern klient
  const removeClient = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}/remove`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchClients();
      } else {
        setError("Kunne ikke fjerne klient");
      }
    } catch {
      setError("Kunne ikke fjerne klient");
    }
    setLoading(false);
  };

  // Hent klienter når token ændrer sig
  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line
  }, [token]);

  // Log ud
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setToken("");
    setClients([]);
    setError("");
  };

  return (
    <div style={{ maxWidth: 650, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>Infoskærm Admin</h2>
      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
      {loading && <div>Indlæser...</div>}
      {!token ? (
        <form onSubmit={handleLogin} style={{ marginBottom: 30 }}>
          <div>
            <label>Brugernavn: </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label>Kodeord: </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading}>Log ind</button>
        </form>
      ) : (
        <div>
          <button onClick={handleLogout} style={{ marginBottom: 20 }}>Log ud</button>
          <h3>Klienter</h3>
          <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#eee" }}>
              <tr>
                <th>ID</th>
                <th>Navn</th>
                <th>Lokalitet</th>
                <th>Status</th>
                <th>IP</th>
                <th>MAC</th>
                <th>Godkend</th>
                <th>Fjern</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>Ingen klienter fundet</td>
                </tr>
              ) : (
                clients.map(client => (
                  <tr key={client.id}>
                    <td>{client.id}</td>
                    <td>{client.name || client.unique_id}</td>
                    <td>{client.locality || ""}</td>
                    <td>{client.status}</td>
                    <td>{client.ip_address || client.ip}</td>
                    <td>{client.mac_address || client.mac}</td>
                    <td>
                      {client.status !== "approved" && (
                        <button onClick={() => approveClient(client.id)} disabled={loading}>
                          Godkend
                        </button>
                      )}
                    </td>
                    <td>
                      <button onClick={() => removeClient(client.id)} disabled={loading}>
                        Fjern
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
