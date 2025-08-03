import React from "react";
import { Typography, Box } from "@mui/material";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
        Siden blev ikke fundet
      </Typography>
      <Typography variant="subtitle1" sx={{ color: "#888" }}>
        Tjek adressen eller gå til forsiden.
      </Typography>
    </Box>
  );
}
