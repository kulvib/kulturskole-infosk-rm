import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function ClientInfo() {
  const { clientId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [err, setErr] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL || "/api"}/clients/${encodeURIComponent(clientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setClient(res.data);
        setDisplayName(res.data.display_name);
        setWebUrl(res.data.web_url);
      })
      .catch(() => setErr("Kunne ikke hente klientdata"));
  }, [token, clientId]);

  async function saveDisplayName() {
    setSaving(true);
    setErr("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/clients/${encodeURIComponent(clientId)}/set_display_name`,
        null,
        {
          params: { display_name: displayName },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch {
      setErr("Kunne ikke gemme visningsnavn");
    }
    setSaving(false);
  }

  async function saveWebUrl() {
    setSaving(true);
    setErr("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/clients/${encodeURIComponent(clientId)}/set_web_url`,
        null,
        {
          params: { web_url: webUrl },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch {
      setErr("Kunne ikke gemme webadresse");
    }
    setSaving(false);
  }

  async function sendCommand(cmd) {
    setSaving(true);
    setErr("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/clients/${encodeURIComponent(clientId)}/command`,
        null,
        {
          params: { command: cmd },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch {
      setErr("Kunne ikke sende kommando");
    }
    setSaving(false);
  }

  if (!client) return <div>Indlæser ...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto" }}>
      <button onClick={() => navigate("/")}>Tilbage</button>
      <h2>Info på: {client.id}</h2>
      {err && <div style={{ color: "red" }}>{err}</div>}
      <div>
        <label>Visningsnavn:</label>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          style={{ width: "80%" }}
        />
        <button onClick={saveDisplayName} disabled={saving}>Gem</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <label>Webadresse (åbnes automatisk på klient):</label>
        <input
          value={webUrl}
          onChange={e => setWebUrl(e.target.value)}
          style={{ width: "80%" }}
        />
        <button onClick={saveWebUrl} disabled={saving}>Gem</button>
      </div>
      <div style={{ marginTop: 24 }}>
        <strong>Klientdata:</strong>
        <ul>
          <li>IP: {client.ip}</li>
          <li>Version: {client.version}</li>
          <li>Sidst set: {client.last_seen || "ukendt"}</li>
          <li>Uptime: {client.uptime}s</li>
        </ul>
      </div>
      <div style={{ marginTop: 24 }}>
        <strong>Handlinger:</strong>
        <div>
          <button onClick={() => sendCommand("chrome:shutdown")} disabled={saving}>
            Luk Chrome
          </button>
          <button onClick={() => sendCommand("client:start")} disabled={saving}>
            Start klient
          </button>
          <button onClick={() => sendCommand("client:restart")} disabled={saving}>
            Genstart klient
          </button>
          <button onClick={() => sendCommand("client:shutdown")} disabled={saving}>
            Sluk klient
          </button>
        </div>
      </div>
      <div style={{ marginTop: 32 }}>
        <strong>Terminal (WebSocket):</strong>
        <div style={{ border: "1px solid #ddd", padding: 8, background: "#222", color: "#fff" }}>
          <em>Terminalfunktion kan integreres her (kræver backend support).</em>
        </div>
      </div>
      <div style={{ marginTop: 32 }}>
        <strong>Livestream:</strong>
        <div>
          {/* MJPEG stream eksempel */}
          <img
            src={`http://${client.ip}:8081/`}
            alt="Livestream"
            style={{ maxWidth: "100%", border: "1px solid #ddd" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      </div>
    </div>
  );
}
