import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Start med at læse fra localStorage, hvis muligt:
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [showWarning, setShowWarning] = useState(false);
  const inactivityTimer = useRef();
  const warningTimer = useRef();
  const navigate = useNavigate();

  // Opdater localStorage når token eller user ændres
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [token, user]);

  // Korrekt initialisering på login
  const loginUser = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  };

  const logoutUser = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  // Inaktivitets-timer
  const resetInactivityTimer = () => {
    setShowWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      inactivityTimer.current = setTimeout(() => {
        logoutUser();
      }, 60000); // 1 min efter advarsel
    }, 240000); // 4 min
  };

  useEffect(() => {
    if (token) {
      window.addEventListener("mousemove", resetInactivityTimer);
      window.addEventListener("keydown", resetInactivityTimer);
      window.addEventListener("mousedown", resetInactivityTimer);
      window.addEventListener("touchstart", resetInactivityTimer);

      resetInactivityTimer();

      return () => {
        window.removeEventListener("mousemove", resetInactivityTimer);
        window.removeEventListener("keydown", resetInactivityTimer);
        window.removeEventListener("mousedown", resetInactivityTimer);
        window.removeEventListener("touchstart", resetInactivityTimer);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (warningTimer.current) clearTimeout(warningTimer.current);
      };
    }
    // eslint-disable-next-line
  }, [token]);

  const handleContinueSession = () => {
    resetInactivityTimer();
  };

  return (
    <AuthContext.Provider value={{ token, user, loginUser, logoutUser }}>
      {children}
      <Dialog open={showWarning}>
        <DialogTitle>Inaktivitet registreret</DialogTitle>
        <DialogContent>
          <Typography>
            Du har været inaktiv i 4 minutter.<br />
            Du bliver automatisk logget ud om 1 minut.<br />
            Klik "Fortsæt session" for at starte en ny periode.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleContinueSession} variant="contained" color="primary">
            Fortsæt session
          </Button>
          <Button onClick={logoutUser} variant="contained" color="error">
            Log ud nu
          </Button>
        </DialogActions>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
