import React, { useState } from "react";
import { Box, Grid, Snackbar } from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import ClientDetailsHeader from "./ClientDetailsHeader";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActions from "./ClientDetailsActions";
import ClientDetailsLivestream from "./ClientDetailsLivestream";
import ClientCalendarDialog from "./ClientCalendarDialog";

export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  markedDays,
}) {
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  if (!client) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Klientdata indlæses...</Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 3 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ClientDetailsHeader
            client={client}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
            showSnackbar={showSnackbar}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsInfoSection
            client={client}
            markedDays={markedDays}
            calendarDialogOpen={calendarDialogOpen}
            setCalendarDialogOpen={setCalendarDialogOpen}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsActions
            client={client}
            showSnackbar={showSnackbar}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsLivestream />
        </Grid>
      </Grid>
      <ClientCalendarDialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        clientId={client.id}
      />
    </Box>
  );
}
