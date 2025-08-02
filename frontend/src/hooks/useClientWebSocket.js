import { useEffect } from "react";

export function useClientWebSocket(fetchClients) {
  useEffect(() => {
    // Bemærk: wss:// for sikker forbindelse til din backend
    const ws = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");
    ws.onmessage = (event) => {
      if (event.data === "update") {
        fetchClients();
      }
    };

    // Hold forbindelsen åben med ping hver 30 sekunder
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.send("ping");
    }, 30000);

    return () => {
      ws.close();
      clearInterval(pingInterval);
    };
  }, [fetchClients]);
}
