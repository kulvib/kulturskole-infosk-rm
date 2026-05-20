import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Container, Snackbar, Alert, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./DetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../calendarpage/ClientCalendarDialog";
import ClientTerminalDialog from "./terminal/ClientTerminalDialog";

import {
  getChromeStatus,
  clientAction,
  openRemoteDesktop,
  getClient,
} from "../../api";

/*
  ClientDetailsPage.jsx

  Lock-logik — tre lag:

  1. PCA skal være "none" i backend (klienten har modtaget handlingen)

  2. Step-timestamp valideres mod action-starttidspunkt.
     Steps ældre end handlingen ignoreres — de tilhører en forrige handling.

  3. Chrome-step afgør unlock — handlings-specifikt via TERMINAL_STEPS_BY_ACTION.
     Terminal tjekkes ALTID før busy — vigtigt for reboot/shutdown hvor
     system_rebooting/system_shutting_down er i BUSY_CHROME_STEPS (for banneret)
     men skal være terminal for deres respektive actions.

  PROBLEMS DER LØSES:

  A) "start" — chrome_closed_programmatically må ikke være terminal:
       clear_cookies (BUSY) → shutdown_chrome (terminal, ikke busy)
       → watchdog: chrome_closed_programmatically   ← MÅ IKKE UNLOCK
       → countdown (BUSY) → start_chrome (TERMINAL ✓)

  B) "sleep" — chrome_closed_programmatically må ikke være terminal:
       shutdown_chrome → watchdog: chrome_closed_programmatically ← MÅ IKKE UNLOCK
       → countdown (BUSY) → system_sleep (TERMINAL ✓)

  C) "reboot"/"shutdown" — terminal skal tjekkes FØR busy:
       shutdown_chrome → system_rebooting  ← BUSY i sættet men TERMINAL for action
       Uden fix: polling venter 60s timeout fordi BUSY altid vinder.
       Med fix: terminal tjekkes først → unlock korrekt.

  Faktiske step-navne fra chrome_kiosk.py / kiosk_sleep.py / kiosk_wake.py:

  BUSY_CHROME_STEPS (låser knapper + banner i DetailsActionsSection):
    clear_cookies            — rydder cookies
    terminate_chrome         — SIGTERM til Chrome
    kill_chrome              — SIGKILL til Chrome
    countdown                — nedtælling før start eller sleep
    system_reboot_countdown  — nedtælling før reboot efter wake
    system_rebooting         — maskinen genstarter (også terminal for reboot-action)
    system_shutting_down     — maskinen lukker ned (også terminal for shutdown-action)

  FIX: shutdown_chrome er FJERNET fra BUSY_CHROME_STEPS — det er et
  terminal-step (Chrome er færdig med at lukke), ikke et busy-step.
  Tidligere sad polling-løkken fast på "continue" ved shutdown_chrome
  fordi BUSY altid vandt over terminal-tjekket.

  TERMINAL_STEPS_BY_ACTION:
    start    → start_chrome, error
    stop     → chrome_closed_programmatically, chrome_closed_manual, error
    sleep    → system_sleep, error
    wakeup   → system_wake, error
    reboot   → system_rebooting, error
    shutdown → system_shutting_down, error
*/

const CHROME_STATUS_POLL_MS = 1000;
const ACTION_POLL_MS        = 1500;
const ACTION_POLL_MAX_MS    = 60_000;
const ACTION_MIN_LOCK_MS    = 2000;
const ACTION_NULL_STEP_MS   = 8000;

// FIX: shutdown_chrome er fjernet — det er terminal, ikke busy.
// Skal matche BUSY_CHROME_STEPS i DetailsActionsSection.jsx.
const BUSY_CHROME_STEPS = new Set([
  "clear_cookies",
  "terminate_chrome",
  "kill_chrome",
  "countdown",
  "display_sleep_countdown",
  "system_reboot_countdown",
  "system_rebooting",
  "system_shutting_down",
]);

