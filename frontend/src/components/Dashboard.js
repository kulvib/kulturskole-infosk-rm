import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
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

const drawerWidth = 200;

export default function Dashboard() {
  // Funktion til at afgøre om en NavLink er aktiv
  const navLinkStyle = ({ isActive }) => ({
    textDecoration: "none",
    color: "inherit",
    width: "100%",
    display: "block",
  });

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
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
          <ListItem
            button
            component={NavLink}
            to="/clients"
            style={navLinkStyle}
            // MUI selected-style via NavLink
            // selected-prop sættes via NavLink's isActive
            // react-router-dom v6 bruger ikke activeClassName
            end
            // "end" gør at kun præcis "/clients" matcher
            sx={{
              "&.active, &.Mui-selected": {
                backgroundColor: "primary.main",
                color: "#fff",
              },
            }}
          >
            {({ isActive }) => (
              <ListItemText
                primary="Klienter"
                sx={{
                  fontWeight: isActive ? "bold" : "normal",
                }}
              />
            )}
          </ListItem>
          <ListItem
            button
            component={NavLink}
            to="/holidays"
            style={navLinkStyle}
            end
            sx={{
              "&.active, &.Mui-selected": {
                backgroundColor: "primary.main",
                color: "#fff",
              },
            }}
          >
            {({ isActive }) => (
              <ListItemText
                primary="Helligdage"
                sx={{
                  fontWeight: isActive ? "bold" : "normal",
                }}
              />
            )}
          </ListItem>
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: `${drawerWidth}px` }}>
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
