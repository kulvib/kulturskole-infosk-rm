import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Box,
  Container,
  Snackbar,
  Alert,
  useMediaQuery,
} from "@mui/material";
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
} from "../../api";

/*
  ClientDetailsPage.jsx

  FIX 1 — Dynamisk oppetid:
    uptimeBaseRef  = sekunder fra seneste backend-svar.
    uptimeFetchRef = Date.now() da basen blev sat.
    Et setInterval på 1s beregner aktuel uptime som base + elapsed.
    getChromeStatus-polling synkroniserer basen med backend uden at resette tickeren.

  FIX 2 — mountedRef håndteres ét sted (cleanup-effect).
    Chrome-poll-loop bruger lokal `cancelled`-flag i stedet for at skrive
    mountedRef.current = true inde i en effect (det var en fejl).

  FIX 3 — showSnackbar fallback til lokal Snackbar.

  FIX 4 — handleRefresh: parent-prop-funktionen opdaterer client-data,
    men chrome-status og lastSeen synkroniseres løbende via poll-loopen.
*/

const CHROME_POLL_MS = 3000;

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

  // -------------------------------------------------------------------------
  // Lokal snackbar (fallback hvis parent ikke sender prop)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Kalender dialog
  // -------------------------------------------------------------------------
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Live chrome-status
  // -------------------------------------------------------------------------
  const [liveChromeStatus, setLiveChromeStatus] = useState(
    client?.chrome_status ?? null
  );
  const [liveChromeColor, setLiveChromeColor] = useState(
    client?.chrome_color ?? null
  );

  // -------------------------------------------------------------------------
  // Dynamisk oppetid
  // uptimeBaseRef  = seneste kendte sekunder fra backend
  // uptimeFetchRef = tidspunkt (ms) da basen blev sat
  // -------------------------------------------------------------------------
  const [uptime, setUptime] = useState(null);
  const uptimeBaseRef = useRef(null);
  const uptimeFetchRef = useRef(null);

  // -------------------------------------------------------------------------
  // Sidst set
  // -------------------------------------------------------------------------
  const [lastSeen, setLastSeen] = useState(client?.last_seen ?? null);

  // -------------------------------------------------------------------------
  // mountedRef — sættes/ryddes ét sted
  // -------------------------------------------------------------------------
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Synkronisér initial data når client-prop skifter (nyt client-id)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!client) return;

    // Uptime
    if (client.uptime != null) {
      const parsed = parseInt(String(client.uptime), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        uptimeBaseRef.current = parsed;
        uptimeFetchRef.current = Date.now();
        setUptime(parsed);
      }
    }

    // Sidst set
    if (client.last_seen) setLastSeen(client.last_seen);

    // Chrome-status
    if (client.chrome_status != null) setLiveChromeStatus(client.chrome_status);
    if (client.chrome_color != null) setLiveChromeColor(client.chrome_color);
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Lokal uptime-ticker — tæller hvert sekund
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (
      uptimeBaseRef.current == null ||
      uptimeFetchRef.current == null
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const elapsed = Math.round(
        (Date.now() - uptimeFetchRef.current) / 1000
      );
      setUptime(uptimeBaseRef.current + elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // getChromeStatus polling hvert 3s
  // FIX: bruger lokal `cancelled`-flag — skriver IKKE mountedRef.current = true
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!client?.id) return;

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
          if (data?.last_seen != null)
            setLastSeen(data.last_seen);

          // Synkronisér uptime-base — tickeren beregner korrekt ved næste tick
          if (data?.uptime != null) {
            const parsed = parseInt(String(data.uptime), 10);
            if (!isNaN(parsed) && parsed >= 0) {
              uptimeBaseRef.current = parsed;
              uptimeFetchRef.current = Date.now();
            }
          }
        } catch {
          // Ignorer poll-fejl — prøv igen ved næste interval
        }

        await new Promise((res) => setTimeout(res, CHROME_POLL_MS));
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Handlinger
  // -------------------------------------------------------------------------
  const handleClientAction = useCallback(
    async (action) => {
      if (!client?.id) return;
      await clientAction(client.id, action);
      // Giv backend 1s til at processere, refresh derefter
      setTimeout(() => {
        if (mountedRef.current) handleRefresh?.();
      }, 1000);
    },
    [client?.id, handleRefresh]
  );

  const handleOpenTerminal = useCallback(() => {
    if (client?.id) openTerminal(client.id);
  }, [client?.id]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (client?.id) openRemoteDesktop(client.id);
  }, [client?.id]);

  // -------------------------------------------------------------------------
  // Afledte værdier
  // -------------------------------------------------------------------------
  const clientOnline = client?.isOnline ?? false;

  // Brug lokal ticker hvis tilgængelig, ellers fald tilbage på client-prop
  const displayUptime =
    uptime != null ? uptime : client?.uptime ?? null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Container
      maxWidth="xl"
      disableGutters
      sx={{ px: isMobile ? 0.5 : 2, py: isMobile ? 0.5 : 2 }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 1 : 2,
        }}
      >
        {/* Header: klientnavn, skole, lokation, kiosk-URL, chrome-status */}
        <ClientDetailsHeaderSection
          client={client}
          liveChromeStatus={liveChromeStatus}
          liveChromeColor={liveChromeColor}
          refreshing={refreshing}
          handleRefresh={handleRefresh}
          showSnackbar={showSnackbar}
          clientOnline={clientOnline}
        />

        {/* Handlinger: start/stop browser, sleep/wake, reboot, shutdown */}
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
        />

        {/* Info: kalender, systeminfo, netværk */}
        <ClientDetailsInfoSection
          client={client}
          markedDays={markedDays}
          uptime={displayUptime}
          lastSeen={lastSeen ?? client?.last_seen}
          calendarDialogOpen={calendarDialogOpen}
          setCalendarDialogOpen={setCalendarDialogOpen}
          clientOnline={clientOnline}
        />

        {/* Livestream */}
        <ClientDetailsLivestreamSection
          clientId={client?.id}
          streamKey={streamKey}
          refreshing={refreshing}
          onRestartStream={onRestartStream}
          clientOnline={clientOnline}
        />
      </Box>

      {/* Kalender dialog */}
      <ClientCalendarDialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        clientId={client?.id}
      />

      {/* Lokal snackbar — bruges kun hvis parent ikke sender showSnackbar */}
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
