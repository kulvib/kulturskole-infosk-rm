import { useAuth } from "../auth/authcontext";
import { useNavigate } from "react-router-dom";
import { Button, useTheme, useMediaQuery } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

export default function LogoutButton({
  color = "secondary",
  variant = "outlined",
  startIcon = <LogoutIcon />,
  children = "LOG UD",
  ...props
}) {
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
      variant={variant}
      color={color}
      startIcon={startIcon}
      onClick={handleLogout}
      sx={{
        ml: { xs: 0.7, sm: 2 },
        px: { xs: 1.25, sm: 2.5 },
        minWidth: 110,
        fontSize: { xs: "1rem", sm: "1.03rem" },
        borderColor: "#fff",
        color: "#fff",
        fontWeight: 700,
        lineHeight: 1.15,
        height: { xs: 36, sm: 40 },
        borderRadius: 1.5,
        letterSpacing: 0.5,
        "&:hover": {
          borderColor: "#fff",
          backgroundColor: "rgba(255,255,255,0.08)",
        },
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
