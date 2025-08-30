import React, { useState } from "react";

const API_BASE = "https://kulturskole-infosk-rm.onrender.com/api/livestream";
// Sæt din YouTube livestream video-id her:
const YOUTUBE_ID = "DIN_YOUTUBE_STREAM_ID"; // fx "dQw4w9WgXcQ"

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
      {/* Vis YouTube player hvis stream er tændt */}
      {status === "TÆNDT" && (
        <div style={{ marginTop: "2rem", maxWidth: 720 }}>
          <iframe
            width="100%"
            height="405"
            src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1`}
            title="Youtube livestream"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
