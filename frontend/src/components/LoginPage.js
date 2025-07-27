import React, { useState } from "react";
import { Avatar, Button, TextField, Box, Typography, Container, Alert } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useAuth } from "../auth/AuthContext";
import { api, setAuthToken } from "../api/api";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/login", { username, password });
      if (res.data && res.data.access_token) {
        login(res.data.access_token);
        setAuthToken(res.data.access_token);
        navigate("/");
      } else {
        setError("Ugyldigt svar fra serveren");
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
        <Typography component="h1" variant="h5">Login</Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField margin="normal" required fullWidth label="Brugernavn" value={username} onChange={e => setUsername(e.target.value)} />
          <TextField margin="normal" required fullWidth label="Adgangskode" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>Log ind</Button>
        </Box>
      </Box>
    </Container>
  );
}
