import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useAuth } from "../auth/authcontext";
import { updateUser } from "../api";

// Hold denne regex synkroniseret med backend validate_password_strength().
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ChangePassword() {
  const { user: me, logoutUser } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);

  const passwordsMismatch = useMemo(
    () => repeatPassword.length > 0 && password !== repeatPassword,
    [password, repeatPassword]
  );

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!me?.id) {
      setError("Brugerdata mangler. Prøv at logge ind igen.");
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setError("Kodeord skal være mindst 8 tegn og indeholde store/små bogstaver samt tal.");
      return;
    }

    if (passwordsMismatch) {
      setError("Kodeordene matcher ikke.");
      return;
    }

    setLoading(true);
    try {
      await updateUser(me.id, { password, must_change_password: false });
      setSuccess(true);
      const start = Date.now();
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        setProgress(Math.min(100, (elapsed / 2000) * 100));
      }, 100);
      logoutTimerRef.current = setTimeout(async () => {
        await logoutUser();
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      setError(err?.message || "Kunne ikke opdatere kodeord.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 560, p: { xs: 2, sm: 4 } }}>
        <Typography variant="h5" fontWeight={700} mb={1}>
          Skift adgangskode
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Vælg en ny adgangskode for at fortsætte.
        </Typography>

        {success ? (
          <Stack spacing={2}>
            <Alert severity="success">Adgangskoden er opdateret. Du logges ud...</Alert>
            <LinearProgress variant="determinate" value={progress} />
          </Stack>
        ) : (
          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            <TextField
              label="Ny adgangskode"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowPassword((prev) => !prev)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Gentag ny adgangskode"
              type={showRepeatPassword ? "text" : "password"}
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              autoComplete="new-password"
              required
              error={passwordsMismatch}
              helperText={passwordsMismatch ? "Kodeordene matcher ikke." : " "}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowRepeatPassword((prev) => !prev)}>
                      {showRepeatPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={loading || passwordsMismatch}>
              {loading ? <CircularProgress size={22} color="inherit" /> : "Opdater adgangskode"}
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
