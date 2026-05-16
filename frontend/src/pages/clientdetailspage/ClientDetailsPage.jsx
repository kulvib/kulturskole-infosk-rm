import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Container, Snackbar, Alert, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import ClientDetailsHeaderSection from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection from "./DetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog from "../calendarpage/ClientCalendarDialog";

import { getChromeStatus, clientAction, openTerminal, openRemoteDesktop } from "../../api";

/*
  ClientDetailsPage.jsx

  FIX 1: Dynamisk uptime-ticker via uptimeBaseRef + setInterval.
  FIX 2: handleClientAction sætter actionPendingRef = true og starter
         hurtig polling (hvert 2s) indtil pending_chrome_action === "none".
         Dette sikrer at knapper i DetailsActionsSection forbliver låste
         indtil klienten faktisk har bekræftet handlingen.
  FIX 3: Opdaterknappen virker korrekt — den kalder handleRefresh fra parent
         som henter friske data fra backend.
*/

const CHROME_POLL_MS = 3000;
const ACTION_POLL_MS = 2000;   // Hurtig polling mens handling afventer klient
const ACTION_POLL_MAX_MS = 45000; // Max ventetid: 45s

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // --- Lokal snackbar (fallback) ---
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const showSnackbar = useCallback((opts) => {
    if (typeof showSnackbarProp === "function") {
      showSnackbarProp(opts);
    } else {
      setSnackbar({ open: true, message: opts?.message ?? "", severity: opts?.severity ?? "success" });
    }
  }, [showSnackbarProp]);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // --- Kalender dialog ---
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  // --- Live chrome status ---
  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status ?? null);
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color ?? null);

  // --- Dynamisk oppetid ---
  const [uptime, setUptime] = useState(null);
  const uptimeBaseRef = useRef(null);
  const uptimeFetchRef = useRef(null);

  // --- Sidst set ---
  const [lastSeen, setLastSeen] = useState(client?.last_seen ?? null);

  // --- Pending action polling ---
  // actionPendingRef sættes true når en handling sendes til klienten.
  // actionPollStopRef bruges til at stoppe polling-løkken.
  const actionPendingRef = useRef(false);
  const actionPollStopRef = useRef(false);

  // Vi eksponerer en callback som DetailsActionsSection kan kalde
  // for at signalere at en handling er sendt — og en state vi passer ned
  // som fortæller sektionen om den skal låse alle knapper.
  const [clientActionPending, setClientActionPending] = useState(false);

  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Sæt initial data fra client prop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (client?.uptime != null) {
      const parsed = parseInt(String(client.uptime), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        uptimeBaseRef.current = parsed;
        uptimeFetchRef.current = Date.now();
        setUptime(parsed);
      }
    }
    if (client?.last_seen) setLastSeen(client.last_seen);
    if (client?.chrome_status != null) setLiveChromeStatus(client.chrome_status);
    if (client?.chrome_color != null) setLiveChromeColor(client.chrome_color);
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Lokal uptime ticker
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (uptimeBaseRef.current == null || uptimeFetchRef.current == null) return;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const elapsed = Math.round((Date.now() - uptimeFetchRef.current) / 1000);
      setUptime(uptimeBaseRef.current + elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // getChromeStatus polling — hvert 3s
  // ---------------------------------------------------------------------------
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
          if (data?.chrome_color != null) setLiveChromeColor(data.chrome_color);
          if (data?.last_seen != null) setLastSeen(data.last_seen);

          if (data?.uptime != null) {
            const parsed = parseInt(String(data.uptime), 10);
            if (!isNaN(parsed) && parsed >= 0) {
              uptimeBaseRef.current = parsed;
              uptimeFetchRef.current = Date.now();
            }
          }
        } catch {
          // Ignorer poll-fejl
        }
        await new Promise((res) => setTimeout(res, CHROME_POLL_MS));
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
    return () => {
      mountedRef.current = false;
      actionPollStopRef.current = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Hurtig polling mens en handling afventer klient-bekræftelse
  //
  // Kaldes efter onActionSent() fra DetailsActionsSection.
  // Poller handleRefresh hvert ACTION_POLL_MS indtil:
  //   - client.pending_chrome_action === "none"  (bekræftet)
  //   - eller ACTION_POLL_MAX_MS er overskredet  (timeout)
  // ---------------------------------------------------------------------------
  const startActionConfirmationPolling = useCallback(() => {
    actionPendingRef.current = true;
    actionPollStopRef.current = false;
    setClientActionPending(true);

    const startTime = Date.now();

    async function pollForConfirmation() {
      while (!actionPollStopRef.current && mountedRef.current) {
        await new Promise((res) => setTimeout(res, ACTION_POLL_MS));
        if (actionPollStopRef.current || !mountedRef.current) break;

        // Hent friske data
        try {
          await handleRefresh();
        } catch {
          // Ignorér fejl i polling
        }

        // handleRefresh opdaterer client prop via parent state
        // Vi tjekker pending_chrome_action på det opdaterede client objekt
        // via en separat ref check i useEffect nedenfor
        if (Date.now() - startTime > ACTION_POLL_MAX_MS) {
          // Timeout — lås op uanset hvad
          break;
        }
      }

      if (mountedRef.current) {
        actionPendingRef.current = false;
        setClientActionPending(false);
      }
    }

    pollForConfirmation();
  }, [handleRefresh]);

  // Overvåg client.pending_chrome_action — stop polling når den er "none"
  useEffect(() => {
    if (!actionPendingRef.current) return;
    const pca = typeof client?.pending_chrome_action === "string"
      ? client.pending_chrome_action.toLowerCase()
      : "";
    if (pca === "none" || pca === "") {
      actionPollStopRef.current = true;
      // setClientActionPending(false) sættes af pollForConfirmation-løkken
    }
  }, [client?.pending_chrome_action]);

  // ---------------------------------------------------------------------------
  // Handlinger
  // ---------------------------------------------------------------------------
  const handleClientAction = useCallback(async (action) => {
    if (!client?.id) return;
    await clientAction(client.id, action);
    // Start hurtig polling for bekræftelse
    startActionConfirmationPolling();
  }, [client?.id, startActionConfirmationPolling]);

  const handleOpenTerminal = useCallback(() => {
    if (client?.id) openTerminal(client.id);
  }, [client?.id]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (client?.id) openRemoteDesktop(client.id);
  }, [client?.id]);

  const clientOnline = client?.isOnline ?? false;
  const displayUptime = uptime != null ? uptime : client?.uptime ?? null;

  return (
    <Container maxWidth="xl" disableGutters sx={{ px: isMobile ? 0.5 : 2, py: isMobile ? 0.5 : 2 }}>
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
          clientState={client?.state}
          pendingChromeAction={client?.pending_chrome_action}
          handleClientAction={handleClientAction}
          handleOpenTerminal={handleOpenTerminal}
          handleOpenRemoteDesktop={handleOpenRemoteDesktop}
          refreshing={refreshing}
          showSnackbar={showSnackbar}
          clientOnline={clientOnline}
          // FIX: ny prop — fortæller DetailsActionsSection at en handling
          // afventer bekræftelse fra klienten → alle knapper låses
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
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
