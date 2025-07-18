import React, { useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import ClientInfo from "./ClientInfo";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [selectedClient, setSelectedClient] = useState(null);

  function handleLogin(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
    setSelectedClient(null);
  }

  if (!token) return (
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <h2>Infoskærm Login</h2>
      <Login onLogin={handleLogin} />
    </div>
  );

  if (selectedClient)
    return (
      <ClientInfo
        token={token}
        clientId={selectedClient}
        onClose={() => setSelectedClient(null)}
        onLogout={handleLogout}
      />
    );
  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <button style={{ float: "right" }} onClick={handleLogout}>Log ud</button>
      <h1>Infoskærm Dashboard</h1>
      <Dashboard
        token={token}
        onSelectClient={setSelectedClient}
      />
    </div>
  );
}

export default App;
