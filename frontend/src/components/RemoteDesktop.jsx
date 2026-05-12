// src/components/RemoteDesktop.jsx
// Viser fjernskrivebord for en klient via Guacamole.
import React from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import { apiUrl } from "../api";

export default function RemoteDesktop() {
  const { clientId } = useParams();

  if (!clientId) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6" color="error">
          Ingen klient-ID angivet.
        </Typography>
      </Box>
    );
  }

  const guacUrl = `${apiUrl}/api/clients/${clientId}/remote-desktop`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Box sx={{ p: 1, bgcolor: "grey.100", display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Fjernskrivebord — klient {clientId}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => window.close()}>
          Luk
        </Button>
      </Box>
      <Box sx={{ flex: 1 }}>
        <iframe
          src={guacUrl}
          title={`Fjernskrivebord klient ${clientId}`}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="fullscreen"
        />
      </Box>
    </Box>
  );
}
