import React, { useEffect, useState } from "react";
import { fetchClients } from "../api/clientApi";
import { Link } from "react-router-dom";

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => setError("Kunne ikke hente klientliste"));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!clients.length) return <div>Indlæser klienter...</div>;

  return (
    <table className="client-table">
      <thead>
        <tr>
          <th>Klientnavn</th>
          <th>Visningsnavn</th>
          <th>Status</th>
          <th>Info</th>
        </tr>
      </thead>
      <tbody>
        {clients.map(client => (
          <tr key={client.id}>
            <td>{client.name}</td>
            <td>{client.display_name}</td>
            <td>
              <span className={client.online ? "status-green" : "status-red"}>
                {client.online ? "Online" : "Offline"}
              </span>
            </td>
            <td>
              <Link to={`/client/${client.id}`}>
                <button>Info</button>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
