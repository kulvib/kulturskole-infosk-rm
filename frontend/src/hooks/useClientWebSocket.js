import { useEffect, useRef } from "react";

/**
 * Lytter på WebSocket-events fra backend og kalder callback ved opdatering.
 * @param {Function} onClientsChanged - Callback der skal køres ved klientændringer.
 */
export function useClientWebSocket(onClientsChanged) {
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");

    ws.current.onopen = () => {
      // Forbindelse etableret (kan evt. sende besked)
    };

    ws.current.onmessage = (event) => {
      try {
        // Forsøg at parse besked som JSON
        const data = JSON.parse(event.data);
        if (data.type === "clients_updated") {
          if (onClientsChanged) onClientsChanged();
        }
      } catch (err) {
        // Hvis ikke JSON, tjek om beskeden bare er tekst
        if (event.data === "clients_updated") {
          if (onClientsChanged) onClientsChanged();
        }
      }
    };

    ws.current.onerror = (error) => {
      // Evt. håndtering/log
    };

    ws.current.onclose = () => {
      // Evt. genopret forbindelse eller log
    };

    return () => {
      ws.current && ws.current.close();
    };
  }, [onClientsChanged]);
}
