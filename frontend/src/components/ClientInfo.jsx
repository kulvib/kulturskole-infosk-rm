import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchClient, updateClient, approveClient } from "../api/clientApi";
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
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const navigate = useNavigate();

  // Hent klientdata
  useEffect(() => {
    fetchClient(clientId)
      .then(data => {
        setClient(data);
        setDisplayName(data.display_name || "");
        setWebAddr(data.web_addr || "");
      })
      .catch(() => setError("Kunne ikke hente klientdata"));
    // eslint-disable-next-line
  }, [clientId]);

  // Gem ændringer
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

  // Godkend klient
  async function handleApprove() {
    setApproving(true);
    setApproveError("");
    try {
      await approveClient(clientId);
      // Genhent for at opdatere visning
      const updated = await fetchClient(clientId);
      setClient(updated);
    } catch {
      setApproveError("Kunne ikke godkende klienten");
    }
    setApproving(false);
  }

  if (error) return <div className="error">{error}</div>;
  if (!client) return <div>Indlæser klientdata...</div>;

  // For debugging: se objektet i browserens konsol
  console.log("client-data", client);

  return (
    <div className="client-info">
      <button onClick={() => navigate(-1)} style={{marginBottom:12}}>← Tilbage</button>
      <h2>Klient: {client.name}</h2>
      {/* Godkend-knap hvis pending */}
      {client.status === "pending" && (
        <div style={{marginBottom:16}}>
          <button 
            onClick={handleApprove} 
            disabled={approving}
            style={{background:"orange", color:"black", fontWeight:600, marginRight:8}}
          >
            {approving ? "Godkender..." : "Godkend klient"}
          </button>
          {approveError && <span style={{color:"red"}}>{approveError}</span>}
        </div>
      )}

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
          <li>IP: {client.ip || <i>ukendt</i>}</li>
          <li>Version: {client.version || <i>ukendt</i>}</li>
          <li>Sidst set: {client.last_seen || <i>ukendt</i>}</li>
          <li>Uptime: {client.uptime || <i>ukendt</i>}</li>
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
