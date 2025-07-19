import React from "react";
import { getStreamUrl } from "../api/clientApi";

// Simple MJPEG stream viewer (kan udvides til WebRTC)
export default function LiveStream({ clientId }) {
  return (
    <div className="livestream">
      <img
        src={getStreamUrl(clientId)}
        alt="Live stream"
        style={{ maxWidth: "100%", border: "1px solid #ccc", borderRadius: 4 }}
      />
    </div>
  );
}
