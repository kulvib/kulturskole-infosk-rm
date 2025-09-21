import React, { useState, useEffect } from "react";
import { Box, Grid, Card, Typography } from "@mui/material";
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

export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  markedDays,
  calendarLoading,
  streamKey,
  onRestartStream,
  snackbar,
  handleCloseSnackbar
}) {
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status || "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color || null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen || null);
  const [uptime, setUptime] = useState(client?.uptime || null);

  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

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

  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
      setLiveChromeStatus(client.chrome_status || "unknown");
      setLiveChromeColor(client.chrome_color || null);
      setLastSeen(client.last_seen || null);
      setUptime(client.uptime || null);
    }
  }, [client]);

  // showSnackbar bruges kun til lokale handlinger (Gem osv.)
  const showSnackbar = (message, severity = "success") => {
    // Her skal du KUN bruge denne funktion til lokale beskeder, ikke til refresh!
    // Refresh-snackbar styres i wrapperen.
    if (snackbar && typeof snackbar === "function") {
      snackbar({ open: true, message, severity });
    }
  };

  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      await updateClient(client.id, { locality });
      setLocalityDirty(false);
      showSnackbar("Lokation gemt!", "success");
    } catch (err) {
      showSnackbar("Kunne ikke gemme lokation: " + err.message, "error");
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
      showSnackbar("Kiosk webadresse opdateret!", "success");
    } catch (err) {
      showSnackbar("Kunne ikke opdatere kiosk webadresse: " + err.message, "error");
    }
    setSavingKioskUrl(false);
  };

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
      showSnackbar("Handlingen blev udført!", "success");
      // status opdateres i polleren
    } catch (err) {
      showSnackbar("Fejl: " + err.message, "error");
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
        refreshing={refreshing}
        handleRefresh={handleRefresh}
        snackbar={snackbar}
        handleCloseSnackbar={handleCloseSnackbar}
      />
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ClientDetailsLivestreamSection
            clientId={client?.id}
            key={streamKey}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsInfoSection
            client={client}
            markedDays={markedDays}
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
  );
}
