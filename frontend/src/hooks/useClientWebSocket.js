import { useEffect, useRef } from "react";

export function useClientLiveWebSocket({ url, onUpdate }) {
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send("frontend connected!");
      };

      ws.onmessage = (event) => {
        if (event.data === "update" && typeof onUpdate === "function") {
          onUpdate();
        }
      };

      ws.onclose = () => {
        // Reconnect efter 2 sekunder
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {};
    };

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === 1) wsRef.current.send("ping");
    }, 30000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
    };
  }, [url, onUpdate]);
}
