import React, { useState, useEffect } from "react";
import { Box, Grid, Card, Typography, CircularProgress, Snackbar, Alert as MuiAlert } from "@mui/material";
import { useParams } from "react-router-dom";
import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./ClientDetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../CalendarPage/ClientCalendarDialog";
import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClient,
} from "../../api";
import { useAuth } from "../../auth/authcontext";

export default function ClientDetailsPage() {
  const { id } = useParams();
  const { token } = useAuth();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // Local edit states
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  const [liveChromeStatus, setLiveChromeStatus] = useState("unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const [uptime, setUptime] = useState(null);

  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  // Livestream-related state
  const [loadingStartLivestream, setLoadingStartLivestream] = useState(false);
  const [loadingStopLivestream, setLoadingStopLivestream] = useState(false);
  const [pendingLivestream, setPendingLivestream] = useState(false);

  // Poll for pending_chrome_action og opdater pendingLivestream state
  useEffect(() => {
    let interval;
    if (client?.id) {
      const poll = async () => {
        try {
          const updated = await getClient(client.id);
          const pca = updated.pending_chrome_action;
          setPendingLivestream(
            pca === "livestream_start" || pca === "livestream_stop"
          );
          setLiveChromeStatus(updated.chrome_status || "unknown");
          setLiveChromeColor(updated.chrome_color || null);
          setLastSeen(updated.last_seen || null);
          setUptime(updated.uptime || null);
        } catch {}
      };
      poll();
      interval = setInterval(poll, 2000);
    }
    return () => clearInterval(interval);
  }, [client?.id]);

  // Fetch client data by id from API
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    getClient(id)
      .then((data) => {
        setClient(data);
        setLoading(false);
        setLocality(data.locality || "");
        setKioskUrl(data.kiosk_url || "");
        setLiveChromeStatus(data.chrome_status || "unknown");
        setLiveChromeColor(data.chrome_color || null);
        setLastSeen(data.last_seen || null);
        setUptime(data.uptime || null);
      })
      .catch((err) => {
        setNotFound(true);
        setLoading(false);
        setSnackbar({ open: true, message: err.message || "Ingen adgang eller klient ikke fundet", severity: "error" });
      });
  }, [id, token]);

  // Keep locality/kioskUrl in sync unless user is editing
  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
      setLiveChromeStatus(client.chrome_status || "unknown");
      setLiveChromeColor(client.chrome_color || null);
      setLastSeen(client.last_seen || null);
      setUptime(client.uptime || null);
    }
    // eslint-disable-next-line
  }, [client]);

  // Snackbar-håndtering
  const handleShowSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };
  const handleCloseSnackbar = () => setSnackbar({ open: false, message: "", severity: "info" });

  // Handlers for local editing
  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      await updateClient(client.id, { locality });
      setLocalityDirty(false);
      handleShowSnackbar("Lokation gemt!", "success");
    } catch (err) {
      handleShowSnackbar("Kunne ikke gemme lokation: " + err.message, "error");
    }
    setSavingLocality(false);
  };

  const handleKioskUrlChange = (e) => {
    setKioskUrl(e.target.value);
    setKioskUrlDirty(true);
  };
  const handleKioskUrlSave = async () => {
    setSavingKioskUrl(true);
    try {
      await pushKioskUrl(client.id, kioskUrl);
      setKioskUrlDirty(false);
      handleShowSnackbar("Kiosk webadresse opdateret!", "success");
    } catch (err) {
      handleShowSnackbar("Kunne ikke opdatere kiosk webadresse: " + err.message, "error");
    }
    setSavingKioskUrl(false);
  };

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
      handleShowSnackbar("Handlingen blev udført!", "success");
      // status opdateres i polleren
    } catch (err) {
      handleShowSnackbar("Fejl: " + err.message, "error");
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  // --- HER STARTER STREAMET AUTOMATISK ---
  useEffect(() => {
    if (client?.id) {
      clientAction(client.id, "livestream_start").catch(() => {});
    }
    // eslint-disable-next-line
  }, [client?.id]);
  // --- SLUT AUTOMATISK START ---

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Indlæser klientdata...</Typography>
      </Box>
    );
  }

  if (notFound || !client) {
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
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3400}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      <Box sx={{ maxWidth: 1200, mx: "auto", mt: 3 }}>
        <ClientDetailsHeaderSection
          client={client}
          locality={locality}
          localityDirty={localityDirty}
          savingLocality={savingLocality}
          handleLocalityChange={handleLocalityChange}
          handleLocalitySave={handleLocalitySave}
          kioskUrl={kioskUrl}
          kioskUrlDirty={kioskUrlDirty}
          savingKioskUrl={savingKioskUrl}
          handleKioskUrlChange={handleKioskUrlChange}
          handleKioskUrlSave={handleKioskUrlSave}
          liveChromeStatus={liveChromeStatus}
          liveChromeColor={liveChromeColor}
          refreshing={false}
          handleRefresh={() => {}}
          snackbar={handleShowSnackbar}
          handleCloseSnackbar={handleCloseSnackbar}
        />
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ClientDetailsLivestreamSection
              clientId={client?.id}
              key={client?.id}
            />
          </Grid>
          <Grid item xs={12}>
            <ClientDetailsInfoSection
              client={client}
              markedDays={undefined}
              uptime={uptime}
              lastSeen={lastSeen}
              calendarDialogOpen={calendarDialogOpen}
              setCalendarDialogOpen={setCalendarDialogOpen}
            />
          </Grid>
          <Grid item xs={12}>
            <ClientDetailsActionsSection
              clientId={client?.id}
              actionLoading={actionLoading}
              handleClientAction={handleClientAction}
              handleOpenTerminal={handleOpenTerminal}
              handleOpenRemoteDesktop={handleOpenRemoteDesktop}
              shutdownDialogOpen={shutdownDialogOpen}
              setShutdownDialogOpen={setShutdownDialogOpen}
            />
          </Grid>
        </Grid>
        <ClientCalendarDialog
          open={calendarDialogOpen}
          onClose={() => setCalendarDialogOpen(false)}
          clientId={client.id}
        />
      </Box>
    </>
  );
}
