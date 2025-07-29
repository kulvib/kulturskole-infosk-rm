import React from "react";
import { useNavigate } from "react-router-dom";
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
} from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import EventIcon from "@mui/icons-material/Event";

const drawerWidth = 220;

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: "flex", bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            Kulturskolen Viborg – Infoskærm Admin
          </Typography>
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
          <ListItem button onClick={() => navigate("/clients")}>
            <ListItemIcon>
              <ComputerIcon color="primary" />
            </ListItemIcon>
            <ListItemText primary="Klienter" />
          </ListItem>
          <ListItem button onClick={() => navigate("/holidays")}>
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
          p: 4,
          ml: `${drawerWidth}px`,
          mt: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: "bold", mb: 2 }}>
          Velkommen!
        </Typography>
        <Typography align="center" sx={{ mb: 4 }}>
          Vælg en funktion i menuen til venstre.
        </Typography>
      </Box>
    </Box>
  );
}
