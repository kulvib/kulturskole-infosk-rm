import React, { useEffect, useRef, useState } from "react";

export default function WebSocketClient() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("lukket");
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");

    ws.current.onopen = () => {
      setStatus("forbundet");
      setMessages(msgs => [...msgs, "WebSocket connected!"]);
    };

    ws.current.onmessage = (event) => {
      setMessages(msgs => [...msgs, "Modtaget: " + event.data]);
    };

    ws.current.onerror = () => setStatus("fejl");
    ws.current.onclose = () => setStatus("lukket");

    return () => {
      ws.current && ws.current.close();
    };
  }, []);

  function sendMessage() {
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send("Test fra WebSocketClient.js");
      setMessages(msgs => [...msgs, "Besked sendt!"]);
    }
  }

  return (
    <div style={{border:"1px solid #ccc", padding:10, margin:10, background:"#fafaff"}}>
      <h2>WebSocket Test</h2>
      <p>Status: <b>{status}</b></p>
      <button onClick={sendMessage}>Send testbesked</button>
      <ul>
        {messages.map((msg, i) => <li key={i}>{msg}</li>)}
      </ul>
    </div>
  );
}
