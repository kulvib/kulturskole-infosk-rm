import React, { useState, useEffect } from "react";
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
  Skeleton,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuth } from "../auth/authcontext";
import axios from "axios";

const drawerWidth = 230;
const API_URL = "https://kulturskole-infosk-rm.onrender.com";

const menuItems = [
  { text: "Forside", path: "/", match: "/", icon: <HomeIcon /> },
  { text: "Klienter", path: "/clients", match: "/clients", icon: <PeopleIcon /> },
  { text: "Kalender", path: "/calendar", match: "/calendar", icon: <CalendarMonthIcon /> },
  { text: "Administration", path: "/administration", match: "/administration", icon: <AdminPanelSettingsIcon /> },
];

function getInitialer(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleText(role) {
  if (role === "admin") return "Administrator";
  if (role === "bruger") return "Bruger";
  return role || "";
}

export default function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const [schoolName, setSchoolName] = useState("");

  // Hent school name hvis bruger
  useEffect(() => {
    if (user && user.role === "bruger" && user.school_id) {
      axios
        .get(`${API_URL}/api/schools/`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        })
        .then((res) => {
          const schools = res.data;
          const school = schools.find((s) => s.id === user.school_id);
          setSchoolName(school ? school.name : "");
        })
        .catch(() => setSchoolName(""));
    }
  }, [user]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  // TITEL afhænger af rolle
  let title = "Infoskærm administration";
  if (user?.role === "bruger" && schoolName) {
    title = `${schoolName} - infoskærm administration`;
  }

  // Fuldt navn + rolle (fx "Kulturskole Viborg - Administrator")
  const userDisplay = user
    ? `${user.full_name || user.username} - ${getRoleText(user.role)}`
    : "";

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
              onClick={() => {
                if (isMobile) setMobileOpen(false);
              }}
              aria-current={
                (item.path === "/" && location.pathname === "/") ||
                (item.path !== "/" && location.pathname.startsWith(item.match))
                  ? "page"
                  : undefined
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
                  outline: "2px solid",
                  outlineColor: theme.palette.primary.main,
                  outlineOffset: "-2px",
                },
                transition: "background-color 0.2s",
              }}
              tabIndex={0}
            >
              <Box
                sx={{
                  minWidth: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
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
                      color: theme.palette.primary.dark,
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
          background: theme.palette.primary.main,
          color: "#fff",
          boxShadow: 2,
          height: 64,
          display: "flex",
          justifyContent: "center",
        }}
        elevation={3}
      >
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            minHeight: 64,
          }}
        >
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
            {title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {user ? (
              <>
                <Avatar sx={{ width: 28, height: 28, bgcolor: theme.palette.secondary.main }}>
                  {getInitialer(user.full_name || user.username)}
                </Avatar>
                <Typography variant="subtitle2" sx={{ color: "#fff", opacity: 0.8, mr: 2 }}>
                  {userDisplay}
                </Typography>
              </>
            ) : (
              <>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width={60} sx={{ bgcolor: "grey.700" }} />
              </>
            )}
            <LogoutButton color="inherit" />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Responsiv Drawer: Temporary på mobil, permanent på desktop */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation"
      >
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
              background: theme.palette.background.default,
              borderRight: `1px solid ${theme.palette.divider}`,
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
