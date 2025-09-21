import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, Button, Stack } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authcontext";
import axios from "axios";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

export default function HomePage() {
  const { user } = useAuth();
  const [schoolName, setSchoolName] = useState("");

  // Hent school name hvis bruger
  useEffect(() => {
    if (user && user.role === "bruger" && user.school_id) {
      axios
        .get(`${API_URL}/api/schools/`, {
          headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        })
        .then((res) => {
          const schools = res.data;
          const school = schools.find((s) => s.id === user.school_id);
          setSchoolName(school ? school.name : "");
        })
        .catch(() => setSchoolName(""));
    }
  }, [user]);

  return (
    <Box
      sx={{
        maxWidth: 500,
        mx: "auto",
        mt: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", textAlign: "center", borderRadius: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Infoskærm administration
        </Typography>
        {/* Besked til brugere/admins */}
        {user?.role !== "admin" && schoolName && (
          <Typography variant="subtitle1" sx={{ mb: 4 }}>
            Velkommen til administrationen af infoskærme for {schoolName}.
          </Typography>
        )}
        {/* For admin: teksten vises ikke */}
        <Stack spacing={2} direction="column" alignItems="center">
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/clients"
            size="large"
            sx={{ minWidth: 200 }}
          >
            Gå til klientoversigt
          </Button>
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/calendar"
            size="large"
            sx={{ minWidth: 200 }}
          >
            Gå til kalender side
          </Button>
          {user?.role === "admin" && (
            <Button
              variant="contained"
              color="primary"
              component={Link}
              to="/administration"
              size="large"
              sx={{ minWidth: 200 }}
            >
              Gå til administrator side
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
