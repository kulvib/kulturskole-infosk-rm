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
  ClientDetailsPage.js

  Poller /api/clients/:id/chrome-status hvert 1s og:
  - opdaterer chrome_status + chrome_color
  - opdaterer last_seen + uptime på samme måde (change-detektion strict !==)
  - hvis chrome-status endpoint ikke indeholder last_seen/uptime, bruger en fallback: kald getClient hvert 5. poll for kun at opdatere dem
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

  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status || "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color || null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen || null);
  const [uptime, setUptime] = useState(client?.uptime || null);

  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [pendingLivestream, setPendingLivestream] = useState(false);

  const [schools, setSchools] = useState([]);

  // remember last polled tokens/values (strict comparison)
  const lastPolledRef = useRef({
    timestamp: null,
    message: null,
    lastSeen: null,
    uptime: null,
  });

  // counter to schedule fallback getClient calls for last_seen/uptime if needed
  const pollCountRef = useRef(0);

  // Sync local clientState when incoming prop changes
  useEffect(() => {
    setClientState(client);
  }, [client]);

  // Init fields from clientState (respect dirty flags)
  useEffect(() => {
    if (!clientState) return;
    if (!localityDirty) setLocality(clientState.locality || "");
    if (!kioskUrlDirty) setKioskUrl(clientState.kiosk_url || "");
    setLiveChromeStatus(clientState.chrome_status ?? "unknown");
    setLiveChromeColor(clientState.chrome_color ?? null);
    setLastSeen(clientState.last_seen ?? null);
    setUptime(clientState.uptime ?? null);
    // initialize lastPolledRef so first poll has baseline from server-provided client
    lastPolledRef.current = {
      timestamp: clientState.chrome_last_updated ?? null,
      message: clientState.chrome_status ?? null,
      lastSeen: clientState.last_seen ?? null,
      uptime: clientState.uptime ?? null,
    };
  }, [clientState]);

  // Fetch schools if needed
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

  // Poll chrome-status every 1s. Also update last_seen + uptime using same strict logic.
  useEffect(() => {
    if (!clientState?.id) return;
    let cancelled = false;
    let timerId = null;
    const POLL_INTERVAL_MS = 1000;
    const FALLBACK_GETCLIENT_EVERY = 5; // every 5 polls (~5s) call getClient if needed

    const poll = async () => {
      if (cancelled) return;
      pollCountRef.current += 1;
      try {
        const json = await getChromeStatus(clientState.id);

        // prefer direct fields; fallback to step.* if necessary
        const message = json.chrome_status ?? (json.step && json.step.message) ?? null;
        const color = json.chrome_color ?? (json.step && json.step.color) ?? null;
        const timestamp = json.chrome_last_updated ?? (json.step && json.step.timestamp) ?? null;

        // try to extract last_seen and uptime from chrome-status response if present
        const lastSeenVal =
          json.last_seen ??
          json.client_last_seen ??
          json.chrome_last_seen ??
          (json.client && json.client.last_seen) ??
          null;

        const uptimeVal =
          json.uptime ??
          json.client_uptime ??
          json.chrome_uptime ??
          (json.client && json.client.uptime) ??
          null;

        const last = lastPolledRef.current;

        // strict comparison: update when any value !== previous value (handles falsy values too)
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
            // update local clientState so other sections see same info
            setClientState(prev => prev ? ({
              ...prev,
              chrome_status: message ?? prev.chrome_status,
              chrome_color: color ?? prev.chrome_color,
              last_seen: lastSeenVal ?? prev.last_seen,
              uptime: uptimeVal ?? prev.uptime,
              chrome_last_updated: timestamp ?? prev.chrome_last_updated,
            }) : prev);
          }
        }

        // fallback: if the chrome-status JSON didn't include last_seen/uptime, periodically call getClient
        const needFallbackForLastSeen = typeof lastSeenVal === "undefined" || lastSeenVal === null;
        const needFallbackForUptime = typeof uptimeVal === "undefined" || uptimeVal === null;
        if ((needFallbackForLastSeen || needFallbackForUptime) && (pollCountRef.current % FALLBACK_GETCLIENT_EVERY === 0)) {
          try {
            const full = await getClient(clientState.id);
            if (full) {
              const fsLastSeen = full.last_seen ?? null;
              const fsUptime = full.uptime ?? null;
              let updated = false;
              const lastRef = lastPolledRef.current;
              if (fsLastSeen !== lastRef.lastSeen) {
                lastPolledRef.current.lastSeen = fsLastSeen;
                if (!cancelled) setLastSeen(fsLastSeen);
                updated = true;
              }
              if (fsUptime !== lastRef.uptime) {
                lastPolledRef.current.uptime = fsUptime;
                if (!cancelled) setUptime(fsUptime);
                updated = true;
              }
              if (updated && !cancelled) {
                setClientState(prev => prev ? ({ ...prev, last_seen: fsLastSeen ?? prev.last_seen, uptime: fsUptime ?? prev.uptime }) : prev);
              }
            }
          } catch (e) {
            // ignore fallback errors
          }
        }
      } catch (err) {
        // ignore polling errors (auth/network) — wrapper may surface persistent errors elsewhere
      } finally {
        // schedule next poll
        if (!cancelled) {
          timerId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [clientState?.id]);

  // stable memoized clientId for callbacks
  const memoizedClientId = clientState?.id ?? null;

  // action handlers
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

  const handleOpenTerminal = useCallback(() => {
    if (!memoizedClientId) return;
    openTerminal(memoizedClientId);
  }, [memoizedClientId]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (!memoizedClientId) return;
    openRemoteDesktop(memoizedClientId);
  }, [memoizedClientId]);

  // header school update callback
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

  // locality handlers
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

  // kiosk url handlers
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

  // start livestream when client appears
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
            onSchoolUpdated={handleSchoolUpdated}
            showSnackbar={showSnackbar}
          />
        </Grid>

        <Grid item xs={12}>
          <ClientDetailsLivestreamSection clientId={clientState?.id} key={streamKey} />
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

      <ClientCalendarDialog open={calendarDialogOpen} onClose={() => setCalendarDialogOpen(false)} clientId={clientState.id} />
    </Box>
  );
}
