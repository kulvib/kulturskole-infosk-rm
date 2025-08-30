import React, { useState } from "react";

const API_BASE = "https://kulturskole-infosk-rm.onrender.com/api/livestream";

export default function LivestreamTest() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const getStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setStatus(data.active ? "TÆNDT" : "SLUKKET");
    } catch (err) {
      setStatus("FEJL");
    }
    setLoading(false);
  };

  const startLivestream = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/start`, { method: "POST" });
      await getStatus();
    } catch (err) {
      setStatus("FEJL");
      setLoading(false);
    }
  };

  const stopLivestream = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/stop`, { method: "POST" });
      await getStatus();
    } catch (err) {
      setStatus("FEJL");
      setLoading(false);
    }
  };

  React.useEffect(() => {
    getStatus();
  }, []);

  return (
    <div style={{ margin: "2rem" }}>
      <h1>Livestream Testside</h1>
      <p>Status: <strong>{loading ? "..." : status}</strong></p>
      <button onClick={startLivestream} disabled={loading}>Tænd livestream</button>
      <button onClick={stopLivestream} disabled={loading}>Sluk livestream</button>
      <button onClick={getStatus} disabled={loading}>Opdater status</button>
    </div>
  );
}
