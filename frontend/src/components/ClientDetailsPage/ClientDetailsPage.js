import React, { useState, useEffect, useRef } from "react";
import { Box, Grid } from "@mui/material";
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
  getSchools,
} from "../../api";

export default function ClientDetailsPage({
  client,
  refreshing,
  markedDays,
  calendarLoading,
  streamKey,
  onRestartStream,
  showSnackbar
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
  const [pendingLivestream, setPendingLivestream] = useState(false);

  // NYT: State til skoler
  const [schools, setSchools] = useState([]);

  // Polling interval ref
  const pollingRef = useRef();

  // Hent skoler fra backend ved mount
  useEffect(() => {
    getSchools().then(setSchools).catch(() => setSchools([]));
  }, []);

  // Funktion til at hente klientdata fra backend
  const fetchClientData = async () => {
    if (!client?.id) return;
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
    } catch (err) {
      // Optionelt: showSnackbar({ message: "Kunne ikke hente klientdata", severity: "error" });
    }
  };

  // Poll hvert sekund, kun mens siden er åben
  useEffect(() => {
    if (client?.id) {
      fetchClientData(); // initial fetch
      pollingRef.current = setInterval(fetchClientData, 1000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line
  }, [client?.id]);

  // Hvis brugeren trykker på "Opdater" (fra header), skal data straks hentes
  const handleRefresh = async () => {
    await fetchClientData();
    if (showSnackbar) showSnackbar({ message: "Klientdata opdateret!", severity: "info" });
  };

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

  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      await updateClient(client.id, { locality });
      setLocalityDirty(false);
      showSnackbar && showSnackbar({ message: "Lokation gemt!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke gemme lokation: " + err.message, severity: "error" });
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
      showSnackbar && showSnackbar({ message: "Kiosk webadresse opdateret!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + err.message, severity: "error" });
    }
    setSavingKioskUrl(false);
  };

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
      showSnackbar && showSnackbar({ message: "Handlingen blev udført!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Fejl: " + err.message, severity: "error" });
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  useEffect(() => {
    if (client?.id) {
      clientAction(client.id, "livestream_start").catch(() => {});
    }
    // eslint-disable-next-line
  }, [client?.id]);

  if (!client) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", mt: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ClientDetailsHeaderSection
            client={client}
            schools={schools}
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
            handleRefresh={handleRefresh}
          />
        </Grid>
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
