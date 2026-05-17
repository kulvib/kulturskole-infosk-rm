// src/auth/authcontext.jsx
// AuthContext med HttpOnly-cookie + Bearer token fallback for Safari.
// Token gemmes i localStorage og sendes som Authorization-header
// så Safari ikke blokerer cross-site cookies.
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

// Inaktivitetspolitik:
// - Vis advarsel efter 25 minutter uden aktivitet.
// - Log automatisk ud efter yderligere 5 minutter.
// Det giver 30 minutter total inaktivitet og passer bedre til livestream,
// terminal og klientovervågning end den tidligere 4+1 minutters timer.
const WARNING_AFTER_MS = 25 * 60_000;
const LOGOUT_AFTER_WARNING_MS = 5 * 60_000;

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

  // Synkronisér brugerdata og token med localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  }, [user]);

  const loginUser = useCallback((userData, token) => {
    // Gem token i localStorage så det kan bruges som Bearer header (Safari-fix)
    if (token) {
      localStorage.setItem("token", token);
    }
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
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }, [navigate]);

  // Inaktivitets-timer: advarsel efter 25 min, logout efter yderligere 5 min
  const resetInactivityTimer = useCallback(() => {
    setShowWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      inactivityTimer.current = setTimeout(() => {
        logoutUser();
      }, LOGOUT_AFTER_WARNING_MS);
    }, WARNING_AFTER_MS);
  }, [logoutUser]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const handleContinueSession = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const isSuperadmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || isSuperadmin;

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser, isAdmin, isSuperadmin }}>
      {children}
      <Dialog open={showWarning}>
        <DialogTitle>Inaktivitet registreret</DialogTitle>
        <DialogContent>
          <Typography>
            Du har været inaktiv i 25 minutter.<br />
            Du bliver automatisk logget ud om 5 minutter.<br />
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
