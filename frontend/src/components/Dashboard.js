import React from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
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
import ClientInfoPage from "./ClientInfoPage";
import HolidaysPage from "./HolidaysPage";

const drawerWidth = 200;

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { text: "Klienter", to: "/clients" },
    { text: "Helligdage", to: "/holidays" },
  ];

  // Funktion: Håndter klik på "Tilføj klient"
  const handleAddClient = () => {
    alert("Her kan du tilføje en klient!");
    // navigate("/clients/add");
  };

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, cursor: "pointer" }}
            onClick={() => navigate("/")}
            color="inherit"
          >
            Kulturskolen Viborg - infoskærme administration
          </Typography>
          <Button color="inherit" disabled>
            Log ud
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List>
          {menuItems.map(item => (
            <ListItem
              button
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={location.pathname === item.to}
              sx={{
                color: "black",
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "black",
                  fontWeight: "bold",
                }
              }}
            >
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: `${drawerWidth}px` }}>
        <Toolbar />
        {/* "Tilføj klient" knap vises kun på /clients */}
        {location.pathname === "/clients" && (
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddClient}
            >
              Tilføj klient
            </Button>
          </Box>
        )}
        <Routes>
          <Route path="clients" element={<ClientInfoPage />} />
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
