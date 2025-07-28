import React from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
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
  const location = useLocation();

  const menuItems = [
    { text: "Klienter", to: "/clients" },
    { text: "Helligdage", to: "/holidays" },
  ];

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
          {menuItems.map(item => (
            <ListItem
              button
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={location.pathname === item.to}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: "primary.main",
                  color: "#fff",
                  fontWeight: "bold",
                },
              }}
            >
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
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
