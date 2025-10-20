import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Grid } from "@mui/material";
import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./ClientDetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../CalendarPage/ClientCalendarDialog";
import {
  clientAction as apiClientAction,
  openTerminal,
  openRemoteDesktop,
  getSchools,
  getChromeStatus,
  getClient,
} from "../../api";

/*
  ClientDetailsPage.js (opdateret)
  - Parent no longer passes locality/kiosk save handlers to header.
  - Header saves locally; parent keeps polling/merge logic unchanged for other flows.
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

  // Helper: merge updated client but preserve previous isOnline unless server explicitly returned it
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

  useEffect(() => {
    if (memoizedClientId) {
      apiClientAction(memoizedClientId, "livestream_start").catch(() => {});
    }
  }, [memoizedClientId]);

  const memoActionLoading = useMemo(() => actionLoading, [actionLoading]);

  if (!clientState) return null;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", mt: 3, overflowX: "hidden" }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ClientDetailsHeaderSection
            client={clientState}
            schools={schools}
            liveChromeStatus={liveChromeStatus}
            liveChromeColor={liveChromeColor}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
            kioskBrowserData={clientState?.kiosk_browser_data || {}}
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
