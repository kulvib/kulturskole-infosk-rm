import { createContext, useContext, useState, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [showWarning, setShowWarning] = useState(false);
  const inactivityTimer = useRef();
  const warningTimer = useRef();

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    if (username) {
      localStorage.setItem("username", username);
    } else {
      localStorage.removeItem("username");
    }
  }, [token, username]);

  // loginUser skal nu tage både token og username
  const loginUser = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const logoutUser = () => {
    setToken("");
    setUsername("");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/login";
  };

  // Nulstil (start ny) 5 min periode ved aktivitet
  const resetInactivityTimer = () => {
    setShowWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    // Advarsel efter 4 min (240.000 ms), logout efter 5 min (300.000 ms)
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
    resetInactivityTimer(); // Starter ny 5 min periode
  };

  return (
    <AuthContext.Provider value={{ token, username, loginUser, logoutUser }}>
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
