import React, { useEffect, useState } from "react";
import { fetchClients } from "./api";

export default function Dashboard({ token, onSelectClient }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients(token).then(setClients).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div>Henter klienter...</div>;

  return (
    <div>
      <h2>Klientliste</h2>
      <table border="1" cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Klientnavn</th>
            <th>Visningsnavn</th>
            <th>Status</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id}>
              <td>{c.static_name}</td>
              <td>{c.custom_name || <em>–</em>}</td>
              <td style={{ color: c.status === "online" ? "green" : "red" }}>
                {c.status}
              </td>
              <td>
                <button onClick={() => onSelectClient(c.id)}>Info</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
