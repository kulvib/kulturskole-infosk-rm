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
} from "@mui/material";

export default function LoginPage() {
  const { token, loginUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Hvis allerede logget ind, så redirect væk fra login
  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      loginUser(data.access_token);
      // Efter login redirecter useEffect ovenfor automatisk
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

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
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
          Log ind på Kulturskole
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
            type="password"
            required
            variant="outlined"
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ mt: 1, fontWeight: 600 }}
          >
            {loading ? "Logger ind..." : "Log ind"}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </Paper>
    </Box>
  );
}
