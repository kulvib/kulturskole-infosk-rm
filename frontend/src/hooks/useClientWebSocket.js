import { useEffect, useRef, useState } from "react";

/**
 * WebSocket-hook med status, reconnect og flere events.
 * @param {Object} handlers - Objekt med callbacks, fx { onClientsChanged, onHolidaysChanged }
 * @returns {string} status - WebSocket status: "forbinder", "forbundet", "fejl", "lukket"
 */
export function useClientWebSocket(handlers = {}) {
  const ws = useRef(null);
  const [status, setStatus] = useState("forbinder");
  const reconnectTimeout = useRef();

  useEffect(() => {
    let active = true;

    function connect() {
      setStatus("forbinder");
      ws.current = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");

      ws.current.onopen = () => {
        setStatus("forbundet");
      };

      ws.current.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          data = event.data;
        }

        // Flere event-typer, kald relevante handlers
        if (typeof data === "string") {
          if (data === "clients_updated" && handlers.onClientsChanged) {
            handlers.onClientsChanged();
          }
          if (data === "holidays_updated" && handlers.onHolidaysChanged) {
            handlers.onHolidaysChanged();
          }
        } else if (typeof data === "object" && data.type) {
          if (data.type === "clients_updated" && handlers.onClientsChanged) {
            handlers.onClientsChanged();
          }
          if (data.type === "holidays_updated" && handlers.onHolidaysChanged) {
            handlers.onHolidaysChanged();
          }
        }
      };

      ws.current.onerror = () => {
        setStatus("fejl");
        ws.current.close();
      };

      ws.current.onclose = () => {
        setStatus("lukket");
        // Automatisk reconnect (fx efter 3 sekunder)
        if (active) {
          reconnectTimeout.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
    // eslint-disable-next-line
  }, [handlers.onClientsChanged, handlers.onHolidaysChanged]);

  return status;
}
