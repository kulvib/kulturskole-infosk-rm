import { useAuth } from "../auth/authcontext";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

export default function LogoutButton() {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <Button
      variant="outlined"
      color="secondary"
      startIcon={<LogoutIcon />}
      onClick={handleLogout}
      sx={{ ml: 2 }}
    >
      Log ud
    </Button>
  );
}
