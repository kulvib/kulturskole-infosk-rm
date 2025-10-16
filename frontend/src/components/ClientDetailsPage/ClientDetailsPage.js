import React, { useState, useEffect } from "react";
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
  handleRefresh,
  markedDays,
  calendarLoading,
  streamKey,
  onRestartStream,
  showSnackbar
}) {
  // Local copy of client so we can update UI optimistically / refresh after changes
  const [clientState, setClientState] = useState(client);

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

  // Sync local clientState when incoming prop changes
  useEffect(() => {
    setClientState(client);
  }, [client]);

  // Initialize fields from clientState when it changes (but respect dirty flags)
  useEffect(() => {
    if (!clientState) return;
    if (!localityDirty) setLocality(clientState.locality || "");
    if (!kioskUrlDirty) setKioskUrl(clientState.kiosk_url || "");
    setLiveChromeStatus(clientState.chrome_status || "unknown");
    setLiveChromeColor(clientState.chrome_color || null);
    setLastSeen(clientState.last_seen || null);
    setUptime(clientState.uptime || null);
  }, [clientState]);

  // Hent skoler fra backend ved mount
  useEffect(() => {
    let cancelled = false;
    getSchools().then(data => {
      if (cancelled) return;
      setSchools(Array.isArray(data) ? data : (data && data.schools) ? data.schools : []);
    }).catch(() => {
      if (cancelled) return;
      setSchools([]);
    });
    return () => { cancelled = true; };
  }, []);

  // Poll opdateret klient-data (uafhængig af parent prop) for live-status/opdateringer
  useEffect(() => {
    let interval;
    if (clientState?.id) {
      const poll = async () => {
        try {
          const updated = await getClient(clientState.id);
          const pca = updated.pending_chrome_action;
          setPendingLivestream(
            pca === "livestream_start" || pca === "livestream_stop"
          );
          setLiveChromeStatus(updated.chrome_status || "unknown");
          setLiveChromeColor(updated.chrome_color || null);
          setLastSeen(updated.last_seen || null);
          setUptime(updated.uptime || null);
          // keep local clientState reasonably fresh
          setClientState(prev => {
            // shallow merge updated fields into prev to preserve local changes if any
            if (!prev) return updated;
            return { ...prev, ...updated };
          });
        } catch {}
      };
      poll();
      interval = setInterval(poll, 2000);
    }
    return () => clearInterval(interval);
  }, [clientState?.id]);

  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    if (!clientState?.id) return;
    setSavingLocality(true);
    try {
      const updated = await updateClient(clientState.id, { locality });
      // update local clientState with response if provided, otherwise patch locally
      if (updated) setClientState(prev => ({ ...(prev || {}), ...(updated || {}) }));
      else setClientState(prev => ({ ...(prev || {}), locality }));
      setLocalityDirty(false);
      showSnackbar && showSnackbar({ message: "Lokation gemt!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke gemme lokation: " + (err.message || err), severity: "error" });
    }
    setSavingLocality(false);
  };

  const handleKioskUrlChange = (e) => {
    setKioskUrl(e.target.value);
    setKioskUrlDirty(true);
  };
  const handleKioskUrlSave = async () => {
    if (!clientState?.id) return;
    setSavingKioskUrl(true);
    try {
      await pushKioskUrl(clientState.id, kioskUrl);
      // pushKioskUrl may not return full client; refresh client to be safe
      try {
        const refreshed = await getClient(clientState.id);
        if (refreshed) setClientState(refreshed);
      } catch {}
      setKioskUrlDirty(false);
      showSnackbar && showSnackbar({ message: "Kiosk webadresse opdateret!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err.message || err), severity: "error" });
    }
    setSavingKioskUrl(false);
  };

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(clientState.id, action);
      showSnackbar && showSnackbar({ message: "Handlingen blev udført!", severity: "success" });
    } catch (err) {
      showSnackbar && showSnackbar({ message: "Fejl: " + (err.message || err), severity: "error" });
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  const handleOpenTerminal = () => openTerminal(clientState.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(clientState.id);

  useEffect(() => {
    if (clientState?.id) {
      clientAction(clientState.id, "livestream_start").catch(() => {});
    }
    // eslint-disable-next-line
  }, [clientState?.id]);

  // Callback passed to header: update local clientState when school is updated
  const handleSchoolUpdated = async (updatedClient) => {
    if (!clientState) return;
    // If API returned a full updated client, use it; otherwise refresh from backend
    if (updatedClient && updatedClient.id === clientState.id && Object.keys(updatedClient).length > 1) {
      setClientState(prev => ({ ...(prev || {}), ...(updatedClient || {}) }));
    } else {
      try {
        const refreshed = await getClient(clientState.id);
        if (refreshed) setClientState(refreshed);
      } catch (err) {
        // ignore
      }
    }
    showSnackbar && showSnackbar({ message: "Skole opdateret", severity: "success" });
  };

  if (!clientState) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", mt: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ClientDetailsHeaderSection
            client={clientState}
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
            refreshing={refreshing}
            handleRefresh={handleRefresh}
            onSchoolUpdated={handleSchoolUpdated}
            showSnackbar={showSnackbar}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsLivestreamSection
            clientId={clientState?.id}
            key={streamKey}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsInfoSection
            client={clientState}
            markedDays={markedDays}
            uptime={uptime}
            lastSeen={lastSeen}
            calendarDialogOpen={calendarDialogOpen}
            setCalendarDialogOpen={setCalendarDialogOpen}
          />
        </Grid>
        <Grid item xs={12}>
          <ClientDetailsActionsSection
            clientId={clientState?.id}
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
        clientId={clientState.id}
      />
    </Box>
  );
}
