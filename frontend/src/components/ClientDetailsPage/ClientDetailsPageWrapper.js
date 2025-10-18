import React, { useEffect, useState, useRef } from "react";
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

  // Central snackbar (wrapper) til al brugerfeedback
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  // Fejltilstand ved manglende adgang/404
  const [notFound, setNotFound] = useState(false);

  // Ref til interval så vi kan starte interval EFTER første fetch og rydde korrekt
  const intervalRef = useRef(null);

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
      // Ved fejl: vis notFound + snackbar
      setNotFound(true);
      setSnackbar({ open: true, message: "Ingen adgang eller klient ikke fundet", severity: "error" });
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    // IIFE for at kunne await før interval oprettes
    (async () => {
      if (!clientId) return;
      await fetchAllData(false); // initial hent
      if (cancelled) return;

      // Start interval EFTER initial fetch så child får client tidligt
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        fetchAllData(false);
      }, 15000); // full client: every 15s
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
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

  // Centraliseret snackbar-funktion, sendes ned til children som showSnackbar
  const handleShowSnackbar = (msgObj) => {
    if (!msgObj || typeof msgObj !== "object") return;
    setSnackbar({ open: true, message: msgObj.message || "", severity: msgObj.severity || "success" });
  };

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
      {/* Central (wrapper) snackbar */}
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

      <ClientDetailsPage
        client={client}
        refreshing={refreshing}
        handleRefresh={handleRefresh}
        markedDays={markedDays}
        calendarLoading={calendarLoading}
        streamKey={streamKey}
        onRestartStream={handleRestartStream}
        showSnackbar={handleShowSnackbar} // Central snackbar-funktion ned til child
      />
    </>
  );
}
