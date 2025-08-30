import React, { useState, useEffect } from "react";

const API_BASE = "https://kulturskole-infosk-rm.onrender.com/api";
// Her hentes listen af klienter
const CLIENTS_API = `${API_BASE}/clients/public`;

export default function LivestreamTest() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [youtubeId, setYoutubeId] = useState(""); // Hent YouTube id pr. klient her!

  // Hent klienter ved opstart
  useEffect(() => {
    fetch(CLIENTS_API)
      .then(res => res.json())
      .then(data => setClients(data.clients))
      .catch(() => setClients([]));
  }, []);

  // Hent status + YouTube-id for valgt klient
  useEffect(() => {
    if (!selectedClientId) return;
    getStatus(selectedClientId);
    // Hent evt. YouTube-id for klienten, fx fra backend /clients/{id}/
    fetch(`${API_BASE}/clients/${selectedClientId}/`)
      .then(res => res.json())
      .then(data => {
        // Tilpas hvis YouTube-id ligger i et felt på klienten
        setYoutubeId(data.youtube_stream_id || "");
      });
  }, [selectedClientId]);

  const getStatus = async (clientId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/livestream/status/${clientId}`);
      const data = await res.json();
      setStatus(data.active ? "TÆNDT" : "SLUKKET");
    } catch (err) {
      setStatus("FEJL");
    }
    setLoading(false);
  };

  const startLivestream = async (clientId) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/livestream/start/${clientId}`, { method: "POST" });
      await getStatus(clientId);
    } catch (err) {
      setStatus("FEJL");
      setLoading(false);
    }
  };

  const stopLivestream = async (clientId) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/livestream/stop/${clientId}`, { method: "POST" });
      await getStatus(clientId);
    } catch (err) {
      setStatus("FEJL");
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: "2rem" }}>
      <h1>Livestream Testside</h1>
      {/* Vælg klient */}
      <label>
        Vælg klient:{" "}
        <select
          value={selectedClientId || ""}
          onChange={e => setSelectedClientId(e.target.value)}
        >
          <option value="">-- vælg --</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
          ))}
        </select>
      </label>
      {selectedClientId && (
        <>
          <p>Status: <strong>{loading ? "..." : status}</strong></p>
          <button onClick={() => startLivestream(selectedClientId)} disabled={loading}>Tænd livestream</button>
          <button onClick={() => stopLivestream(selectedClientId)} disabled={loading}>Sluk livestream</button>
          <button onClick={() => getStatus(selectedClientId)} disabled={loading}>Opdater status</button>
          {/* Vis YouTube player hvis stream er tændt */}
          {status === "TÆNDT" && youtubeId && (
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
          )}
        </>
      )}
    </div>
  );
}
