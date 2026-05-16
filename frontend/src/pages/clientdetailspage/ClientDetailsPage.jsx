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

  Arkitektur for at undgå blinking OG sikre korrekt lock:
  - getChromeStatus polles hvert 1s → liveChromeStatus/Color/Step opdateres
    uden full re-render. Step sendes til DetailsActionsSection som liveStep.
  - pending_chrome_action polles via getClient direkte under action-flow →
    opdaterer kun localPendingAction + localClientState, IKKE hele client-objektet.
  - Lock holdes indtil ALLE betingelser er opfyldt:
      1) pending_chrome_action === "none"
      2) chrome step er ikke i BUSY_CHROME_STEPS
      3) Mindst ACTION_MIN_LOCK_MS er gået siden action-start
         (klienten rydder PCA øjeblikkeligt — vi venter på første chrome-step)
  - Korrekt unlock-rækkefølge: silentRefresh() FØRST → unlock bagefter.
  - handleRefresh (full re-render) bruges KUN ved manuel klik på "Opdater".
  - cancelActionPoll eksponeres via prop-callback så Wrapper kan stoppe
    action-polling ved manuel refresh.
*/

const CHROME_STATUS_POLL_MS = 1000;
const ACTION_POLL_MS        = 1500;
const ACTION_POLL_MAX_MS    = 60_000;
const ACTION_MIN_LOCK_MS    = 5000; // FIX: klienten rydder PCA straks — vent mindst 5s på første chrome-step

// FIX: Udvidet med alle transiente steps som klientkoden skriver
const BUSY_CHROME_STEPS = new Set([
  "countdown",
  "clear_cookies",
  "system_reboot_countdown",
  "chrome_starting",   // FIX: skrives under scenario_system_start
  "chrome_stopping",   // FIX: skrives under scenario_manual_shutdown
  "system_sleep",      // FIX: skrives under sleep-flow
  "system_wake",       // FIX: skrives under wake-flow
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
  const [liveStep, setLiveStep] = useState(null);
  const liveStepRef             = useRef(null);

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

          const stepName = data?.step?.step ?? null;
          setLiveStep(stepName);
          liveStepRef.current = stepName;

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

    const startTime = Date.now();

    async function pollForConfirmation() {
      while (!actionPollStopRef.current && mountedRef.current) {
        if (Date.now() - startTime > ACTION_POLL_MAX_MS) break;

        await new Promise((res) => setTimeout(res, ACTION_POLL_MS));
        if (actionPollStopRef.current || !mountedRef.current) break;

        // Tjek 1: pending_chrome_action
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

        // FIX: Håndhæv minimumsventetid — klienten rydder PCA øjeblikkeligt
        // ved modtagelse, men handlingen er endnu ikke startet.
        // Vent mindst ACTION_MIN_LOCK_MS så klienten når at sende første chrome-step.
        if (Date.now() - startTime < ACTION_MIN_LOCK_MS) continue;

        // FIX: null/tom step = vi ved ikke hvad klienten laver → fortsæt polling
        // Tidligere brød dette straks ud og låste knapper op for tidligt.
        const currentStep = String(liveStepRef.current ?? "").toLowerCase();
        if (!currentStep || BUSY_CHROME_STEPS.has(currentStep)) continue;

        // Alle betingelser opfyldt — afslut polling
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

        {/* 3 */}
        <ClientDetailsInfoSection
          client={client}
          markedDays={markedDays}
          uptime={displayUptime}
          lastSeen={lastSeen ?? client?.last_seen}
          calendarDialogOpen={calendarDialogOpen}
          setCalendarDialogOpen={setCalendarDialogOpen}
          clientOnline={clientOnline}
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
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
