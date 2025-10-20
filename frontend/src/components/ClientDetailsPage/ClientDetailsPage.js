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
  getClient,
} from "../../api";

/*
  ClientDetailsPage.js (opdateret)
  - Bevarer client.isOnline ved merge hvis backend ikke eksplicit returnerer isOnline.
  - Header-sektionen håndterer nu skole-opdatering lokalt og skriver kun til backend; parent modtager ikke længere partial update fra header.
  - Efter save forsøger vi at kalde handleRefresh hvis parent tilbyder det (henter authoritative klient).
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

  // Helper: merge updated client but preserve previous isOnline unless server explicitly provided it
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
            if (uptimeVal !== undefined) setUptime(uptimeVal);
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
      if (typeof showSnackbar === "function") showSnackbar({ message: "Handlingen blev udført!", severity: "success" });
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Fejl: " + (err?.message || err), severity: "error" });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [memoizedClientId, showSnackbar]);

  const handleOpenTerminal = useCallback(() => { if (!memoizedClientId) return; openTerminal(memoizedClientId); }, [memoizedClientId]);
  const handleOpenRemoteDesktop = useCallback(() => { if (!memoizedClientId) return; openRemoteDesktop(memoizedClientId); }, [memoizedClientId]);

  // NOTE:
  // Header handles school-save itself (only writes to backend) and does NOT call into parent anymore.
  // Therefore handleSchoolUpdated has been removed.

  const handleLocalityChange = (e) => { setLocality(e.target.value); setLocalityDirty(true); };
  const handleLocalitySave = async () => {
    if (!clientState?.id) return;
    setSavingLocality(true);
    try {
      const updated = await updateClient(clientState.id, { locality });
      // log for debugging (can remove later)
      console.debug("updateClient(locality) response:", updated);
      if (updated) {
        setClientState(prev => mergeClientPreserveOnline(prev, updated));
      } else {
        setClientState(prev => prev ? ({ ...prev, locality }) : prev);
      }
      setLocalityDirty(false);

      // prefer authoritative refresh if parent can do it
      if (typeof handleRefresh === "function") {
        try { await handleRefresh(); } catch (e) { console.debug("handleRefresh after locality save failed:", e); }
      } else {
        if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt!", severity: "success" });
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

      // call authoritative refresh if available
      if (typeof handleRefresh === "function") {
        try { await handleRefresh(); } catch (e) { console.debug("handleRefresh after kioskUrl save failed:", e); }
      }

      setKioskUrlDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse opdateret!", severity: "success" });
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingKioskUrl(false);
    }
  };

  useEffect(() => {
    if (memoizedClientId) {
      apiClientAction(memoizedClientId, "livestream_start").catch(() => {});
    }
  }, [memoizedClientId]);

  const memoActionLoading = useMemo(() => actionLoading, [actionLoading]);

  if (!clientState) return null;

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
            showSnackbar={showSnackbar}
          />
        </Grid>

        <Grid item xs={12}>
          {/* Her videregives refreshing og onRestartStream så livestream-sektionen kan vise spinner */}
          <ClientDetailsLivestreamSection
            clientId={clientState?.id}
            key={streamKey}
            refreshing={refreshing}
            onRestartStream={onRestartStream}
            streamKey={streamKey}
            clientOnline={clientState?.isOnline} /* NEW: inform livestream om online-status */
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
            clientOnline={clientState?.isOnline} /* NEW: inform actions om online-status */
          />
        </Grid>
      </Grid>

      <ClientCalendarDialog open={calendarDialogOpen} onClose={() => setCalendarDialogOpen(false)} clientId={clientState.id} />
    </Box>
  );
}
