import React from "react";
import { Box, Typography, Paper, Button, Stack } from "@mui/material";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <Box
      sx={{
        maxWidth: 500,
        mx: "auto",
        mt: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", textAlign: "center", borderRadius: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Kulturskole Infoskærm
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 4 }}>
          Velkommen til administrationen af infoskærme.
        </Typography>
        <Stack spacing={2} direction="column" alignItems="center">
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/clients"
            size="large"
            sx={{ minWidth: 200 }}
          >
            Gå til klientoversigt
          </Button>
          {/* Tilføj flere hovedhandlinger her hvis ønsket */}
        </Stack>
      </Paper>
    </Box>
  );
}
