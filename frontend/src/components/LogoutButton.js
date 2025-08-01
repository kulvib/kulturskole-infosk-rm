import { useAuth } from "../auth/authcontext";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

export default function LogoutButton({ color = "secondary" }) {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

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
        ml: 2,
        borderColor: "#fff",
        color: "#fff",
        "&:hover": {
          borderColor: "#fff",
          backgroundColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      Log ud
    </Button>
  );
}
