import { useAuth } from "../auth/authcontext";
import { useNavigate } from "react-router-dom";
import { Button, useTheme, useMediaQuery } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

export default function LogoutButton({ color = "secondary" }) {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleLogout = () => {
    logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <Button
      variant="outlined"
      color={color}
      startIcon={<LogoutIcon />}
      onClick={handleLogout}
      sx={{
        ml: { xs: 0.7, sm: 2 },
        px: { xs: 1.25, sm: 2.5 },
        minWidth: { xs: 0, sm: 64 },
        fontSize: { xs: "0.97rem", sm: "1rem" },
        borderColor: "#fff",
        color: "#fff",
        lineHeight: 1.15,
        height: { xs: 36, sm: 40 },
        ...(isMobile && {
          fontSize: "0.97rem",
          minWidth: 0,
          px: 1.25,
          ml: 0.7,
        }),
        "&:hover": {
          borderColor: "#fff",
          backgroundColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <span style={{ display: isMobile ? "none" : "inline" }}>Log ud</span>
      {isMobile && <LogoutIcon sx={{ ml: 0, mr: 0 }} />}
    </Button>
  );
}
