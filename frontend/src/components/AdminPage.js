import React from "react";
import { Typography, Box } from "@mui/material";

export default function AdminPage() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Administration
      </Typography>
      <Typography>
        Her kan jeg oprette administration af f.eks. bruger opretning og andet.
      </Typography>
    </Box>
  );
}
