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

  FIX: Undgå blinking ved action-polling.
  - getChromeStatus polles hvert 1s via lokal state (ikke full refresh).
  - pending_chrome_action polles via getClient direkte — opdaterer kun
    localPendingAction og localClientState lokalt, ikke hele client-objektet.
  - handleRefresh (fuld re-render) bruges KUN ved manuel opdatering.
  - Dynamisk uptime-ticker via uptimeBaseRef + setInterval.
*/

const CHROME_STATUS_POLL_MS = 1000;   // Live status hvert 1s
const ACTION_POLL_MS        = 2000;   // Poll pca hvert 2s under handling
const ACTION_POLL_MAX_MS    = 60_000; // Max ventetid: 60s

export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  markedDays,
  calendarLoading,
  streamKey,
  onRestartStream,
  showSnackbar: showSnackbarProp,
}) {
  const theme  = useTheme();
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
  // Live chrome-status (lokal state — opdateres hvert 1s uden full re-render)
  // ---------------------------------------------------------------------------
  const [liveChromeStatus, setLiveChromeStatus] = useState(
    client?.chrome_status ?? null
  );
  const [liveChromeColor, setLiveChromeColor] = useState(
    client?.chrome_color ?? null
  );

  // ---------------------------------------------------------------------------
  // Lokal pending_chrome_action + state — polles direkte via getClient
  // uden at trigge full parent re-render (undgår blinking)
  // ---------------------------------------------------------------------------
  const [localPendingAction, setLocalPendingAction] = useState(
    client?.pending_chrome_action ?? "none"
  );
  const [localClientState, setLocalClientState] = useState(
    client?.state ?? "normal"
  );

  // Sync når parent client prop skifter (fx ved manuel refresh)
  const prevClientIdRef = useRef(client?.id);
  useEffect(() => {
    if (client?.id !== prevClientIdRef.current) {
      prevClientIdRef.current = client?.id;
    }
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

  // Sæt initial data fra client prop (kun ved id-skift)
  useEffect(() => {
    if (client?.uptime != null) {
      const parsed = parseInt(String(client.uptime), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        uptimeBaseRef.current  = parsed;
        uptimeFetchRef.current = Date.now();
        setUptime(parsed);
      }
    }
    if (client?.last_seen)      setLastSeen(client.last_seen);
    if (client?.chrome_status != null) setLiveChromeStatus(client.chrome_status);
    if (client?.chrome_color != null)  setLiveChromeColor(client.chrome_color);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  // Lokal uptime ticker — tikker hvert sekund
  useEffect(() => {
    if (uptimeBaseRef.current == null || uptimeFetchRef.current == null) return;
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - uptimeFetchRef.current) / 1000);
      setUptime(uptimeBaseRef.current + elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Chrome-status polling — hvert 1s (let endpoint, ingen full refresh)
  // ---------------------------------------------------------------------------
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!client?.id) return;
    mountedRef.current = true;
    let cancelled = false;

    async function poll() {
      while (!cancelled && mountedRef.current) {
        try {
          const data = await getChromeStatus(client.id, {
            fallbackToClient: true,
          });
          if (cancelled || !mountedRef.current) break;

          if (data?.chrome_status != null)
            setLiveChromeStatus(data.chrome_status);
          if (data?.chrome_color != null)
            setLiveChromeColor(data.chrome_color);
          if (data?.last_seen != null) setLastSeen(data.last_seen);

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
  // Poller getClient direkte og opdaterer KUN localPendingAction + localClientState.
  // Kalder IKKE handleRefresh → undgår full re-render → ingen blinking.
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

        try {
          const data = await getClient(client.id);
          if (!mountedRef.current) break;

          const pca = String(data?.pending_chrome_action ?? "").toLowerCase();

          // Opdater lokal state UDEN at påvirke parent — ingen blinking
          setLocalPendingAction(pca);
          if (data?.state) setLocalClientState(data.state);

          // Stop polling når handlingen er bekræftet
          if (!pca || pca === "none") {
            break;
          }
        } catch {
          // Ignorer poll-fejl — fortsæt polling
        }

        if (Date.now() - startTime > ACTION_POLL_MAX_MS) {
          // Timeout — frigiv låsen
          break;
        }
      }

      if (mountedRef.current) {
        setClientActionPending(false);
        // Hent friske data fra parent én gang efter handling er bekræftet
        // Dette er den ENESTE gang vi kalder handleRefresh under action-flow
        try {
          await handleRefresh();
        } catch {
          // Ignorer
        }
      }
    }

    pollForConfirmation();
  }, [client?.id, handleRefresh]);

  // ---------------------------------------------------------------------------
  // Handlinger
  // ---------------------------------------------------------------------------
  const handleClientAction = useCallback(
    async (action) => {
      if (!client?.id) return;
      await clientAction(client.id, action);
      // Opdater lokal pending action straks (optimistisk UI)
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
  const clientOnline   = client?.isOnline ?? false;
  const displayUptime  = uptime != null ? uptime : client?.uptime ?? null;

  // Brug lokal pending/state under action-flow, ellers prop fra parent
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
    </Container>*
