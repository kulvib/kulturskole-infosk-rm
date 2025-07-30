import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  Button,
} from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import EventIcon from "@mui/icons-material/Event";
import LogoutIcon from "@mui/icons-material/Logout";

const drawerWidth = 220;

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Dummy log ud funktion — erstat evt. med rigtig logud-logik
  const handleLogout = () => {
    // Her kan du fx fjerne token fra localStorage/sessionStorage og redirecte
    // localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <Box sx={{ display: "flex", bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography
            variant="h5"
            sx={{ flexGrow: 1, cursor: "pointer", userSelect: "none" }}
            onClick={() => navigate("/")}
          >
            Kulturskolen Viborg – Infoskærm Administration
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ ml: 2 }}
          >
            Log ud
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "#e8eaf6",
            pt: 8,
          },
        }}
      >
        <List>
          <ListItem
            button
            selected={location.pathname === "/clients"}
            onClick={() => navigate("/clients")}
          >
            <ListItemIcon>
              <ComputerIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Klienter" />
          </ListItem>
          <ListItem
            button
            selected={location.pathname === "/holidays"}
            onClick={() => navigate("/holidays")}
          >
            <ListItemIcon>
              <EventIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Helligdage" />
          </ListItem>
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 1, // <-- Mindre padding her!
          ml: `${drawerWidth}px`,
          mt: 8,
          minHeight: "100vh",
          background: "#f5f7fa",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
