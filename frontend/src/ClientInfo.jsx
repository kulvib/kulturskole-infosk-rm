import React, { useEffect, useState } from "react";
import { fetchClient, setCustomName, setWebUrl, sendClientCommand } from "./api";
import Terminal from "./Terminal";
import Stream from "./Stream";

export default function ClientInfo({ token, clientId, onClose, onLogout }) {
  const [client, setClient] = useState(null);
  const [customName, setCustomNameState] = useState("");
  const [webUrl, setWebUrlState] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [showStream, setShowStream] = useState(false);

  function refresh() {
    fetchClient(token, clientId).then(data => {
      setClient(data);
      setCustomNameState(data.custom_name || "");
      setWebUrlState(data.web_url || "");
    });
  }

  useEffect(() => { refresh(); }, [clientId, token]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await setCustomName(token, clientId, customName);
      await setWebUrl(token, clientId, webUrl);
      setMessage("Gemt!");
      refresh();
    } catch {
      setMessage("Fejl ved gem!");
    } finally {
      setSaving(false);
    }
  }

  async function handleCommand(cmd) {
    await sendClientCommand(token, clientId, cmd);
    setMessage(`Kommando sendt: ${cmd}`);
  }

  if (!client) return <div>Henter data...</div>;

  return (
    <div>
      <button onClick={onClose}>← Tilbage</button>
      <button style={{ float: "right" }} onClick={onLogout}>Log ud</button>
      <h2>{client.static_name} <small>({client.id})</small></h2>
      <form onSubmit={handleSave}>
        <div>
          <label>Visningsnavn:</label>
          <input value={customName} onChange={e => setCustomNameState(e.target.value)} />
        </div>
        <div>
          <label>Web-adresse:</label>
          <input value={webUrl} onChange={e => setWebUrlState(e.target.value)} />
        </div>
        <button type="submit" disabled={saving}>{saving ? "Gemmer..." : "Gem"}</button>
        {message && <span style={{ marginLeft: 10 }}>{message}</span>}
      </form>
      <h3>Klientdata</h3>
      <ul>
        <li>IP: {client.clientdata?.ip || <em>ukendt</em>}</li>
        <li>Version: {client.clientdata?.version || <em>ukendt</em>}</li>
        <li>Sidst set: {client.last_seen ? new Date(client.last_seen).toLocaleString("da-DK") : <em>ukendt</em>}</li>
        <li>Uptime: {client.clientdata?.uptime || <em>ukendt</em>}</li>
      </ul>
      <h3>Handlinger</h3>
      <button onClick={() => handleCommand("chrome_shutdown")}>Chrome shutdown</button>
      <button onClick={() => handleCommand("start")}>Start</button>
      <button onClick={() => handleCommand("restart")}>Genstart</button>
      <button onClick={() => handleCommand("shutdown")}>Shutdown</button>
      <button onClick={() => setShowTerminal(s => !s)}>{showTerminal ? "Luk terminal" : "Åbn terminal"}</button>
      <button onClick={() => setShowStream(s => !s)}>{showStream ? "Luk livestream" : "Åbn livestream"}</button>
      {showTerminal && <Terminal clientId={clientId} token={token} />}
      {showStream && <Stream clientId={clientId} />}
    </div>
  );
}
