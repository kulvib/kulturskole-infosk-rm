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
  - Lock holdes indtil BÅDE:
      1) pending_chrome_action === "none"
      2) chrome step er ikke i BUSY_CHROME_STEPS (countdown, clear_cookies osv.)
  - Korrekt unlock-rækkefølge: silentRefresh() FØRST → unlock bagefter.
  - handleRefresh (full re-render) bruges KUN ved manuel klik på "Opdater".
*/

const CHROME_STATUS_POLL_MS = 1000;
const ACTION_POLL_MS        = 1500;
const ACTION_POLL_MAX_MS    = 60_000;

// Trin der indikerer at klienten stadig er i gang — lås skal holdes
const BUSY_CHROME_STEPS = new Set([
  "countdown",
  "clear_cookies",
  "system_reboot_countdown",
]);

export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  silentRefresh,
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
  // liveStep sendes til DetailsActionsSection så den kan vise aktuel status
  // ---------------------------------------------------------------------------
  const [liveChromeStatus, setLiveChromeStatus] = useState(
    client?.chrome_status ?? null
  );
  const [liveChromeColor, setLiveChromeColor] = useState(
    client?.chrome_color ?? null
  );
  const [liveStep, setLiveStep] = useState(null);

  // Ref så pollForConfirmation kan læse seneste step uden at være i deps
  const liveStepRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Lokal pending_chrome_action + state
  // Polles direkte under action-flow — undgår full parent re-render
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
  // Opdaterer liveChromeStatus, liveChromeColor, liveStep, lastSeen, uptime
  // liveStep holdes også i liveStepRef så pollForConfirmation kan læse den
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

          // Opdater liveStep + ref
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
  //
  // Lock holdes indtil BEGGE betingelser er opfyldt:
  //   1) pending_chrome_action === "none"
  //   2) chrome step er IKKE i BUSY_CHROME_STEPS
  //
  // Korrekt unlock-rækkefølge:
  //   silentRefresh() FØRST → setClientActionPending(false) BAGEFTER
  //   → knapper låses ikke op før parent state er opdateret
  // ---------------------------------------------------------------------------
  const [clientActionPending, setClientActionPending] = useState(false);
  const actionPollStopRef = useRef(false);

  const startActionConfirmationPolling = useCallback(() => {
    actionPollStopRef.current = false;
    setClientActionPending(true);

    const startTime = Date.now();

    async function pollForConfirmation() {
      while (!actionPollStopRef.current && mountedRef.current) {
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

        // Tjek 2: chrome step må ikke være i BUSY_CHROME_STEPS
        // Bruger liveStepRef (opdateres af chrome-status poll hvert 1s)
        const currentStep = String(liveStepRef.current ?? "").toLowerCase();
        const stepBusy = BUSY_CHROME_STEPS.has(currentStep);

        if (stepBusy) continue;

        // Begge betingelser opfyldt — afslut polling
        break;
      }

      if (mountedRef.current) {
        // VIGTIGT: refresh FØRST så parent state er opdateret
        // DEREFTER unlock — knapper åbner ikke før data er friske
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
      // Optimistisk: sæt pending action lokalt med det samme
      setLocalPendingAction(action);
      // Start polling for bekræftelse
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

        <ClientDetailsHeaderSection
          client={client}
          liveChromeStatus={liveChromeStatus}
          liveChromeColor={liveChromeColor}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          showSnackbar={showSnackbar}
          clientOnline={clientOnline}
        />

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

        <ClientDetailsInfoSection
          client={client}
          markedDays={markedDays}
          uptime={displayUptime}
          lastSeen={lastSeen ?? client?.last_seen}
          calendarDialogOpen={calendarDialogOpen}
          setCalendarDialogOpen={setCalendarDialogOpen}
          clientOnline={clientOnline}
        />

        <ClientDetailsLivestreamSection
          clientId={client?.id}
          streamKey={streamKey}
          refreshing={refreshing}
          onRestartStream={onRestartStream}
          clientOnline={clientOnline}
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
