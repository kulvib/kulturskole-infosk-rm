import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";

const WEBSOCKET_URL = "wss://kulturskole-infosk-rm.onrender.com/ws"; // Din backend WebSocket-URL

export default function ClientDetailsLivestreamSection() {
  const [image, setImage] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new window.WebSocket(WEBSOCKET_URL);

    ws.current.onmessage = (event) => {
      // Forvent at event.data er base64 billede-data (f.eks. JPEG eller PNG)
      setImage(event.data);
    };

    ws.current.onclose = () => {
      console.warn("WebSocket lukket");
    };

    return () => {
      ws.current.close();
    };
  }, []);

  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
          <VideocamIcon color="action" fontSize="large" />
          <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
            Livestream fra klient
          </Typography>
        </Box>
        <Box sx={{
          p: 2,
          border: "1px solid #eee",
          borderRadius: 2,
          background: "#fafafa",
          textAlign: "center",
          minHeight: "160px",
        }}>
          {image ? (
            <img
              src={`data:image/jpeg;base64,${image}`}
              alt="Livestream"
              style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
            />
          ) : (
            <Typography color="text.secondary" fontStyle="italic">
              Ingen livestream billede endnu...
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
