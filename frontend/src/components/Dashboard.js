import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import LogoutButton from "./LogoutButton";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  AppBar,
} from "@mui/material";

const drawerWidth = 230;

// Helligdage er fjernet fra menuen
const menuItems = [
  {
    text: "Klienter",
    path: "/clients",
    match: "/clients",
  },
  {
    text: "Kalender",
    path: "/calendar",
    match: "/calendar",
  },
];

export default function Dashboard() {
  const location = useLocation();

  return (
    <Box sx={{ display: "flex" }}>
      {/* AppBar for branding and log out */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: "#036",
          color: "#fff",
          boxShadow: 2,
          height: 64,
          display: "flex",
          justifyContent: "center",
        }}
        elevation={3}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            Kulturskolen Viborg - infoskærm administration
          </Typography>
          <LogoutButton color="inherit" />
        </Toolbar>
      </AppBar>

      {/* Drawer for menu */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            background: "#eee",
            borderRight: "1px solid #e0e0e0",
          },
        }}
      >
        <Toolbar />
        <List sx={{ mt: 2 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname.startsWith(item.match)}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  my: 0.5,
                  backgroundColor: location.pathname.startsWith(item.match)
                    ? "#e0f2f1"
                    : "inherit",
                  "&:hover": {
                    backgroundColor: "#b2ebf2",
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      sx={{
                        fontWeight: location.pathname.startsWith(item.match)
                          ? 700
                          : 400,
                        color: "#036",
                      }}
                    >
                      {item.text}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${drawerWidth}px)`,
          minHeight: "100vh",
          background: "#f6f9fb",
        }}
      >
        {/* Ensure content is not hidden behind AppBar */}
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
