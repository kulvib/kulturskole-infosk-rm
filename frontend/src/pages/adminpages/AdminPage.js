import React, { useState } from "react";
import SchoolAdministration from "./SchoolAdministration";
import UserAdministration from "./UserAdministration";
import { Box, Tabs, Tab, Paper } from "@mui/material";

export default function AdminPage() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (event, newValue) => setTabIndex(newValue);

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", mt: 4 }}>
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Skoleadministration" />
          <Tab label="Brugeradministration" />
        </Tabs>
      </Paper>
      <Box>
        {tabIndex === 0 && (
          <Box sx={{ mb: 4 }}>
            <SchoolAdministration />
          </Box>
        )}
        {tabIndex === 1 && (
          <Box sx={{ mb: 4 }}>
            <UserAdministration />
          </Box>
        )}
      </Box>
    </Box>
  );
}
