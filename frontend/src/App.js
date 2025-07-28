import React, { useEffect, useState } from "react";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const token = "PASTE_YOUR_JWT_TOKEN_HERE"; // Sæt din gyldige admin JWT-token her

function App() {
  const [clients, setClients] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Hent klienter
  const fetchClients = async () => {
    setLoading(true);
    setError("");
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

  // Hent fridage
  const fetchHolidays = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/holidays/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      } else {
        setError("Kunne ikke hente fridage");
      }
    } catch {
      setError("Kunne ikke hente fridage");
    }
    setLoading(false);
  };

  // Tilføj fridag
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/holidays/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: holidayDate,
          description: holidayDesc,
        }),
      });
      if (res.ok) {
        setHolidayDate("");
        setHolidayDesc("");
        fetchHolidays();
      } else {
        setError("Kunne ikke tilføje fridag");
      }
    } catch {
      setError("Kunne ikke tilføje fridag");
    }
    setLoading(false);
  };

  // Slet fridag
  const handleDeleteHoliday = async (id) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/holidays/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchHolidays();
      } else {
        setError("Kunne ikke slette fridag");
      }
    } catch {
      setError("Kunne ikke slette fridag");
    }
    setLoading(false);
  };

  // Godkend klient
  const approveClient = async (id) => {
    setLoading(true);
    setError("");
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
    setError("");
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

  // Hent data ved mount
  useEffect(() => {
    fetchClients();
    fetchHolidays();
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>Infoskærm Admin</h2>
      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
      {loading && <div>Indlæser...</div>}
      <div>
        <h3>Klienter</h3>
        <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
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
        <h3>Fridage</h3>
        <form onSubmit={handleAddHoliday} style={{ marginBottom: 20 }}>
          <input
            type="date"
            value={holidayDate}
            onChange={e => setHolidayDate(e.target.value)}
            required
            style={{ marginRight: 10 }}
          />
          <input
            placeholder="Beskrivelse"
            value={holidayDesc}
            onChange={e => setHolidayDesc(e.target.value)}
            required
            style={{ marginRight: 10 }}
          />
          <button type="submit" disabled={loading}>Tilføj fridag</button>
        </form>
        <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#eee" }}>
            <tr>
              <th>Dato</th>
              <th>Beskrivelse</th>
              <th>Slet</th>
            </tr>
          </thead>
          <tbody>
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center" }}>Ingen fridage registreret</td>
              </tr>
            ) : (
              holidays.map(h => (
                <tr key={h.id}>
                  <td>{h.date ? h.date.slice(0, 10) : ""}</td>
                  <td>{h.description}</td>
                  <td>
                    <button onClick={() => handleDeleteHoliday(h.id)} disabled={loading}>
                      Slet
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
