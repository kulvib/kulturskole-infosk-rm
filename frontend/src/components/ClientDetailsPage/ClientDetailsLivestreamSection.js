import React from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";

export default function ClientDetailsLivestreamSection() {
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
          color: "#888",
          fontStyle: "italic",
          fontSize: "0.95rem"
        }}>
          Livestream placeholder (MJPEG/WebRTC)
        </Box>
      </CardContent>
    </Card>
  );
}
