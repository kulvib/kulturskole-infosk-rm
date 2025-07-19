import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/clientApi";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await loginApi(username, password);
      login(data.access_token);
      navigate("/");
    } catch {
      setError("Forkert brugernavn eller adgangskode");
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="login-form">
        <input
          autoFocus
          type="text"
          placeholder="Brugernavn"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Adgangskode"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Logger ind..." : "Login"}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
