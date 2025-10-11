import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
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
  Skeleton,
  Slide,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../auth/authcontext";
import axios from "axios";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

function getRoleText(role) {
  if (role === "admin") return "Administrator";
  if (role === "bruger") return "Bruger";
  return role || "";
}

export default function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logoutUser } = useAuth();
  const [schoolName, setSchoolName] = useState("");

  // Responsiv drawerWidth
  const drawerWidth = isMobile ? 160 : isTablet ? 190 : 230;

  // Dynamisk menu: "Administration" kun for admin
  const menuItems = [
    { text: "Forside", path: "/", match: "/", icon: <HomeIcon /> },
    { text: "Klienter", path: "/clients", match: "/clients", icon: <PeopleIcon /> },
    { text: "Kalender", path: "/calendar", match: "/calendar", icon: <CalendarMonthIcon /> },
    ...(user?.role === "admin"
      ? [{ text: "Administration", path: "/administration", match: "/administration", icon: <AdminPanelSettingsIcon /> }]
      : []),
  ];

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

  // Navn og rolle (fx "Henrik Resen - Administrator")
  const userDisplayName = user
    ? `${user.full_name || user.username} - ${getRoleText(user.role)}`
    : "";

  // E-mail fra backend
  const userEmail = user?.email || "";

  // --- Mobil optimering: Luk drawer ved navigation, swipe, klik udenfor ---
  useEffect(() => {
    if (mobileOpen && (isMobile || isTablet)) setMobileOpen(false);
    // eslint-disable-next-line
  }, [location.pathname]);

  // --- MENU DRAWER ---
  const drawer = (
    <Box sx={{ minHeight: "100vh", bgcolor: { xs: "#f8fdff", md: "inherit" } }}>
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
                if (isMobile || isTablet) setMobileOpen(false);
              }}
              aria-current={
                (item.path === "/" && location.pathname === "/") ||
                (item.path !== "/" && location.pathname.startsWith(item.match))
                  ? "page"
                  : undefined
              }
              sx={{
                borderRadius: 2,
                mx: { xs: 0.5, sm: 1 },
                my: 0.5,
                px: { xs: 1, sm: 2 },
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
                minHeight: { xs: 44, sm: 48 },
              }}
              tabIndex={0}
            >
              <Box
                sx={{
                  minWidth: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mr: { xs: 1, sm: 2 },
                  fontSize: { xs: 20, sm: 22 },
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
                      fontSize: { xs: "0.97rem", sm: "1.05rem", md: "1.10rem" },
                      whiteSpace: "nowrap",
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

  // --- Log ud handler ---
  const handleLogout = () => {
    logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: "#1976d2",
          color: "#fff",
          boxShadow: 2,
          height: { xs: 56, md: 64 },
          display: "flex",
          justifyContent: "center",
        }}
        elevation={3}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            px: { xs: 2, md: 3 },
            background: "#1976d2",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              width: "100%",
              maxWidth: 600,
              justifyContent: "center",
            }}
          >
            {/* Centereret navn/rolle + email */}
            <Box sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              mr: 2,
              minWidth: 250,
            }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 500,
                  color: "#fff",
                  textAlign: "center",
                  fontSize: "1.13rem",
                  letterSpacing: 0.1,
                }}
              >
                {userDisplayName}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "#e3f2fd",
                  textAlign: "center",
                  fontSize: "1.03rem",
                  fontWeight: 400,
                  mt: 0.3,
                  letterSpacing: 0.5,
                }}
              >
                {userEmail}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LogoutIcon sx={{ fontSize: 20 }} />}
              onClick={handleLogout}
              sx={{
                borderColor: "#fff",
                color: "#fff",
                fontWeight: 400,
                minWidth: 110,
                fontSize: "1rem",
                px: 2,
                py: 0.5,
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
                height: 42,
                "&:hover": {
                  borderColor: "#fff",
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              LOG UD
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Responsiv Drawer: Temporary på mobil/tablet, permanent på desktop */}
      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
        }}
        aria-label="navigation"
      >
        <Drawer
          variant={isMobile || isTablet ? "temporary" : "permanent"}
          open={isMobile || isTablet ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          transitionDuration={isMobile ? 180 : 220}
          sx={{
            display: { xs: "block", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              background: theme.palette.background.default,
              borderRight: `1px solid ${theme.palette.divider}`,
              pt: { xs: 0, md: 0 },
              zIndex: 1200,
            },
          }}
        >
          <Slide in direction="right" appear={false}>
            <div>{drawer}</div>
          </Slide>
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 3 },
          width: { xs: "100%", md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          background: "#f6f9fb",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }} />
        <Outlet />
      </Box>
    </Box>
  );
}
