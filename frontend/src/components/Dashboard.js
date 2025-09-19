import React, { useState } from "react";
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
  IconButton,
  Divider,
  useTheme,
  useMediaQuery,
  CssBaseline,
  Avatar,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuth } from "../auth/authcontext";

const drawerWidth = 230;

const menuItems = [
  { text: "Forside", path: "/", match: "/", icon: <HomeIcon /> },
  { text: "Klienter", path: "/clients", match: "/clients", icon: <PeopleIcon /> },
  { text: "Kalender", path: "/calendar", match: "/calendar", icon: <CalendarMonthIcon /> },
  { text: "Administration", path: "/administration", match: "/administration", icon: <AdminPanelSettingsIcon /> },
];

export default function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { username } = useAuth();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const drawer = (
    <Box>
      <Toolbar />
      <Divider />
      <List sx={{ mt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.match)
              }
              sx={{
                borderRadius: 2,
                mx: 1,
                my: 0.5,
                backgroundColor:
                  item.path === "/"
                    ? location.pathname === "/"
                      ? "#e0f2f1"
                      : "inherit"
                    : location.pathname.startsWith(item.match)
                      ? "#e0f2f1"
                      : "inherit",
                "&:hover, &:focus": {
                  backgroundColor: "#b2ebf2",
                  outline: "2px solid #036", // Fokusindikator
                  outlineOffset: "-2px",
                },
                transition: "background-color 0.2s",
              }}
              tabIndex={0}
            >
              <Box sx={{ minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.icon}
              </Box>
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      fontWeight:
                        item.path === "/"
                          ? location.pathname === "/"
                            ? 700
                            : 400
                          : location.pathname.startsWith(item.match)
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
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
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
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", minHeight: 64 }}>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="Åbn menu"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            Kulturskolen Viborg - infoskærm administration
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: "#015"}}>
              {username ? username.charAt(0).toUpperCase() : "?"}
            </Avatar>
            <Typography variant="subtitle2" sx={{ color: "#fff", opacity: 0.8, mr: 2 }}>
              {username}
            </Typography>
            <LogoutButton color="inherit" />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Responsiv Drawer: Temporary på mobil, permanent på desktop */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }} aria-label="navigation">
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              background: "#eee",
              borderRight: "1px solid #e0e0e0",
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { xs: "100%", md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          background: "#f6f9fb",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
