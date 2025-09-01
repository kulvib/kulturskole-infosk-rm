import React, { useState, useEffect, useRef } from "react";
import {
  getClientsPublic,
  getClient,
  getLivestreamStatus,
  startLivestream,
  stopLivestream,
} from "../api"; // FIXED: changed from "./api" to "../api"

const WS_URL = "wss://kulturskole-infosk-rm.onrender.com/ws";

export default function LivestreamTest() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [youtubeId, setYoutubeId] = useState("");
  const [error, setError] = useState("");
  const [wsImage, setWsImage] = useState(null);
  const ws = useRef(null);

  // Hent klienter ved opstart
  useEffect(() => {
    setLoading(true);
    getClientsPublic()
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
      setWsImage(null);
      return;
    }
    setLoading(true);
    Promise.all([
      getLivestreamStatus(selectedClientId),
      getClient(selectedClientId),
    ])
      .then(([livestreamData, clientData]) => {
        setStatus(livestreamData.active ? "TÆNDT" : "SLUKKET");
        setYoutubeId(clientData.youtube_stream_id || "");
        setLoading(false);
      })
      .catch(() => {
        setStatus("FEJL");
        setYoutubeId("");
        setLoading(false);
        setError("Kunne ikke hente status eller YouTube-id.");
      });
  }, [selectedClientId]);

  // WebSocket til billedstream fra valgt klient
  useEffect(() => {
    if (!selectedClientId) {
      setWsImage(null);
      ws.current && ws.current.close();
      return;
    }
    ws.current = new window.WebSocket(WS_URL);
    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: "watch", client_id: selectedClientId }));
    };
    ws.current.onmessage = (event) => {
      setWsImage(event.data); // base64 image
    };
    ws.current.onclose = () => {};
    return () => {
      ws.current && ws.current.close();
    };
  }, [selectedClientId]);

  const handleStartLivestream = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError("");
    try {
      await startLivestream(selectedClientId);
      const data = await getLivestreamStatus(selectedClientId);
      setStatus(data.active ? "TÆNDT" : "SLUKKET");
    } catch (err) {
      setStatus("FEJL");
      setError("Kunne ikke starte livestream.");
    }
    setLoading(false);
  };

  const handleStopLivestream = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError("");
    try {
      await stopLivestream(selectedClientId);
      const data = await getLivestreamStatus(selectedClientId);
      setStatus(data.active ? "TÆNDT" : "SLUKKET");
    } catch (err) {
      setStatus("FEJL");
      setError("Kunne ikke stoppe livestream.");
    }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getLivestreamStatus(selectedClientId);
      setStatus(data.active ? "TÆNDT" : "SLUKKET");
    } catch (err) {
      setStatus("FEJL");
      setError("Kunne ikke hente status.");
    }
    setLoading(false);
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
          <button onClick={handleStartLivestream} disabled={loading}>Tænd livestream</button>
          <button onClick={handleStopLivestream} disabled={loading}>Sluk livestream</button>
          <button onClick={handleUpdateStatus} disabled={loading}>Opdater status</button>
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
          {/* Direkte billedstream fra klient via WebSocket */}
          <div style={{marginTop: "2rem", maxWidth: 720}}>
            <h3>Direkte billedstream (WebSocket)</h3>
            {wsImage ? (
              <img
                src={`data:image/jpeg;base64,${wsImage}`}
                alt="Livestream"
                style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
              />
            ) : (
              <p style={{color: "#888", fontStyle: "italic"}}>
                Ingen livestream billede endnu...
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
