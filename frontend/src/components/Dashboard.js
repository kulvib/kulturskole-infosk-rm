import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import LogoutButton from "./LogoutButton";
import { AppBar, Toolbar, Typography, Box, Button } from "@mui/material";

export default function Dashboard() {
  const location = useLocation();

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" elevation={3}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Kulturskole Admin
            </Typography>
            <Button
              color={location.pathname.startsWith("/clients") ? "secondary" : "inherit"}
              component={Link}
              to="/clients"
              sx={{ ml: 2 }}
            >
              Klienter
            </Button>
            <Button
              color={location.pathname.startsWith("/holidays") ? "secondary" : "inherit"}
              component={Link}
              to="/holidays"
              sx={{ ml: 2 }}
            >
              Helligdage
            </Button>
          </Box>
          <LogoutButton />
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
