import React, { useState, useEffect } from "react";
import { Typography, Box, TextField, Button, List, ListItem } from "@mui/material";
import axios from "axios";

export default function AdminPage() {
  const [schoolName, setSchoolName] = useState("");
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState("");

  // Hent skolelisten fra backend ved load
  useEffect(() => {
    axios.get("/api/schools/")
      .then(res => setSchools(res.data))
      .catch(() => setSchools([]));
  }, []);

  // Tilføj skole til backend og opdater listen
  const handleAddSchool = () => {
    const name = schoolName.trim();
    setError("");
    if (!name) return;
    if (schools.some(s => s.name === name)) {
      setError("Skolen findes allerede!");
      return;
    }
    axios.post("/api/schools/", { name })
      .then(res => {
        setSchools([...schools, res.data]);
        setSchoolName("");
      })
      .catch(e => {
        setError(e.response?.data?.detail || "Fejl ved oprettelse");
      });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Administration
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Her kan jeg oprette administration af f.eks. bruger opretning og andet.
      </Typography>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Tilføj og se godkendte skoler</Typography>
        <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
          <TextField
            label="Skole-navn"
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            error={!!error}
            helperText={error}
          />
          <Button variant="contained" onClick={handleAddSchool}>
            Tilføj skole
          </Button>
        </Box>
        <List sx={{ mt: 2 }}>
          {schools.map((school) => (
            <ListItem key={school.id}>{school.name}</ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
}
