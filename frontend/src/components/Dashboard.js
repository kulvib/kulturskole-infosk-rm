import React from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import ClientsPage from "./ClientsPage";
import HolidaysPage from "./HolidaysPage";
import { useAuth } from "../auth/AuthContext";
import { setAuthToken } from "../api/api";

const drawerWidth = 200;

export default function Dashboard() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setAuthToken(null);
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex" }}>
      {/* AppBar */}
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Kulturskole Admin {user && `- ${user.username}`}
          </Typography>
          <Button color="inherit" onClick={handleLogout}>
            Log ud
          </Button>
        </Toolbar>
      </AppBar>
      {/* Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <List>
          <ListItem button component={Link} to="/clients">
            <ListItemText primary="Klienter" />
          </ListItem>
          <ListItem button component={Link} to="/holidays">
            <ListItemText primary="Helligdage" />
          </ListItem>
        </List>
      </Drawer>
      {/* Main Content */}
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, ml: `${drawerWidth}px` }}
      >
        <Toolbar />
        <Routes>
          <Route path="clients" element={<ClientsPage />} />
          <Route path="holidays" element={<HolidaysPage />} />
          <Route
            path="*"
            element={
              <Typography variant="h5">
                Velkommen til adminpanelet.
              </Typography>
            }
          />
        </Routes>
      </Box>
    </Box>
  );
}
