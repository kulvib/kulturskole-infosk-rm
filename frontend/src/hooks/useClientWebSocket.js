import { useEffect } from "react";

export function useClientWebSocket(fetchClients) {
  useEffect(() => {
    // Brug wss:// hvis du kører over https, ellers ws://
    const ws = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");
    ws.onmessage = (event) => {
      if (event.data === "update") {
        fetchClients();
      }
    };

    // Hold forbindelsen åben med ping hver 30 sek
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.send("ping");
    }, 30000);

    return () => {
      ws.close();
      clearInterval(pingInterval);
    };
  }, [fetchClients]);
}
