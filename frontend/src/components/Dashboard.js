import React from "react";
import { Routes, Route, Link } from "react-router-dom";
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
  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Kulturskole Admin
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
          <ListItem button component={Link} to="/clients">
            <ListItemText primary="Klienter" />
          </ListItem>
          <ListItem button component={Link} to="/holidays">
            <ListItemText primary="Helligdage" />
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
