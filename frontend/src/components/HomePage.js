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
        maxWidth: { xs: "100vw", sm: 420, md: 500 },
        mx: "auto",
        mt: { xs: 3, sm: 6, md: 8 },
        px: { xs: 1, sm: 0 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          width: "100%",
          maxWidth: 500,
          textAlign: "center",
          borderRadius: { xs: 2, sm: 3 },
          boxShadow: { xs: 1, sm: 3 },
        }}
      >
        <Typography
          variant="h4"
          sx={{
            mb: { xs: 1.5, sm: 2 },
            fontWeight: 700,
            fontSize: { xs: "1.35rem", sm: "1.65rem", md: "2.125rem" },
            letterSpacing: 0.1,
          }}
        >
          Infoskærm administration
        </Typography>
        {/* Besked til brugere/admins */}
        {user?.role !== "admin" && schoolName && (
          <Typography
            variant="subtitle1"
            sx={{
              mb: { xs: 3, sm: 4 },
              fontSize: { xs: "1.01rem", sm: "1.1rem", md: "1.18rem" },
              whiteSpace: "pre-line",
              fontWeight: 500,
            }}
          >
            Velkommen til administrationen af infoskærme for
            {"\n"}
            {schoolName}
          </Typography>
        )}
        {/* For admin: teksten vises ikke */}
        <Stack
          spacing={2}
          direction="column"
          alignItems="center"
          sx={{
            mt: { xs: 2, md: 0 },
            "& .MuiButton-root": {
              fontSize: { xs: "0.98rem", sm: "1.03rem", md: "1.08rem" },
              minHeight: { xs: 38, sm: 40, md: 44 }, // mindre knapper
              minWidth: { xs: 145, sm: 170, md: 180 }, // mindre knapper
              px: { xs: 1.5, sm: 2.5 },
              borderRadius: { xs: 1.5, sm: 2 },
              boxShadow: { xs: 1, sm: 2 },
              letterSpacing: 0.13,
            },
          }}
        >
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/clients"
            size="large"
          >
            Gå til klientoversigt
          </Button>
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/calendar"
            size="large"
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
            >
              Gå til administrator side
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
