import React from "react";
import { useParams } from "react-router-dom";

export default function RemoteDesktop() {
  const { clientId } = useParams();

  // Her kan du lave din API-kald for at hente remote desktop URL for clientId
  // Fx:
  // const remoteUrl = ...;

  return (
    <div>
      <h2>Fjernskrivebord for klient {clientId}</h2>
      {/* Eksempel: embed fjernskrivebordet */}
      <iframe
        src={`https://remotedesktop.example.com/session/${clientId}`}
        title="Remote Desktop"
        style={{ width: "100%", height: "90vh", border: "none" }}
      />
    </div>
  );
}
