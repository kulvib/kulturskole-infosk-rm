import React from "react";
import { useAuth } from "./AuthContext";
import ClientList from "./ClientList";

export default function Dashboard() {
  const { logout } = useAuth();

  return (
    <div className="dashboard">
      <header>
        <h1>Klient Dashboard</h1>
        <button onClick={logout} className="logout-btn">Log ud</button>
      </header>
      <ClientList />
    </div>
  );
}
