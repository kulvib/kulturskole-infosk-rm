import React, { useState, useEffect } from "react";

const API_BASE = "https://kulturskole-infosk-rm.onrender.com/api";
const CLIENTS_API = `${API_BASE}/clients/public`;

export default function LivestreamTest() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [youtubeId, setYoutubeId] = useState("");
  const [error, setError] = useState("");

  // Hent klienter ved opstart
  useEffect(() => {
    setLoading(true);
    fetch(CLIENTS_API)
      .then(res => res.json())
      .then(data => {
        setClients(data.clients || []);
        setLoading(false);
      })
      .catch(() => {
        setClients([]);
        setLoading(false);
        setError("Kunne ikke hente klienter.");
      });
  }, []);

  // Hent status + YouTube-id for valgt klient
  useEffect(() => {
    if (!selectedClientId) {
      setStatus(null);
      setYoutubeId("");
      return;
    }
    getStatus(selectedClientId);
    fetch(`${API_BASE}/clients/${selectedClientId}/`)
      .then(res => res.json())
      .then(data => {
        setYoutubeId(data.youtube_stream_id || "");
      })
      .catch(() => setYoutubeId(""));
  }, [selectedClientId]);

  const getStatus = async (clientId) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/livestream/status/${clientId}`);
      const data = await res.json();
      setStatus(data.active ? "TÆNDT" : "SLUKKET");
    } catch (err) {
      setStatus("FEJL");
      setError("Kunne ikke hente status.");
    }
    setLoading(false);
  };

  const startLivestream = async (clientId) => {
    setLoading(true);
    setError("");
    try {
      await fetch(`${API_BASE}/livestream/start/${clientId}`, { method: "POST" });
      await getStatus(clientId);
    } catch (err) {
      setStatus("FEJL");
      setError("Kunne ikke starte livestream.");
      setLoading(false);
    }
  };

  const stopLivestream = async (clientId) => {
    setLoading(true);
    setError("");
    try {
      await fetch(`${API_BASE}/livestream/stop/${clientId}`, { method: "POST" });
      await getStatus(clientId);
    } catch (err) {
      setStatus("FEJL");
      setError("Kunne ikke stoppe livestream.");
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: "2rem" }}>
      <h1>Livestream Testside</h1>
      {error && <p style={{color: "red"}}>{error}</p>}
      <label>
        Vælg klient:{" "}
        <select
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
          disabled={loading || clients.length === 0}
        >
          <option value="">-- vælg --</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
          ))}
        </select>
      </label>
      {!selectedClientId && <p>Vælg en klient for at styre livestream.</p>}
      {selectedClientId && (
        <>
          <p>Status: <strong>{loading ? "..." : status}</strong></p>
          <button onClick={() => startLivestream(selectedClientId)} disabled={loading}>Tænd livestream</button>
          <button onClick={() => stopLivestream(selectedClientId)} disabled={loading}>Sluk livestream</button>
          <button onClick={() => getStatus(selectedClientId)} disabled={loading}>Opdater status</button>
          {/* Vis YouTube player hvis stream er tændt */}
          {status === "TÆNDT" && youtubeId ? (
            <div style={{ marginTop: "2rem", maxWidth: 720 }}>
              <iframe
                width="100%"
                height="405"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                title="Youtube livestream"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          ) : status === "TÆNDT" && !youtubeId && (
            <p>Ingen YouTube stream-id tilgængelig for denne klient.</p>
          )}
        </>
      )}
    </div>
  );
}
