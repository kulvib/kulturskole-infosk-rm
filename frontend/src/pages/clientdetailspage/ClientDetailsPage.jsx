import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Container, Snackbar, Alert, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./DetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../calendarpage/ClientCalendarDialog";

import {
  getChromeStatus,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClient,
} from "../../api";

/*
  ClientDetailsPage.jsx

  Lock-logik — tre lag:

  1. PCA skal være "none" i backend (klienten har modtaget handlingen)

  2. Step-timestamp valideres mod action-starttidspunkt.
     Steps ældre end handlingen ignoreres — de tilhører en forrige handling.

  3. Chrome-step afgør unlock:
       BUSY-step     → altid låst (klienten er aktivt i gang)
       TERMINAL-step → unlock øjeblikkeligt (klienten er færdig)
       null/ukendt   → 0–2s: altid låst
                       2–8s: låst (nyt step ikke ankommet endnu)
                       8s+:  unlock (PCA clear + ingen aktiv proces)

  Faktiske step-navne fra chrome_kiosk.py / kiosk_sleep.py / kiosk_wake.py:

  BUSY_CHROME_STEPS:
    clear_cookies            — rydder cookies (start/stop/sleep)
    terminate_chrome         — SIGTERM til Chrome
    kill_chrome              — SIGKILL til Chrome (efter failed SIGTERM)
    shutdown_chrome          — chrome shutdown bekræftet
    countdown                — nedtælling før start eller sleep
    system_reboot_countdown  — nedtælling før reboot efter wake
    system_rebooting         — maskinen er ved at genstarte
    system_shutting_down     — maskinen er ved at lukke ned

  TERMINAL_CHROME_STEPS:
    start_chrome                   — start-handling færdig
    chrome_closed_programmatically — stop/sleep-handling færdig (watchdog)
    chrome_closed_manual           — Chrome lukket manuelt (watchdog)
    system_sleep                   — sleep-handling færdig
    system_wake                    — wake-handling færdig (reboot følger)
    error                          — scenario fejlede → processen stoppet

  Korrekt unlock-rækkefølge: silentRefresh() FØRST → unlock BAGEFTER.
*/

const CHROME_STATUS_POLL_MS = 1000;
const ACTION_POLL_MS        = 1500;
const ACTION_POLL_MAX_MS    = 60_000;
const ACTION_MIN_LOCK_MS    = 2000; // 0–2s: altid låst
const ACTION_NULL_STEP_MS   = 8000; // null-step låst indtil 8s, derefter unlock

// Faktiske transiente steps — processen er stadig i gang
const BUSY_CHROME_STEPS = new Set([
  "clear_cookies",           // rydder cookies (start/stop/sleep)
  "terminate_chrome",        // SIGTERM til Chrome
  "kill_chrome",             // SIGKILL til Chrome (efter failed SIGTERM)
  "shutdown_chrome",         // chrome shutdown bekræftet
  "countdown",               // nedtælling før start eller sleep
  "system_reboot_countdown", // nedtælling før reboot efter wake
  "system_rebooting",        // maskinen er ved at genstarte
  "system_shutting_down",    // maskinen er ved at lukke ned
]);

// Faktiske terminale steps — processen er fuldt færdig
const TERMINAL_CHROME_STEPS = new Set([
  "start_chrome",                   // start-handling færdig
  "chrome_closed_programmatically", // stop/sleep-handling færdig (watchdog)
  "chrome_closed_manual",           // Chrome lukket manuelt (watchdog)
  "system_sleep",                   // sleep-handling færdig
  "system_wake",                    // wake-handling færdig (reboot følger straks)
  "error",                          // scenario fejlede → processen stoppet
]);

