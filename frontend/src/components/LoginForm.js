import React, { useState } from "react";
import { login } from "../api/login";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const token = await login(username, password);
      setSuccess("Login lykkedes! Token: " + token);
      // Her kan du fx redirecte eller gemme token i localStorage hvis du ønsker
      // localStorage.setItem("token", token);
    } catch (err) {
      setError("Login fejlede: " + err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Brugernavn:
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Adgangskode:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
      </div>
      <button type="submit">Log ind</button>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {success && <div style={{ color: "green" }}>{success}</div>}
    </form>
  );
}

export default LoginForm;
