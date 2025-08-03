import React, { useEffect, useRef, useState } from "react";

export default function WebSocketClient() {
  const [messages, setMessages] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("wss://kulturskole-infosk-rm.onrender.com/ws/clients");

    ws.current.onopen = () => {
      setMessages(msgs => [...msgs, "WebSocket connected!"]);
    };

    ws.current.onmessage = (event) => {
      setMessages(msgs => [...msgs, "Modtaget fra backend: " + event.data]);
    };

    ws.current.onerror = (error) => {
      setMessages(msgs => [...msgs, "WebSocket fejl!"]);
    };

    ws.current.onclose = () => {
      setMessages(msgs => [...msgs, "WebSocket lukket"]);
    };

    // Luk forbindelsen ved unmount
    return () => {
      ws.current.close();
    };
  }, []);

  // Funktion til at sende besked
  function sendMessage() {
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send("Test fra frontend");
      setMessages(msgs => [...msgs, "Besked sendt: Test fra frontend"]);
    } else {
      setMessages(msgs => [...msgs, "Kan ikke sende – WebSocket ikke åben!"]);
    }
  }

  return (
    <div>
      <h2>WebSocket Client</h2>
      <button onClick={sendMessage}>Send testbesked</button>
      <ul>
        {messages.map((msg, idx) => (
          <li key={idx}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
