import { useEffect, useRef } from "react";

export function useClientLiveWebSocket({ url, onUpdate }) {
  const wsRef = useRef(null);

  useEffect(() => {
    let ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send("frontend connected!");
    };

    ws.onmessage = (event) => {
      if (event.data === "update" && typeof onUpdate === "function") {
        onUpdate();
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.send("ping");
    }, 30000);

    ws.onerror = (event) => {
      // console.warn("WebSocket error", event);
    };

    ws.onclose = (event) => {
      // Evt. reconnect logic her
      // console.warn("WebSocket closed", event);
    };

    return () => {
      ws.close();
      clearInterval(pingInterval);
    };
  }, [url, onUpdate]);
}