/*
  Handlings-specifikke terminal steps.

  start:
    Venter KUN på start_chrome.
    chrome_closed_programmatically skrives af watchdog midt i sekvensen
    (når eksisterende Chrome dræbes som forberedelse til genstart) — må
    ikke terminere polling, ellers låses knapper op under countdown.

  stop:
    chrome_closed_programmatically og chrome_closed_manual er korrekte
    terminal steps — det er præcis hvad watchdog skriver når Chrome stoppes.

  sleep:
    Venter KUN på system_sleep.
    chrome_closed_programmatically skrives af watchdog FØR countdown i
    sleep-sekvensen — må ikke terminere polling:
      shutdown_chrome → watchdog: chrome_closed_programmatically
      → countdown (BUSY) → system_sleep (TERMINAL)

  wakeup:
    system_wake er terminal. Maskinen rebootes umiddelbart efter.

  reboot:
    system_rebooting er terminal for reboot — maskinen er ved at genstarte.
    NB: system_rebooting er også i BUSY_CHROME_STEPS (for banneret i
    DetailsActionsSection), men terminal tjekkes FØR busy i polling-loopen.

  shutdown:
    system_shutting_down er terminal for shutdown — samme princip som reboot.
*/
const TERMINAL_STEPS_BY_ACTION = {
  start:    new Set(["start_chrome", "error"]),
  stop:     new Set(["chrome_closed_programmatically", "chrome_closed_manual", "shutdown_chrome", "error"]),
  sleep:    new Set(["system_sleep", "system_sleep_complete", "display_sleep", "display_sleep_complete", "error"]),
  wakeup:   new Set(["system_wake", "system_wake_complete", "display_wake", "display_wake_complete", "error"]),
  reboot:   new Set(["system_rebooting", "error"]),
  shutdown: new Set(["system_shutting_down", "error"]),
};

