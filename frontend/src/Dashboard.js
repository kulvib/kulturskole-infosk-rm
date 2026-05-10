import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
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
  CssBaseline,
  Skeleton,
  Slide,
  Button,
  Divider,
  useTheme,
  useMediaQuery,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logoutUser } = useAuth();
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

  const title =
    user?.role === "bruger" && schoolName
      ? `${schoolName} - infoskærm administration`
      : "Infoskærm administration";

  useEffect(() => {
    if (mobileOpen && (isMobile || isTablet)) setMobileOpen(false);
  }, [location.pathname, mobileOpen, isMobile, isTablet]);

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

  // Samlet brugerinfo - begge roller
  const userInfoBox = user ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Typography
        sx={{
          color: "white",
          fontWeight: 400,
          fontSize: 16,
          mr: 2,
          textAlign: "right",
          lineHeight: 1.1, // Mindre linjeafstand!
        }}
      >
        {(user.full_name || user.username) +
          (user.role === "admin" ? ` - ${getRoleText(user.role)}` : "")}
        {user.email ? (
          <>
            <br />
            <span style={{ fontSize: 13, opacity: 0.85, lineHeight: "1" }}>{user.email}</span>
          </>
        ) : null}
      </Typography>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<LogoutIcon />}
        onClick={logoutUser}
        sx={{
          borderColor: "white",
          color: "white",
          fontWeight: "normal",
          fontSize: 16,
          px: 2,
          py: 0.5,
          '&:hover': { borderColor: "#90caf9", background: "#1565c0" },
        }}
      >
        LOG UD
      </Button>
    </Box>
  ) : (
    <Skeleton variant="text" width={80} sx={{ bgcolor: "grey.700" }} />
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
          {userInfoBox}
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
        <Outlet />
      </Box>
    </Box>
  );
}
