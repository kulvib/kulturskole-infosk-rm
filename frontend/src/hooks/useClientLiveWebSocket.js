import { useEffect } from "react";

/**
 * Custom hook til live WebSocket-opdatering.
 * @param {Object} options - { url: string, onUpdate: function }
 */
export function useClientLiveWebSocket({ url, onUpdate }) {
  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      // Send initial besked hvis backend forventer det (kan evt. fjernes)
      ws.send("frontend connected!");
    };

    ws.onmessage = (event) => {
      if (event.data === "update" && typeof onUpdate === "function") {
        onUpdate();
      }
    };

    // Hold forbindelsen åben med ping (valgfrit)
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.send("ping");
    }, 30000);

    return () => {
      ws.close();
      clearInterval(pingInterval);
    };
  }, [url, onUpdate]);
}