// Fallback hvis action ikke kendes
const DEFAULT_TERMINAL_STEPS = new Set([
  "start_chrome",
  "chrome_closed_programmatically",
  "chrome_closed_manual",
  "shutdown_chrome",
  "system_sleep",
  "system_sleep_complete",
  "display_sleep",
  "display_sleep_complete",
  "system_wake",
  "system_wake_complete",
  "display_wake",
  "display_wake_complete",
  "error",
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

  // --- Remote terminal dialog ---
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Live chrome-status — opdateres hvert 1s uden full re-render
  // ---------------------------------------------------------------------------
  const [liveChromeStatus, setLiveChromeStatus] = useState(
    client?.chrome_status ?? null
  );
  const [liveChromeColor, setLiveChromeColor] = useState(
    client?.chrome_color ?? null
  );
  const [liveStep, setLiveStep]      = useState(null);
  const liveStepRef                  = useRef(null);
  const liveStepTimestampRef         = useRef(null);

  // ---------------------------------------------------------------------------
  // Lokal pending_chrome_action + state
  // ---------------------------------------------------------------------------
  const [localPendingAction, setLocalPendingAction] = useState(
    client?.pending_chrome_action ?? "none"
  );
  const [localClientState, setLocalClientState] = useState(
    client?.state ?? "normal"
  );

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
  const [liveClientOnline, setLiveClientOnline] = useState(client?.isOnline ?? false);

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
    if (typeof client?.isOnline === "boolean") setLiveClientOnline(client.isOnline);
    if (client?.chrome_status != null) setLiveChromeStatus(client.chrome_status);
    if (client?.chrome_color != null)  setLiveChromeColor(client.chrome_color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, client?.isOnline]);

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
          if (data?.pending_chrome_action != null) {
            const pca = String(data.pending_chrome_action || "none").toLowerCase();
            setLocalPendingAction(pca || "none");
          }
          if (data?.state) setLocalClientState(data.state);
          if (typeof data?.isOnline === "boolean") {
            setLiveClientOnline(data.isOnline);
          } else if (typeof data?.is_online === "boolean") {
            setLiveClientOnline(data.is_online);
          }

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
              setUptime(parsed);
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

  const startActionConfirmationPolling = useCallback((action) => {
    actionPollStopRef.current = false;
    setClientActionPending(true);

    const startTime    = Date.now();
    const startTimeISO = new Date(startTime).toISOString();

    // Hent handlings-specifikke terminal steps — eller fallback
    const terminalSteps = TERMINAL_STEPS_BY_ACTION[action] ?? DEFAULT_TERMINAL_STEPS;

    async function pollForConfirmation() {
      while (!actionPollStopRef.current && mountedRef.current) {
        if (Date.now() - startTime > ACTION_POLL_MAX_MS) break;

        await new Promise((res) => setTimeout(res, ACTION_POLL_MS));
        if (actionPollStopRef.current || !mountedRef.current) break;

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

        if (elapsed < ACTION_MIN_LOCK_MS) continue;

        const stepTimestamp = liveStepTimestampRef.current;
        const stepIsStale   = !stepTimestamp || stepTimestamp < startTimeISO;

        const currentStep = stepIsStale
          ? ""
          : String(liveStepRef.current ?? "").toLowerCase();

        // VIGTIGT: Terminal tjekkes FØR busy.
        // Reboot/shutdown har system_rebooting/system_shutting_down i både
        // BUSY_CHROME_STEPS (for banner) og i deres terminal-sæt.
        // Uden denne rækkefølge ville BUSY altid vinde og polling aldrig
        // terminere for reboot/shutdown — de ville vente 60s timeout.
        if (terminalSteps.has(currentStep)) break;

        if (BUSY_CHROME_STEPS.has(currentStep)) continue;

        // Hverken terminal eller busy — step er ukendt/null
        if (elapsed < ACTION_NULL_STEP_MS) continue;

        break;
      }

      if (mountedRef.current && !actionPollStopRef.current) {
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
      startActionConfirmationPolling(action);
    },
    [client?.id, startActionConfirmationPolling]
  );

  const handleOpenTerminal = useCallback(() => {
    if (client?.id) setTerminalDialogOpen(true);
  }, [client?.id]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (client?.id) openRemoteDesktop(client.id);
  }, [client?.id]);

  const refreshAfterExternalCommand = useCallback(
    async ({ pendingChromeAction, clientState } = {}) => {
      if (pendingChromeAction !== undefined) {
        const pca = String(pendingChromeAction || "none").toLowerCase();
        setLocalPendingAction(pca || "none");
      }
      if (clientState) setLocalClientState(clientState);

      try {
        if (typeof silentRefresh === "function") {
          await silentRefresh();
        } else if (typeof handleRefresh === "function") {
          await handleRefresh();
        }
      } catch {
        // Ignorer refresh-fejl efter eksterne kommandoer.
      }
    },
    [silentRefresh, handleRefresh]
  );

  // ---------------------------------------------------------------------------
  // Afledte værdier
  // ---------------------------------------------------------------------------
  const clientOnline  = liveClientOnline;
  const displayUptime = uptime != null ? uptime : client?.uptime ?? null;

  const effectivePendingAction =
    localPendingAction ?? client?.pending_chrome_action ?? "none";

  const effectiveClientState =
    localClientState ?? client?.state ?? "normal";

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
          clientOnline={clientOnline}
          showSnackbar={showSnackbar}
        />

        {/* 2 */}
        <ClientDetailsLivestreamSection
          client={client}
          clientId={client?.id}
          streamKey={streamKey}
          refreshing={refreshing}
          onRestartStream={onRestartStream}
          onCommandSent={refreshAfterExternalCommand}
          onDisplayResolutionSettingsSaved={silentRefresh}
          clientOnline={clientOnline}
        />

        {/* 3 */}
        <ClientDetailsInfoSection
          client={client}
          markedDays={markedDays}
          uptime={displayUptime}
          lastSeen={lastSeen ?? client?.last_seen}
          setCalendarDialogOpen={setCalendarDialogOpen}
          clientOnline={clientOnline}
          calendarLoading={calendarLoading}
          showSnackbar={showSnackbar}
          onUbuntuUpdateStarted={() =>
            refreshAfterExternalCommand({
              pendingChromeAction: "os_update",
              clientState: "updating",
            })
          }
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
          clientOnline={clientOnline}
          clientActionPending={clientActionPending}
          liveStep={liveStep}
          liveChromeStatus={liveChromeStatus}
          showSnackbar={showSnackbar}
        />

      </Box>

      <ClientCalendarDialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        clientId={client?.id}
      />

      <ClientTerminalDialog
        open={terminalDialogOpen}
        onClose={() => setTerminalDialogOpen(false)}
        client={client}
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
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
