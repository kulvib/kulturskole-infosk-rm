import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../auth/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

const statusColor = (status) =>
  status === "online" ? "#27ae60" : "#c0392b";

export default function Clients() {
  const { token, logout } = useAuth();
  const [clients, setClients] = useState([]);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL || "/api"}/clients`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setClients(res.data))
      .catch((e) => {
        setErr("Kunne ikke hente klienter");
        if (e.response?.status === 401) logout();
      });
  }, [token, logout]);

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto" }}>
      <h2>Klientoversigt</h2>
      <button onClick={logout} style={{ float: "right" }}>Log ud</button>
      {err && <div style={{ color: "red" }}>{err}</div>}
      <table style={{ width: "100%", marginTop: 24, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Klientnavn</th>
            <th>Visningsnavn</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>
                <span
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    background: statusColor(c.status),
                    borderRadius: "50%",
                  }}
                  title={c.status}
                />
              </td>
              <td>{c.id}</td>
              <td>{c.display_name}</td>
              <td>
                <button onClick={() => navigate(`/client/${encodeURIComponent(c.id)}`)}>
                  Info
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