export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  silentRefresh,
  onCancelActionPollRef,
  markedDays,
  calendarLoading,
  streamKey,
  onRestartStream,
  showSnackbar: showSnackbarProp,
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // --- Lokal snackbar (fallback) ---
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const showSnackbar = useCallback(
    (opts) => {
      if (typeof showSnackbarProp === "function") {
        showSnackbarProp(opts);
      } else {
        setSnackbar({
          open: true,
          message: opts?.message ?? "",
          severity: opts?.severity ?? "success",
        });
      }
    },
    [showSnackbarProp]
  );

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // --- Kalender dialog ---
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Live chrome-status — opdateres hvert 1s uden full re-render
  // ---------------------------------------------------------------------------
  const [liveChromeStatus, setLiveChromeStatus] = useState(
    client?.chrome_status ?? null
  );
  const [liveChromeColor, setLiveChromeColor] = useState(
    client?.chrome_color ?? null
  );
  const [liveStep, setLiveStep]           = useState(null);
  const liveStepRef                       = useRef(null);
  const liveStepTimestampRef              = useRef(null); // timestamp på seneste step

  // ---------------------------------------------------------------------------
  // Lokal pending_chrome_action + state
  // ---------------------------------------------------------------------------
  const [localPendingAction, setLocalPendingAction] = useState(
    client?.pending_chrome_action ?? "none"
  );
  const [localClientState, setLocalClientState] = useState(
    client?.state ?? "normal"
  );

  // Sync når parent client prop opdateres (manuel refresh)
  useEffect(() => {
    setLocalPendingAction(client?.pending_chrome_action ?? "none");
    setLocalClientState(client?.state ?? "normal");
  }, [client?.pending_chrome_action, client?.state]);

  // ---------------------------------------------------------------------------
  // Dynamisk oppetid
  // ---------------------------------------------------------------------------
  const [uptime, setUptime]     = useState(null);
  const uptimeBaseRef           = useRef(null);
  const uptimeFetchRef          = useRef(null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen ?? null);

  useEffect(() => {
    if (client?.uptime != null) {
      const parsed = parseInt(String(client.uptime), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        uptimeBaseRef.current  = parsed;
        uptimeFetchRef.current = Date.now();
        setUptime(parsed);
      }
    }
    if (client?.last_seen)             setLastSeen(client.last_seen);
    if (client?.chrome_status != null) setLiveChromeStatus(client.chrome_status);
    if (client?.chrome_color != null)  setLiveChromeColor(client.chrome_color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  // Lokal uptime ticker
  useEffect(() => {
    if (uptimeBaseRef.current == null || uptimeFetchRef.current == null) return;
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - uptimeFetchRef.current) / 1000);
      setUptime(uptimeBaseRef.current + elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Chrome-status polling — hvert 1s
  // ---------------------------------------------------------------------------
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!client?.id) return;
    mountedRef.current = true;
    let cancelled = false;

    async function poll() {
      while (!cancelled && mountedRef.current) {
        try {
          const data = await getChromeStatus(client.id, { fallbackToClient: true });
          if (cancelled || !mountedRef.current) break;

          if (data?.chrome_status != null) setLiveChromeStatus(data.chrome_status);
          if (data?.chrome_color != null)  setLiveChromeColor(data.chrome_color);
          if (data?.last_seen != null)     setLastSeen(data.last_seen);

          const stepName      = data?.step?.step ?? null;
          const stepTimestamp = data?.step?.timestamp ?? null;
          setLiveStep(stepName);
          liveStepRef.current          = stepName;
          liveStepTimestampRef.current = stepTimestamp;

          if (data?.uptime != null) {
            const parsed = parseInt(String(data.uptime), 10);
            if (!isNaN(parsed) && parsed >= 0) {
              uptimeBaseRef.current  = parsed;
              uptimeFetchRef.current = Date.now();
            }
          }
        } catch {
          // Ignorer poll-fejl
        }
        await new Promise((res) => setTimeout(res, CHROME_STATUS_POLL_MS));
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Cleanup ved unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // Action-pending polling
  // ---------------------------------------------------------------------------
  const [clientActionPending, setClientActionPending] = useState(false);
  const actionPollStopRef = useRef(false);

  const cancelActionPoll = useCallback(() => {
    actionPollStopRef.current = true;
    setClientActionPending(false);
    setLocalPendingAction("none");
  }, []);

  useEffect(() => {
    if (onCancelActionPollRef) {
      onCancelActionPollRef.current = cancelActionPoll;
    }
  }, [onCancelActionPollRef, cancelActionPoll]);

  const startActionConfirmationPolling = useCallback(() => {
    actionPollStopRef.current = false;
    setClientActionPending(true);

    // Gem starttidspunkt — bruges til at validere step-timestamps
    const startTime    = Date.now();
    const startTimeISO = new Date(startTime).toISOString();

    async function pollForConfirmation() {
      while (!actionPollStopRef.current && mountedRef.current) {
        if (Date.now() - startTime > ACTION_POLL_MAX_MS) break;

        await new Promise((res) => setTimeout(res, ACTION_POLL_MS));
        if (actionPollStopRef.current || !mountedRef.current) break;

        // Betingelse 1: pending_chrome_action skal være "none"
        let pcaClear = false;
        try {
          const data = await getClient(client.id);
          if (!mountedRef.current) break;

          const pca = String(data?.pending_chrome_action ?? "").toLowerCase();
          setLocalPendingAction(pca);
          if (data?.state) setLocalClientState(data.state);

          pcaClear = !pca || pca === "none";
        } catch {
          // Fortsæt polling ved fejl
        }

        if (!pcaClear) continue;

        const elapsed = Date.now() - startTime;

        // Zone 0–2s: altid låst — klienten når ikke at reagere endnu
        if (elapsed < ACTION_MIN_LOCK_MS) continue;

        // Valider step-timestamp mod action-starttidspunkt.
        // scenario_system_start kalder write_status([]) og rydder filen —
        // backend falder derefter tilbage til DB-værdien som er et forældet step.
        // Ignorér step hvis dets timestamp er ældre end handlingens start.
        const stepTimestamp = liveStepTimestampRef.current;
        const stepIsStale   = !stepTimestamp || stepTimestamp < startTimeISO;

        const currentStep = stepIsStale
          ? "" // behandl forældet step som null/ukendt
          : String(liveStepRef.current ?? "").toLowerCase();

        // BUSY-step: processen er stadig i gang — altid låst
        if (BUSY_CHROME_STEPS.has(currentStep)) continue;

        // TERMINAL-step: processen er fuldt færdig — unlock øjeblikkeligt
        if (TERMINAL_CHROME_STEPS.has(currentStep)) break;

        // null/ukendt/forældet step:
        // 2–8s: nyt step ikke ankommet endnu — vent
        // 8s+:  PCA clear + ingen aktiv proces → unlock
        if (elapsed < ACTION_NULL_STEP_MS) continue;

        break;
      }

      if (mountedRef.current && !actionPollStopRef.current) {
        // VIGTIGT: refresh FØRST → unlock BAGEFTER
        try {
          const refresh = silentRefresh ?? handleRefresh;
          await refresh();
        } catch {
          // Ignorer
        }
        setClientActionPending(false);
      }
    }

    pollForConfirmation();
  }, [client?.id, silentRefresh, handleRefresh]);

  // ---------------------------------------------------------------------------
  // Handlinger
  // ---------------------------------------------------------------------------
  const handleClientAction = useCallback(
    async (action) => {
      if (!client?.id) return;
      await clientAction(client.id, action);
      setLocalPendingAction(action);
      startActionConfirmationPolling();
    },
    [client?.id, startActionConfirmationPolling]
  );

  const handleOpenTerminal = useCallback(() => {
    if (client?.id) openTerminal(client.id);
  }, [client?.id]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (client?.id) openRemoteDesktop(client.id);
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Afledte værdier
  // ---------------------------------------------------------------------------
  const clientOnline  = client?.isOnline ?? false;
  const displayUptime = uptime != null ? uptime : client?.uptime ?? null;

  const effectivePendingAction = clientActionPending
    ? localPendingAction
    : (client?.pending_chrome_action ?? "none");

  const effectiveClientState = clientActionPending
    ? localClientState
    : (client?.state ?? "normal");

  return (
    <Container
      maxWidth="xl"
      disableGutters
      sx={{ px: isMobile ? 0.5 : 2, py: isMobile ? 0.5 : 2 }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? 1 : 2 }}>

        {/* 1 */}
        <ClientDetailsHeaderSection
          client={client}
          liveChromeStatus={liveChromeStatus}
          liveChromeColor={liveChromeColor}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          showSnackbar={showSnackbar}
          clientOnline={clientOnline}
        />

        {/* 2 */}
        <ClientDetailsLivestreamSection
          clientId={client?.id}
          streamKey={streamKey}
          refreshing={refreshing}
          onRestartStream={onRestartStream}
          clientOnline={clientOnline}
        />

        {/* 3 — FIX: calendarLoading sendes korrekt videre */}
        <ClientDetailsInfoSection
          client={client}
          markedDays={markedDays}
          uptime={displayUptime}
          lastSeen={lastSeen ?? client?.last_seen}
          setCalendarDialogOpen={setCalendarDialogOpen}
          clientOnline={clientOnline}
          calendarLoading={calendarLoading}
        />

        {/* 4 */}
        <ClientDetailsActionsSection
          clientId={client?.id}
          clientState={effectiveClientState}
          pendingChromeAction={effectivePendingAction}
          handleClientAction={handleClientAction}
          handleOpenTerminal={handleOpenTerminal}
          handleOpenRemoteDesktop={handleOpenRemoteDesktop}
          refreshing={refreshing}
          showSnackbar={showSnackbar}
          clientOnline={clientOnline}
          clientActionPending={clientActionPending}
          liveStep={liveStep}
          liveChromeStatus={liveChromeStatus}
        />

      </Box>

      <ClientCalendarDialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        clientId={client?.id}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        *
