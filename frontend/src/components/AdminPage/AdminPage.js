import React, { useState } from "react";
import SchoolAdministration from "./SchoolAdministration";
import UserAdministration from "./UserAdministration";
import { Box, Button, ButtonGroup, Paper } from "@mui/material";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("school");

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 2, mb: 3, textAlign: "center" }}>
        <ButtonGroup variant="contained">
          <Button
            onClick={() => setActiveTab("school")}
            color={activeTab === "school" ? "primary" : "inherit"}
          >
            Skoleadministration
          </Button>
          <Button
            onClick={() => setActiveTab("user")}
            color={activeTab === "user" ? "primary" : "inherit"}
          >
            Brugeradministration
          </Button>
        </ButtonGroup>
      </Paper>

      {activeTab === "school" && <SchoolAdministration />}
      {activeTab === "user" && <UserAdministration />}
    </Box>
  );
}
