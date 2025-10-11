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
  Skeleton,
  Slide,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmailIcon from "@mui/icons-material/Email";
import { useAuth } from "../auth/authcontext";
import axios from "axios";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

function getRoleText(role) {
  if (role === "admin") return "Administrator";
  if (role === "bruger") return "Bruger";
  return role || "";
}

function UserInfoBar({ user, onLogout }) {
  if (!user) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 2,
        background: "#1976d2",
        color: "#fff",
        px: 2,
        py: 1,
        borderRadius: 1,
        mt: 1,
        mb: 2,
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {user.full_name || user.username} - {getRoleText(user.role)}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <EmailIcon sx={{ fontSize: 16, opacity: 0.85 }} />
          <Typography variant="body2" sx={{ mt: 0, opacity: 0.85 }}>
            {user.email}
          </Typography>
        </Box>
      </Box>
      <LogoutButton
        variant="outlined"
        color="inherit"
        sx={{
          borderColor: "#fff",
          color: "#fff",
          "&:hover": { borderColor: "#fff", background: "#1565c0" },
          fontWeight: 500,
        }}
      >
        LOG UD
      </LogoutButton>
    </Box>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const [schoolName, setSchoolName] = useState("");

  const drawerWidth = isMobile ? 160 : isTablet ? 190 : 230;

  const menuItems = [
    { text: "Forside", path: "/", match: "/", icon: <HomeIcon /> },
    { text: "Klienter", path: "/clients", match: "/clients", icon: <PeopleIcon /> },
    { text: "Kalender", path: "/calendar", match: "/calendar", icon: <CalendarMonthIcon /> },
    ...(user?.role === "admin"
      ? [{ text: "Administration", path: "/administration", match: "/administration", icon: <AdminPanelSettingsIcon /> }]
      : []),
  ];

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

  let title = "Infoskærm administration";
  if (user?.role === "bruger" && schoolName) {
    title = `${schoolName} - infoskærm administration`;
  }

  const userDisplay = user
    ? `${user.full_name || user.username} - ${getRoleText(user.role)}`
    : "";

  useEffect(() => {
    if (mobileOpen && (isMobile || isTablet)) setMobileOpen(false);
  }, [location.pathname]); // Luk drawer ved navigation på mobil/tablet

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
          height: { xs: 48, md: 64 },
          display: "flex",
          justifyContent: "center",
        }}
        elevation={3}
      >
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            minHeight: { xs: 48, md: 64 },
            px: { xs: 1, md: 2 },
          }}
        >
          {(isMobile || isTablet) && (
            <IconButton
              color="inherit"
              aria-label="Åbn menu"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1 }}
              size="large"
            >
              <MenuIcon sx={{ fontSize: { xs: 26, sm: 32 } }} />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 700,
              fontSize: { xs: "1rem", md: "1.25rem" },
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              maxWidth: { xs: "55vw", sm: "65vw", md: "unset" },
              ml: { xs: (isMobile || isTablet) ? 0 : 1 }
            }}
          >
            {title}
          </Typography>
          {/* Skjul brugerinfo på helt små skærme */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1 }}>
            {user ? (
              <Typography variant="subtitle2" sx={{ color: "#fff", opacity: 0.8, mr: 2, fontSize: { sm: "0.93rem", md: "1rem" } }}>
                {userDisplay}
              </Typography>
            ) : (
              <Skeleton variant="text" width={80} sx={{ bgcolor: "grey.700" }} />
            )}
            <LogoutButton color="inherit" />
          </Box>
          {/* På XS vis kun logout-knap */}
          <Box sx={{ display: { xs: "flex", sm: "none" }, alignItems: "center" }}>
            <LogoutButton color="inherit" />
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
        <Toolbar sx={{ minHeight: { xs: 48, md: 64 } }} />
        {/* UserInfoBar vises på desktop og tablet, skjules på XS */}
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <UserInfoBar user={user} onLogout={() => {/* din logout funktion */}} />
        </Box>
        <Outlet />
      </Box>
    </Box>
  );
}
