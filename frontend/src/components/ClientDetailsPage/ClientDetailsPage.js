import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Grid } from "@mui/material";
import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./ClientDetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../CalendarPage/ClientCalendarDialog";
import {
  updateClient,
  pushKioskUrl,
  clientAction as apiClientAction,
  openTerminal,
  openRemoteDesktop,
  getSchools,
  getChromeStatus,
} from "../../api";

/*
  ClientDetailsPage.js - uses api.getChromeStatus for 1s polling
  - polling via recursive setTimeout
  - updates liveChromeStatus from json.chrome_status (or fallback to step.message)
  - uses getChromeStatus which attaches Authorization header (JWT)
*/

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
  // Local copy of client so we can update UI optimistically / reflect small immediate changes
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

  // Schools
  const [schools, setSchools] = useState([]);

  // Ref to remember last chrome-status step timestamp/message so we only update on change
  const lastChromeStepRef = useRef({ timestamp: null, message: null });

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

  // Poll chrome-status every 1s using api.getChromeStatus
  useEffect(() => {
    if (!clientState?.id) return;
    let cancelled = false;
    let timerId = null;
    const POLL_INTERVAL_MS = 1000;

    const poll = async () => {
      if (cancelled) return;
      try {
        const json = await getChromeStatus(clientState.id);
        // prefer direct chrome_status field, fallback to step
        const message = json.chrome_status ?? (json.step && json.step.message) ?? null;
        const color = json.chrome_color ?? (json.step && json.step.color) ?? null;
        const timestamp = json.chrome_last_updated ?? (json.step && json.step.timestamp) ?? null;

        const last = lastChromeStepRef.current;
        const changed = (timestamp && timestamp !== last.timestamp) || (message && message !== last.message);
        if (changed) {
          lastChromeStepRef.current = { timestamp, message };
          if (!cancelled) {
            if (message !== null) setLiveChromeStatus(message);
            if (color !== null) setLiveChromeColor(color);
            // update clientState locally so header shows same info immediately
            setClientState(prev => prev ? ({ ...prev, chrome_status: message, chrome_color: color }) : prev);
          }
        }
      } catch (err) {
        // ignore errors — could be auth/network; wrapper's snackbar can show persistent errors if desired
        // optional: if you want visible debug: console.debug('chrome-status poll error', err);
      } finally {
        if (!cancelled) {
          timerId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    // start polling immediately
    poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [clientState?.id]);

  // Stable, memoized clientId to use in callbacks
  const memoizedClientId = clientState?.id ?? null;

  // Stabilize callbacks for Actions-section to avoid unnecessary rerenders
  const handleClientAction = useCallback(async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      if (!memoizedClientId) throw new Error("No client id");
      await apiClientAction(memoizedClientId, action);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Handlingen blev udført!", severity: "success" });
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Fejl: " + (err?.message || err), severity: "error" });
    } finally {
      setActionLoading((prev) => ({ ...prev, [action]: false }));
    }
  }, [memoizedClientId, showSnackbar]);

  const handleOpenTerminal = useCallback(() => {
    if (!memoizedClientId) return;
    openTerminal(memoizedClientId);
  }, [memoizedClientId]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (!memoizedClientId) return;
    openRemoteDesktop(memoizedClientId);
  }, [memoizedClientId]);

  // Callback passed to header: update local clientState when school is updated
  const handleSchoolUpdated = useCallback(async (updatedClient) => {
    if (!clientState) return;
    if (updatedClient && updatedClient.id === clientState.id && Object.keys(updatedClient).length > 1) {
      setClientState(prev => ({ ...(prev || {}), ...(updatedClient || {}) }));
    } else {
      if (typeof handleRefresh === "function") {
        try { await handleRefresh(); } catch {}
      }
    }
    if (typeof showSnackbar === "function") showSnackbar({ message: "Skole opdateret", severity: "success" });
  }, [clientState, handleRefresh, showSnackbar]);

  // Locality handlers
  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    if (!clientState?.id) return;
    setSavingLocality(true);
    try {
      const updated = await updateClient(clientState.id, { locality });
      if (updated) setClientState(prev => ({ ...(prev || {}), ...(updated || {}) }));
      else setClientState(prev => ({ ...(prev || {}), locality }));
      setLocalityDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt!", severity: "success" });
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke gemme lokation: " + (err?.message || err), severity: "error" });
    }
    setSavingLocality(false);
  };

  // Kiosk URL handlers
  const handleKioskUrlChange = (e) => {
    setKioskUrl(e.target.value);
    setKioskUrlDirty(true);
  };
  const handleKioskUrlSave = async () => {
    if (!clientState?.id) return;
    setSavingKioskUrl(true);
    try {
      await pushKioskUrl(clientState.id, kioskUrl);
      if (typeof handleRefresh === "function") {
        try { await handleRefresh(); } catch {}
      } else {
        setClientState(prev => prev ? ({ ...prev, kiosk_url: kioskUrl }) : prev);
      }
      setKioskUrlDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse opdateret!", severity: "success" });
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err?.message || err), severity: "error" });
    }
    setSavingKioskUrl(false);
  };

  // Ensure livestream_start is triggered when client appears
  useEffect(() => {
    if (memoizedClientId) {
      apiClientAction(memoizedClientId, "livestream_start").catch(() => {});
    }
    // intentionally only when client id changes
  }, [memoizedClientId]);

  // Memoize actionLoading to avoid prop reference churn
  const memoActionLoading = useMemo(() => actionLoading, [actionLoading]);

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
            clientId={memoizedClientId}
            handleClientAction={handleClientAction}
            handleOpenTerminal={handleOpenTerminal}
            handleOpenRemoteDesktop={handleOpenRemoteDesktop}
            refreshing={refreshing}
            showSnackbar={showSnackbar}
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
