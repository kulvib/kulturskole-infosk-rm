// src/auth/authcontext.js
// AuthContext med HttpOnly-cookie-baseret autentificering.
// Token gemmes i HttpOnly-cookie (sat af backend) — ikke i localStorage.
// Kun brugerobjektet gemmes i localStorage til visning i UI.
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { logout as apiLogout } from "../api";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const AuthContext = createContext();

export function AuthProvider({ children }) {
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

  // Synkroniser brugerdata (IKKE token) med localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const loginUser = useCallback((userData) => {
    // Token er i HttpOnly-cookie — gem kun brugerdata til UI
    setUser(userData);
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignorer fejl ved logout-endpoint — ryd lokal session under alle omstændigheder
    }
    setUser(null);
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  // Inaktivitets-timer: advarsel efter 4 min, logout efter yderligere 1 min
  const resetInactivityTimer = useCallback(() => {
    setShowWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      inactivityTimer.current = setTimeout(() => {
        logoutUser();
      }, 60_000);
    }, 240_000);
  }, [logoutUser]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach(evt => window.addEventListener(evt, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const handleContinueSession = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
      <Dialog open={showWarning}>
        <DialogTitle>Inaktivitet registreret</DialogTitle>
        <DialogContent>
          <Typography>
            Du har været inaktiv i 4 minutter.<br />
            Du bliver automatisk logget ud om 1 minut.<br />
            Klik "Fortsæt session" for at forblive logget ind.
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
