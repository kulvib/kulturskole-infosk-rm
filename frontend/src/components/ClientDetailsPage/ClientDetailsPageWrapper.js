import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getClient, getMarkedDays, getCurrentSeason } from "../../api";
import ClientDetailsPage from "./ClientDetailsPage";
import { Snackbar, Alert as MuiAlert, Box, Card, Typography } from "@mui/material";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  // Wrapper-snackbar (global besked, fx refresh OK eller fetch-fejl)
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  // Fejltilstand ved manglende adgang/404
  const [notFound, setNotFound] = useState(false);

  // Fetch all data
  const fetchAllData = async (forceUpdate = false) => {
    if (!clientId) return;
    setCalendarLoading(true);
    setNotFound(false);
    try {
      const [clientData, season] = await Promise.all([
        getClient(clientId),
        getCurrentSeason()
      ]);
      const calendarData = await getMarkedDays(season.id, clientId);

      setClient(prev => {
        if (forceUpdate || JSON.stringify(clientData) !== JSON.stringify(prev)) {
          return clientData;
        }
        return prev;
      });

      setMarkedDays({ ...calendarData?.markedDays });
    } catch (err) {
      setNotFound(true);
      setSnackbar({ open: true, message: "Ingen adgang eller klient ikke fundet", severity: "error" });
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(() => fetchAllData(false), 15000);
    return () => clearInterval(timer);
  }, [clientId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData(true);
    setRefreshing(false);
    setSnackbar({ open: true, message: "Data opdateret!", severity: "success" });
    setStreamKey(k => k + 1); // Genstart stream sammen med opdatering
  };

  const handleRestartStream = () => {
    setStreamKey(k => k + 1);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  // Lokal snackbar til lokale handlinger (vises kun i ClientDetailsPage)
  const [localSnackbar, setLocalSnackbar] = useState({ open: false, message: "", severity: "success" });
  const handleLocalSnackbar = (msgObj) => setLocalSnackbar({ ...msgObj, open: true });
  const handleCloseLocalSnackbar = () => setLocalSnackbar({ open: false, message: "", severity: "success" });

  // Hvis fejlet fetch/adgang -> vis fejl
  if (notFound) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" color="error">
            Klienten blev ikke fundet eller du har ikke adgang.
          </Typography>
        </Card>
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
      </Box>
    );
  }

  return (
    <>
      {/* Global (wrapper) snackbar */}
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
      {/* Lokal snackbar fra child */}
      <Snackbar
        open={localSnackbar.open}
        autoHideDuration={3400}
        onClose={handleCloseLocalSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseLocalSnackbar} severity={localSnackbar.severity}>
          {localSnackbar.message}
        </MuiAlert>
      </Snackbar>
      <ClientDetailsPage
        client={client}
        refreshing={refreshing}
        handleRefresh={handleRefresh}
        markedDays={markedDays}
        calendarLoading={calendarLoading}
        streamKey={streamKey}
        onRestartStream={handleRestartStream}
        showSnackbar={handleLocalSnackbar} // Funktion ned til child!
      />
    </>
  );
}
