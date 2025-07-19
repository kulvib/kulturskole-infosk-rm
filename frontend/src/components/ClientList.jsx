import React, { useEffect, useState } from "react";
import { fetchClients } from "../api/clientApi";
import { Link } from "react-router-dom";

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClients()
      .then(data => {
        console.log("clients-list", data);
        // Hvis data er et objekt med en clients-array, brug data.clients
        setClients(Array.isArray(data) ? data : data.clients || []);
      })
      .catch(() => setError("Kunne ikke hente klientliste"));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!clients.length && !error) return <div>Indlæser klienter...</div>;
  if (clients.length === 0 && !error) return <div>Ingen klienter fundet.</div>;

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
