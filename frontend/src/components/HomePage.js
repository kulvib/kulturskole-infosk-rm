import React from "react";
import { Box, Typography, Paper, Button, Stack } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authcontext";

export default function HomePage() {
  const { user } = useAuth();

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
            Gå til klient side
          </Button>
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/calendar"
            size="large"
            sx={{ minWidth: 200 }}
          >
            Gå til kalender side
          </Button>
          {user?.role === "admin" && (
            <Button
              variant="contained"
              color="secondary"
              component={Link}
              to="/admin"
              size="large"
              sx={{ minWidth: 200 }}
            >
              Gå til administrator side
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
