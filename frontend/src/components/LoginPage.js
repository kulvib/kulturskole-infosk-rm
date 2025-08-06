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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(""); // <- status tilføjet

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("Tjekker brugernavn og kodeord...");
    setLoading(true);
    try {
      const data = await login(username, password);
      setStatus("Login gennemført. Omdirigerer...");
      loginUser(data.access_token);
    } catch (err) {
      setError(err.message || "Ukendt fejl.");
      setStatus("Login mislykkedes.");
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
          {/* Status vises her */}
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
              {error ? error : status}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
