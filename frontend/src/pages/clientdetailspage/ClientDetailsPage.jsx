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
  getClient,
} from "../../api";

/*
  ClientDetailsPage.jsx (opdateret)
  - Preserves isOnline on merges; header handles local saves directly to backend.
  - Snackbar messages standardized: "Lokation gemt", "Kiosk webadresse gemt", "Skole gemt"
  - FIX: Lokal uptime-ticker der stiger hvert sekund i UI så oppetiden aldrig sidder fast.
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
  const [clientState, setClientState] = useState(client);
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);
  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status ?? "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color ?? null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen ?? null);
  const [uptime, setUptime] = useState(client?.uptime ?? null);

  // FIX: Lokal uptime-ticker — stiger hvert sekund så UI'et altid viser dynamisk oppetid.
  // Nulstilles/synkroniseres når backend sender en opdateret uptime-værdi.
  const [localUptime, setLocalUptime] = useState(client?.uptime ?? null);
  const localUptimeRef = useRef(client?.uptime ?? null);

  // Synkroniser localUptime når backend-uptime opdateres
  useEffect(() => {
    localUptimeRef.current = uptime;
    setLocalUptime(uptime);
  }, [uptime]);

  // Ticker: increment med 1 sekund hvert sekund
  useEffect(() => {
    const timer = setInterval(() => {
      const current = localUptimeRef.current;
      if (current !== null && current !== undefined && current !== "") {
        const n = parseInt(current, 10);
        if (!isNaN(n)) {
          const next = String(n + 1);
          localUptimeRef.current = next;
          setLocalUptime(next);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [pendingLivestream, setPendingLivestream] = useState(false);
  const [schools, setSchools] = useState([]);

  const lastPolledRef = useRef({
    timestamp: client?.chrome_last_updated ?? null,
    message: client?.chrome_status ?? null,
    lastSeen: client?.last_seen ?? null,
    uptime: client?.uptime ?? null,
  });
  const pollCountRef = useRef(0);

  // Helper: merge updated client men bevar previous isOnline med mindre server eksplicit returnerede det
  function mergeClientPreserveOnline(prev, updated) {
    if (!updated) return prev;
    return {
      ...(prev || {}),
      ...(updated || {}),
      isOnline: (typeof updated.isOnline === "undefined") ? prev?.isOnline : updated.isOnline
    };
  }

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
      setSchools(Array.isArray(data) ? data : (data && data.schools) ? data.schools : []);
    }).catch(() => {
      if (cancelled) return;
      setSchools([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!clientState?.id) return;
    let cancelled = false;
    let timerId = null;
    const POLL_INTERVAL_MS = 1000;

    const poll = async () => {
      if (cancelled) return;
      pollCountRef.current += 1;
      try {
        const json = await getChromeStatus(clientState.id, { fallbackToClient: true });
        const message = json?.chrome_status ?? (json?.step && json.step.message) ?? null;
        const color = json?.chrome_color ?? (json?.step && json.step.color) ?? null;
        const timestamp = json?.chrome_last_updated ?? (json?.step && json.step.timestamp) ?? null;
        const lastSeenVal = json?.last_seen ?? json?.client?.last_seen ?? null;
        const uptimeVal = json?.uptime ?? json?.client?.uptime ?? null;

        const last = lastPolledRef.current;
        const changed =
          (timestamp !== last.timestamp) ||
          (message !== last.message) ||
          (lastSeenVal !== last.lastSeen) ||
          (uptimeVal !== last.uptime);

        if (changed) {
          lastPolledRef.current = { timestamp, message, lastSeen: lastSeenVal, uptime: uptimeVal };
          if (!cancelled) {
            if (message !== null) setLiveChromeStatus(message);
            if (color !== null) setLiveChromeColor(color);
            if (lastSeenVal !== undefined) setLastSeen(lastSeenVal);
            // FIX: opdater backend-uptime; localUptime-ticker synkroniseres via useEffect
            if (uptimeVal !== undefined && uptimeVal !== null) setUptime(uptimeVal);
          }
        }
      } catch (err) {
        console.debug("[poll] getChromeStatus error:", err);
      } finally {
        if (!cancelled) timerId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [clientState?.id]);

  const memoizedClientId = clientState?.id ?? null;

  const handleClientAction = useCallback(async (action) => {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      if (!memoizedClientId) throw new Error("No client id");
      await apiClientAction(memoizedClientId, action);
      if (typeof handleRefresh === "function") {
        await handleRefresh();
      }
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
  const handleLocalitySave = async () => {
    if (!clientState?.id) return;
    setSavingLocality(true);
    try {
      const updated = await updateClient(clientState.id, { locality });
      console.debug("updateClient(locality) response:", updated);
      if (updated) {
        setClientState(prev => mergeClientPreserveOnline(prev, updated));
      } else {
        setClientState(prev => prev ? ({ ...prev, locality }) : prev);
      }
      setLocalityDirty(false);

      if (typeof handleRefresh === "function") {
        try { await handleRefresh(); } catch (e) { console.debug("handleRefresh after locality save failed:", e); }
      } else {
        if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt", severity: "success" });
      }
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke gemme lokation: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingLocality(false);
    }
  };

  const handleKioskUrlChange = (e) => { setKioskUrl(e.target.value); setKioskUrlDirty(true); };
  const handleKioskUrlSave = async () => {
    if (!clientState?.id) return;
    setSavingKioskUrl(true);
    try {
      const updated = await pushKioskUrl(clientState.id, kioskUrl);
      console.debug("pushKioskUrl response:", updated);
      if (updated) {
        setClientState(prev => mergeClientPreserveOnline(prev, updated));
      } else {
        setClientState(prev => prev ? ({ ...prev, kiosk_url: kioskUrl }) : prev);
      }

      if (typeof handleRefresh === "function") {
        try { await handleRefresh(); } catch (e) { console.debug("handleRefresh after kioskUrl save failed:", e); }
      }

      setKioskUrlDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse gemt", severity: "success" });
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
            uptime={localUptime}
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

      <ClientCalendarDialog open={calendarDialogOpen} onClose={() => setCalendarDialogOpen(false)} clientId={clientState.id} />
    </Box>
  );
}
