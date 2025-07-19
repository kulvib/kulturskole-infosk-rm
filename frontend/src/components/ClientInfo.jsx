import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchClient, updateClient } from "../api/clientApi";
import ClientActions from "./ClientActions";
import LiveStream from "./LiveStream";
import Terminal from "./Terminal";

export default function ClientInfo() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [webAddr, setWebAddr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchClient(clientId)
      .then(data => {
        setClient(data);
        setDisplayName(data.display_name || "");
        setWebAddr(data.web_addr || "");
      })
      .catch(() => setError("Kunne ikke hente klientdata"));
  }, [clientId]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateClient(clientId, {
        display_name: displayName,
        web_addr: webAddr,
      });
      // Genhent for at opdatere visning
      const updated = await fetchClient(clientId);
      setClient(updated);
    } catch {
      setError("Kunne ikke gemme ændringer");
    }
    setSaving(false);
  }

  if (error) return <div className="error">{error}</div>;
  if (!client) return <div>Indlæser klientdata...</div>;

  return (
    <div className="client-info">
      <button onClick={() => navigate(-1)} style={{marginBottom:12}}>← Tilbage</button>
      <h2>Klient: {client.name}</h2>
      <form onSubmit={handleSave} className="client-edit-form">
        <label>
          Visningsnavn:
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          Web-adresse (åbnes af Chrome):
          <input
            type="text"
            value={webAddr}
            onChange={e => setWebAddr(e.target.value)}
            placeholder="https://..."
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Gemmer..." : "Gem ændringer"}
        </button>
      </form>
      <div style={{marginTop:24}}>
        <b>Klientdata:</b>
        <ul>
          <li>IP: {client.ip}</li>
          <li>Version: {client.version}</li>
          <li>Sidst set: {client.last_seen}</li>
          <li>Uptime: {client.uptime}</li>
        </ul>
      </div>
      <ClientActions clientId={clientId} />
      <h3>Live stream</h3>
      <LiveStream clientId={clientId} />
      <h3>Terminal</h3>
      <Terminal clientId={clientId} />
    </div>
  );
}
