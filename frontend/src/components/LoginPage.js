import React, { useState } from "react";
import { Avatar, Button, TextField, Box, Typography, Container, Alert, IconButton, InputAdornment } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/login`,
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );
      if (res.data && res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
        navigate("/");
      } else {
        setError("Login fejlede. Ugyldigt svar fra serveren.");
      }
    } catch (err) {
      setError("Login fejlede. Tjek brugernavn og adgangskode.");
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Avatar sx={{ m: 1, bgcolor: "primary.main" }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Login
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Brugernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Adgangskode"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((show) => !show)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
            LOG IND
          </Button>
        </Box>
        {/* DEBUG: Vis kode (brugerinput) */}
        <Box sx={{ mt: 4, width: "100%", bgcolor: "#f5f5f5", p: 2, borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Din kode (til debug):
          </Typography>
          <Typography variant="body2">Brugernavn: <b>{username}</b></Typography>
          <Typography variant="body2">
            Adgangskode:{" "}
            <b>
              {showPassword ? password : "*".repeat(password.length)}
            </b>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}
