import { useEffect, useRef } from "react";

export function useClientWebSocket(onUpdate) {
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    function connect() {
      ws = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");
      wsRef.current = ws;

      ws.onopen = () => ws.send("frontend connected!");

      ws.onmessage = (event) => {
        if (event.data === "update" && typeof onUpdate === "function") {
          onUpdate();
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {};
    }

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send("ping");
      }
    }, 30000);

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Undgå auto-reconnect ved cleanup
        wsRef.current.close();
      }
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
    };
  }, [onUpdate]);
}
