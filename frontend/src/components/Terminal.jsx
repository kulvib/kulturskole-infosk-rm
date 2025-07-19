import React, { useEffect, useRef } from "react";
import { getTerminalWsUrl } from "../api/clientApi";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";

export default function Terminal({ clientId }) {
  const xtermRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (xtermRef.current) {
      termRef.current = new XTerm();
      termRef.current.open(xtermRef.current);
      termRef.current.write("Terminalen åbner...\r\n");
      // Åbn WebSocket
      const ws = new window.WebSocket(getTerminalWsUrl(clientId));
      wsRef.current = ws;
      ws.onopen = () => {
        termRef.current.write("Forbundet!\r\n");
      };
      ws.onmessage = (e) => {
        termRef.current.write(e.data);
      };
      ws.onerror = () => {
        termRef.current.write("\r\n[Fejl på forbindelsen]\r\n");
      };
      ws.onclose = () => {
        termRef.current.write("\r\n[Forbindelse lukket]\r\n");
      };
      // Send tastetryk til backend
      termRef.current.onData(data => {
        ws.send(data);
      });
      return () => {
        ws.close();
        termRef.current.dispose();
      };
    }
  }, [clientId]);

  return (
    <div className="terminal-container">
      <div ref={xtermRef} style={{ height: 250, width: "100%", background: "#111" }} />
    </div>
  );
}
