import React, { useState, useRef } from "react";

export default function Terminal({ clientId, token }) {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);

  function connect() {
    if (wsRef.current) return;
    // Brug server-url fra VITE_API_BASE, men skift til wss og fjern evt. /api
    let apiBase = import.meta.env.VITE_API_BASE;
    let wsUrl = apiBase.replace(/^http/, "ws").replace(/\/api$/, "");
    wsUrl += `/ws/shell/${clientId}?token=${token}`;

    const ws = new window.WebSocket(wsUrl);
    ws.onmessage = e => setLog(log => [...log, e.data]);
    wsRef.current = ws;
  }

  function send() {
    if (wsRef.current && input) {
      wsRef.current.send(input);
      setLog(log => [...log, "> " + input]);
      setInput("");
    }
  }

  React.useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ background: "#222", color: "#eee", padding: 10, margin: "10px 0" }}>
      <div style={{ height: 120, overflow: "auto", marginBottom: 5 }}>
        {log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      <input
        style={{ width: "80%" }}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && send()}
        placeholder="Skriv kommando og tryk Enter"
      />
      <button onClick={send}>Send</button>
    </div>
  );
}
