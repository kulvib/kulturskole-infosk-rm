import { useEffect, useRef } from "react";

export function useClientWebSocket(fetchClients) {
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send("frontend connected!");
      };

      ws.onmessage = (event) => {
        if (event.data === "update" && typeof fetchClients === "function") {
          fetchClients();
        }
      };

      ws.onclose = () => {
        // reconnect efter 2 sekunder
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
  }, [fetchClients]);
}
