import React, { useState } from "react";
import { clientAction } from "../api/clientApi";

const actions = [
  { key: "browser_shutdown", label: "Luk Chrome" },
  { key: "start", label: "Start klient" },
  { key: "restart", label: "Genstart klient" },
  { key: "shutdown", label: "Sluk klient" },
];

export default function ClientActions({ clientId }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState("");

  async function handleAction(action) {
    setLoading(action);
    setMsg("");
    try {
      const res = await clientAction(clientId, action);
      setMsg(res.msg || "Handlingen blev udført");
    } catch {
      setMsg("Fejl ved handling");
    }
    setLoading("");
  }

  return (
    <div className="client-actions">
      <b>Handlinger:</b>{" "}
      {actions.map(a => (
        <button
          key={a.key}
          onClick={() => handleAction(a.key)}
          disabled={loading === a.key}
        >
          {loading === a.key ? "Arbejder..." : a.label}
        </button>
      ))}
      {msg && <div className="action-msg">{msg}</div>}
    </div>
  );
}
