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

  Ændringer:
  - Mere debug-logging på indkommende client props og API-respons ved save.
  - Konservativ merge-logik: undgår at acceptere isOnline === false fra server hvis der ikke
    er et tydeligt tidsstempel/bevis for offline (fx nyere last_seen eller chrome_last_updated).
  - Bevarer eksisterende optimistiske lokale opdateringer (undlader automatisk parent refresh).
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

  // Utility: parse timestamp-like values into numeric ms or null
  function parseTimeVal(v) {
    if (!v && v !== 0) return null;
    const n = Number(v);
    if (!isNaN(n)) return n;
    const d = Date.parse(String(v));
    return isNaN(d) ? null : d;
  }

  // Conservative decision: if server says isOnline === false but there's no newer evidence
  // (last_seen or chrome_last_updated) than our local state, preserve local isOnline=true.
  function shouldPreserveOnline(prev, updated) {
    try {
      if (!prev) return false;
      if (!updated) return false;
      if (typeof prev.isOnline === "undefined") return false;
      if (prev.isOnline !== true) return false; // we only preserve when prev was online
      if (updated.isOnline !== false) return false; // only consider the problematic false case

      // If server provides last_seen or chrome_last_updated, compare; if server's timestamp
      // is older or missing => do not trust the server flip.
      const prevLastSeen = parseTimeVal(prev.last_seen ?? prev.lastSeen ?? null);
      const updatedLastSeen = parseTimeVal(updated.last_seen ?? updated.lastSeen ?? null);
      const prevChromeTs = parseTimeVal(prev.chrome_last_updated ?? prev.chromeLastUpdated ?? null);
      const updatedChromeTs = parseTimeVal(updated.chrome_last_updated ?? updated.chromeLastUpdated ?? null);

      // If server provided no timestamps at all, preserve local online
      if (updatedLastSeen === null && updatedChromeTs === null) {
        console.debug("[merge] preserving isOnline=true because updated has no timestamps", { prev, updated });
        return true;
      }

      // If server timestamps are present but not newer than prev -> preserve
      if (updatedLastSeen !== null && prevLastSeen !== null && updatedLastSeen <= prevLastSeen) {
        console.debug("[merge] preserving isOnline=true because updated.last_seen is not newer", { prevLastSeen, updatedLastSeen });
        return true;
      }
      if (updatedChromeTs !== null && prevChromeTs !== null && updatedChromeTs <= prevChromeTs) {
        console.debug("[merge] preserving isOnline=true because updated.chrome_last_updated is not newer", { prevChromeTs, updatedChromeTs });
        return true;
      }

      // Otherwise, allow server to set offline
      return false;
    } catch (err) {
      console.debug("[merge] shouldPreserveOnline error:", err);
      return false;
    }
  }

  // Merge helper that preserves previous isOnline when appropriate
  function mergeClientPreserveOnline(prev, updated) {
    if (!updated) return prev;
    const base = { ...(prev || {}), ...(updated || {}) };
    // If server didn't include isOnline, preserve prev.isOnline
    if (typeof updated.isOnline === "undefined") {
      base.isOnline = prev?.isOnline;
      return base;
    }
    // If server explicitly set false but we should preserve, keep prev.isOnline
    if (updated.isOnline === false && shouldPreserveOnline(prev, updated)) {
      base.isOnline = prev?.isOnline;
      return base;
    }
    // Otherwise accept server value
    base.isOnline = updated.isOnline;
    return base;
  }

  // When parent prop client changes, merge conservatively for same client id
  useEffect(() => {
    console.debug("[ClientDetailsPage] incoming client prop:", client);
    setClientState(prev => {
      if (!prev || prev.id !== client?.id) {
        // new client or no prev -> take server value
        return client;
      }
      // same client -> merge conservatively
      const merged = mergeClientPreserveOnline(prev, client);
      console.debug("[ClientDetailsPage] merged client (preserveOnline):", { prev, client, merged });
      return merged;
    });
  }, [client]);

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

  const handleLocalityChange = (e) => { setLocality(e.target.value); setLocalityDirty(true); };
  const handleLocalitySave = async () => {
    if (!clientState?.id) return;
    setSavingLocality(true);
    try {
      const updated = await updateClient(clientState.id, { locality });
      console.debug("updateClient(locality) response:", updated);
      if (updated) {
        // merge svar fra API med lokal state - bevar isOnline hvis API ikke returnerede den eller hvis vi vurderer det ikke er troværdigt
        setClientState(prev => {
          const merged = mergeClientPreserveOnline(prev, updated);
          console.debug("[LocalitySave] prev -> updated -> merged:", { prev, updated, merged });
          return merged;
        });
      } else {
        setClientState(prev => prev ? ({ ...prev, locality }) : prev);
      }
      setLocalityDirty(false);

      // Vi undlader global handleRefresh her for at undgå full re-fetch
      if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt", severity: "success" });
    } catch (err) {
      console.debug("handleLocalitySave error:", err);
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
        setClientState(prev => {
          const merged = mergeClientPreserveOnline(prev, updated);
          console.debug("[KioskUrlSave] prev -> updated -> merged:", { prev, updated, merged });
          return merged;
        });
      } else {
        setClientState(prev => prev ? ({ ...prev, kiosk_url: kioskUrl }) : prev);
      }

      setKioskUrlDirty(false);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse gemt", severity: "success" });
    } catch (err) {
      console.debug("handleKioskUrlSave error:", err);
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
