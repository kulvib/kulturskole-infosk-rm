import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "../auth/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/token`,
        new URLSearchParams({ username, password })
      );
      login(res.data.access_token);
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (e) {
      setErr("Login fejlede – tjek brugernavn og adgangskode.");
    }
  }

  return (
    <div style={{ maxWidth: 350, margin: "6rem auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>Brugernavn</label>
        <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
        <label>Adgangskode</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
        <button type="submit" style={{ width: "100%", marginTop: 16 }}>Login</button>
      </form>
      {err && <div style={{ color: "red", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
