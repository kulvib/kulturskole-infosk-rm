import React, { useState } from "react";
import SchoolAdministration from "./SchoolAdministration";
import UserAdministration from "./UserAdministration";
import { Box, Button, ButtonGroup, Paper } from "@mui/material";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("school");

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 2, mb: 3, textAlign: "center" }}>
        <ButtonGroup variant="contained">
          <Button
            onClick={() => setActiveTab("school")}
            color={activeTab === "school" ? "primary" : "inherit"}
            sx={{
              fontWeight: activeTab === "school" ? 700 : 400,
              borderRight: "2px solid #e0e0e0", // Adskil knapper visuelt
              minWidth: 170
            }}
          >
            Skoleadministration
          </Button>
          <Button
            onClick={() => setActiveTab("user")}
            color={activeTab === "user" ? "primary" : "inherit"}
            sx={{
              fontWeight: activeTab === "user" ? 700 : 400,
              minWidth: 170
            }}
          >
            Brugeradministration
          </Button>
        </ButtonGroup>
      </Paper>

      {/* Lille afstand mellem faner og indhold */}
      <Box sx={{ mb: 2 }} />

      {activeTab === "school" && (
        <Box sx={{ mb: 4 }}>
          <SchoolAdministration />
        </Box>
      )}
      {activeTab === "user" && (
        <Box sx={{ mb: 4 }}>
          <UserAdministration />
        </Box>
      )}
    </Box>
  );
}
