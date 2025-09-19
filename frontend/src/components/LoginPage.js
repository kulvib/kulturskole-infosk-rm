import { useState, useEffect } from "react";
import { useAuth } from "../auth/authcontext";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  IconButton,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function LoginPage() {
  const { token, loginUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setStatus("Login gennemført. Omdirigerer...");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 800);
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("Forbinder til server...");
    setLoading(true);

    try {
      setStatus("Tjekker brugernavn og kodeord...");
      const data = await login(username, password);

      if (data && data.access_token) {
        setStatus("Login gennemført. Omdirigerer...");

        // Her: Byg brugerobjektet til AuthContext
        let userObj;
        if (data.user) {
          userObj = data.user;
        } else {
          // Hvis backend kun returnerer token, brug input
          userObj = { username, fullName: username };
        }

        loginUser(data.access_token, userObj);
      } else {
        setError("Uventet svar fra serveren.");
        setStatus("Login mislykkedes.");
      }
    } catch (err) {
      if (err && err.message) {
        if (
          err.message.toLowerCase().includes("network") ||
          err.message.toLowerCase().includes("failed to fetch")
        ) {
          setStatus("Forbindelse til serveren mislykkedes.");
          setError("Kunne ikke oprette forbindelse til serveren. Prøv igen senere.");
        } else if (
          err.message.toLowerCase().includes("unauthorized") ||
          err.message.toLowerCase().includes("401")
        ) {
          setStatus("Forkert brugernavn eller kodeord.");
          setError("Brugernavn eller kodeord er forkert.");
        } else if (
          err.message.toLowerCase().includes("locked") ||
          err.message.toLowerCase().includes("spærret")
        ) {
          setStatus("Din konto er spærret.");
          setError("Din konto er spærret. Kontakt administrator.");
        } else {
          setStatus("Login mislykkedes.");
          setError(err.message);
        }
      } else {
        setStatus("Login mislykkedes.");
        setError("Ukendt fejl.");
      }
    }
    setLoading(false);
  };

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #b2fefa 0%, #0ed2f7 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          minWidth: 350,
          maxWidth: 380,
          textAlign: "center",
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
          Kulturskolen Viborg
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, fontWeight: 500 }}>
          infoskærm administration
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Brugernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            variant="outlined"
          />
          <TextField
            label="Kodeord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            required
            variant="outlined"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ mt: 1, fontWeight: 600 }}
          >
            {loading ? (
              <>
                <CircularProgress size={22} sx={{ mr: 1, verticalAlign: "middle" }} />
                Logger ind...
              </>
            ) : (
              "Log ind"
            )}
          </Button>
          {(status || error) && (
            <Typography
              sx={{
                mt: 2,
                color: error ? "error.main" : "text.secondary",
                fontWeight: 500,
                minHeight: 24,
              }}
              variant="body2"
            >
              {status}
            </Typography>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
