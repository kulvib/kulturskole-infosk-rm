import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Grid } from "@mui/material";
import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./DetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../calendarpage/ClientCalendarDialog";
import {
  updateClient,
  pushKioskUrl,
  clientAction as apiClientAction,
  openTerminal,
  openRemoteDesktop,
  getSchools,
  getChromeStatus,
} from "../../api";

function mergeClientPreserveOnline(prev, updated) {
  if (!updated) return prev;
  return {
    ...(prev || {}),
    ...(updated || {}),
    isOnline: (typeof updated.isOnline === "undefined") ? prev?.isOnline : updated.isOnline
  };
}

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
  const [clientState, setClientState] = useState(client);
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);
  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status ?? "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color ?? null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen ?? null);
  const [uptime, setUptime] = useState(client?.uptime ?? null);

  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [schools, setSchools] = useState([]);

  const lastPolledRef = useRef({
    timestamp: client?.chrome_last_updated ?? null,
    message: client?.chrome_status ?? null,
    lastSeen: client?.last_seen ?? null,
    uptime: client?.uptime ?? null,
  });
  const pollCountRef = useRef(0);

  useEffect(() => { setClientState(client); }, [client]);

  useEffect(() => {
    if (!clientState) return;
    if (!localityDirty) setLocality(clientState.locality || "");
    if (!kioskUrlDirty) setKioskUrl(clientState.kiosk_url || "");
    setLiveChromeStatus(clientState.chrome_status ?? "unknown");
    setLiveChromeColor(clientState.chrome_color ?? null);
    setLastSeen(clientState.last_seen ?? null);
    setUptime(clientState.uptime ?? null);
    lastPolledRef.current = {
      timestamp: clientState.chrome_last_updated ?? null,
      message: clientState.chrome_status ?? null,
      lastSeen: clientState.last_seen ?? null,
      uptime: clientState.uptime ?? null,
    };
    pollCountRef.current = 0;
  }, [clientState]);

  useEffect(() => {
    let cancelled = false;
    getSchools().then(data => {
      if (cancelled) return;
      setSchools(Array.isArray(data) ? data : (data?.schools || []));
    }).catch(() => { if (!cancelled) setSchools([]); });
    return () => { cancelled = true; };
  }, []);

  // FIX: Polling med korrekt cancelled-check + pause ved skjult tab
  useEffect(() => {
    if (!clientState?.id) return;
    let cancelled = false;
    let timerId = null;
    const POLL_INTERVAL_MS = 1000;

    const poll = async () => {
      if (cancelled) return;

      // FIX: Pause polling når tab er skjult
      if (document.visibilityState === "hidden") {
        if (!cancelled) timerId = setTimeout(poll, 5000);
        return;
      }

      pollCountRef.current += 1;
      try {
        const json = await getChromeStatus(clientState.id, { fallbackToClient: true });
        if (cancelled) return; // FIX: Tjek cancelled EFTER await

        const message = json?.chrome_status ?? (json?.step?.message) ?? null;
        const color = json?.chrome_color ?? (json?.step?.color) ?? null;
        const timestamp = json?.chrome_last_updated ?? (json?.step?.timestamp) ?? null;
        const lastSeenVal = json?.last_seen ?? json?.client?.last_seen ?? null;
        const uptimeVal = json?.uptime ?? json?.client?.uptime ?? null;

        const last = lastPolledRef.current;
        const changed =
          timestamp !== last.timestamp ||
          message !== last.message ||
          lastSeenVal !== last.lastSeen ||
          uptimeVal !== last.uptime;

        if (changed && !cancelled) {
          lastPolledRef.current = { timestamp, message, lastSeen: lastSeenVal, uptime: uptimeVal };
          if (message !== null) setLiveChromeStatus(message);
          if (color !== null) setLiveChromeColor(color);
          if (lastSeenVal !== undefined) setLastSeen(lastSeenVal);
          if (uptimeVal !== undefined) setUptime(uptimeVal);
        }
      } catch (err) {
        if (cancelled) return;
        console.debug("[poll] getChromeStatus error:", err);
      } finally {
        if (!cancelled) timerId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // FIX: Lyt på visibility change for at genoptage polling
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        if (timerId) clearTimeout(timerId);
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clientState?.id]);

  const memoizedClientId = clientState?.id ?? null;

  const handleClientAction = useCallback(async (action) => {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      if (!memoizedClientId) throw new Error("No client id");
      await apiClientAction(memoizedClientId, action);
      if (typeof handleRefresh === "function") await handleRefresh();
      if (typeof showSnackbar === "function") showSnackbar({ message: "Handlingen blev udført!", severity: "success" });
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Fejl: " + (err?.message || err), severity: "error" });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [memoizedClientId, showSnackbar, handleRefresh]);

  const handleOpenTerminal = useCallback(() => { if (!memoizedClientId) return; openTerminal(memoizedClientId); }, [memoizedClientId]);
  const handleOpenRemoteDesktop = useCallback(() => { if (!memoizedClientId) return; openRemoteDesktop(memoizedClientId); }, [memoizedClientId]);

  const handleLocalityChange = (e) => { setLocality(e.target.value); setLocalityDirty(true); };

  // FIX: Vis specifik snackbar altid — kald silent refresh bagefter
  const handleLocalitySave = async () => {
    if (!clientState?.id) return;
    setSavingLocality(true);
    try {
      const updated = await updateClient(clientState.id, { locality });
      if (updated) {
        setClientState(prev => mergeClientPreserveOnline(prev, updated));
      } else {
        setClientState(prev => prev ? ({ ...prev, locality }) : prev);
      }
      setLocalityDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt", severity: "success" });
      // FIX: Silent refresh — ingen snackbar fra handleRefresh
      if (typeof handleRefresh === "function") {
        try { await handleRefresh({ silent: true }); } catch { }
      }
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke gemme lokation: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingLocality(false);
    }
  };

  const handleKioskUrlChange = (e) => { setKioskUrl(e.target.value); setKioskUrlDirty(true); };

  // FIX: Vis specifik snackbar altid — kald silent refresh bagefter
  const handleKioskUrlSave = async () => {
    if (!clientState?.id) return;
    setSavingKioskUrl(true);
    try {
      const updated = await pushKioskUrl(clientState.id, kioskUrl);
      if (updated) {
        setClientState(prev => mergeClientPreserveOnline(prev, updated));
      } else {
        setClientState(prev => prev ? ({ ...prev, kiosk_url: kioskUrl }) : prev);
      }
      setKioskUrlDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse gemt", severity: "success" });
      // FIX: Silent refresh
      if (typeof handleRefresh === "function") {
        try { await handleRefresh({ silent: true }); } catch { }
      }
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingKioskUrl(false);
    }
  };

  const memoActionLoading = useMemo(() => actionLoading, [actionLoading]);

  if (!clientState) return null;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", mt: 3, overflowX: "hidden" }}>
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
            showSnackbar={showSnackbar}
          />
        </Grid>

        <Grid item xs={12}>
          <ClientDetailsLivestreamSection
            clientId={clientState?.id}
            key={streamKey}
            refreshing={refreshing}
            onRestartStream={onRestartStream}
            streamKey={streamKey}
            clientOnline={clientState?.isOnline}
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
            clientOnline={clientState?.isOnline}
          />
        </Grid>

        <Grid item xs={12}>
          <ClientDetailsActionsSection
            clientId={memoizedClientId}
            clientState={clientState?.state}
            pendingChromeAction={clientState?.pending_chrome_action}
            handleClientAction={handleClientAction}
            handleOpenTerminal={handleOpenTerminal}
            handleOpenRemoteDesktop={handleOpenRemoteDesktop}
            refreshing={refreshing}
            showSnackbar={showSnackbar}
            clientOnline={clientState?.isOnline}
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
