import { useEffect, useRef } from "react";

export function useClientWebSocket(onUpdate) {
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let intentionalClose = false;

    function connect() {
      console.debug("[WebSocket] Connecting...");
      ws = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");
      wsRef.current = ws;

      ws.onopen = () => {
        console.debug("[WebSocket] Connected");
        ws.send("frontend connected!");
      };

      ws.onmessage = (event) => {
        console.debug("[WebSocket] Message received:", event.data);
        if (event.data === "update" && typeof onUpdate === "function") {
          onUpdate();
        }
      };

      ws.onclose = (event) => {
        console.debug("[WebSocket] Closed", event);
        if (!intentionalClose) {
          console.debug("[WebSocket] Reconnecting in 2s...");
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error("[WebSocket] Error:", err);
      };
    }

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.debug("[WebSocket] Sending ping");
        wsRef.current.send("ping");
      }
    }, 30000);

    return () => {
      intentionalClose = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          console.debug("[WebSocket] Closing connection (unmount)");
          wsRef.current.close();
        }
      }
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
    };
  }, [onUpdate]);
}
