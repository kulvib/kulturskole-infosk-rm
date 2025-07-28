import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Paper,
  Stack,
} from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import EventIcon from "@mui/icons-material/Event";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <Box sx={{ bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      <AppBar position="static" sx={{ bgcolor: "#1976d2" }}>
        <Toolbar>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            Kulturskolen Viborg – Infoskærm Admin
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 500, mx: "auto", mt: 8 }}>
        <Paper sx={{ p: 4, borderRadius: 3, boxShadow: 3 }}>
          <Typography variant="h4" align="center" sx={{ mb: 3, fontWeight: "bold" }}>
            Velkommen!
          </Typography>
          <Typography align="center" sx={{ mb: 4 }}>
            Vælg en funktion nedenfor:
          </Typography>
          <Stack spacing={3} direction="column" alignItems="center">
            <Button
              startIcon={<ComputerIcon />}
              variant="contained"
              size="large"
              sx={{ minWidth: 200, fontSize: 20, borderRadius: 2 }}
              onClick={() => navigate("/clients")}
            >
              Klienter
            </Button>
            <Button
              startIcon={<EventIcon />}
              variant="contained"
              size="large"
              sx={{ minWidth: 200, fontSize: 20, borderRadius: 2 }}
              onClick={() => navigate("/holidays")}
            >
              Helligdage
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
