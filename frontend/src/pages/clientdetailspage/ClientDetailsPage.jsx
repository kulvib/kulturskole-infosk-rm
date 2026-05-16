import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  Container,
  Snackbar,
  Alert,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import ClientDetailsHeaderSection    from "./ClientDetailsHeaderSection";
import ClientDetailsInfoSection      from "./ClientDetailsInfoSection";
import ClientDetailsActionsSection   from "./DetailsActionsSection";
import ClientDetailsLivestreamSection from "./ClientDetailsLivestreamSection";
import ClientCalendarDialog          from "../calendarpage/ClientCalendarDialog";

import {
  getChromeStatus,
  clientAction,
  openTerminal,
  openRemoteDesktop,
} from "../../api";

const CHROME_POLL_MS = 3000;

export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  markedDays,
  // FIX: calendarLoading bruges nu til at vise loading-tilstand i InfoSection
  calendarLoading,
  streamKey,
  // FIX: onRestartStream fjernet — ClientDetailsLivestreamSection håndterer
  // sin egen genstart internt via handleRefreshClick. Prop'en blev sendt men
  // aldrig kaldt i børnekomponenten.
  showSnackbar: showSnackbarProp,
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // ---------------------------------------------------------------------------
  // Lokal snackbar (fallback hvis parent ikke sender prop)
  // ---------------------------------------------------------------------------
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const showSnackbar = useCallback((opts) => {
    if (typeof showSnackbarProp === "function") {
      showSnackbarProp(opts);
    } else {
      setSnackbar({
        open: true,
        message:  opts?.message  ?? "",
        severity: opts?.severity ?? "success",
      });
    }
  }, [showSnackbarProp]);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // ---------------------------------------------------------------------------
  // Kalender dialog
  // ---------------------------------------------------------------------------
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Live chrome status + last seen + uptime
  // ---------------------------------------------------------------------------
  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status ?? null);
  const [liveChromeColor,  setLiveChromeColor]  = useState(client?.chrome_color  ?? null);
  const [lastSeen,         setLastSeen]          = useState(client?.last_seen     ?? null);
  const [uptime,           setUptime]            = useState(null);

  // Refs til dynamisk uptime-ticker
  const uptimeBaseRef  = useRef(null);
  const uptimeFetchRef = useRef(null);

  // FIX: mountedRef sættes KUN i cleanup-effect — ikke i polling-effect
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // Synk initial state fra client-prop når klient-ID ændrer sig
  // FIX: Synkroniserer nu OGSÅ ved refresh (client-objekt-reference ændrer sig)
  // ved at lytte på client?.id OG et "refreshKey" afledt af client-objektet.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!client) return;

    if (client.uptime != null) {
      const parsed = parseInt(String(client.uptime), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        uptimeBaseRef.current  = parsed;
        uptimeFetchRef.current = Date.now();
        setUptime(parsed);
      }
    }
    if (client.last_seen)      setLastSeen(client.last_seen);
    if (client.chrome_status != null) setLiveChromeStatus(client.chrome_status);
    if (client.chrome_color  != null) setLiveChromeColor(client.chrome_color);

  // FIX: Lytter på client-objektet direkte (ikke kun client.id) så et refresh
  // af samme klient også synkroniserer chrome_status, last_seen og uptime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // ---------------------------------------------------------------------------
  // Lokal uptime ticker — tæller hvert sekund
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
  // getChromeStatus polling — synkroniserer chrome-status + uptime-base
  // FIX: mountedRef.current = true fjernet herfra — styres kun af cleanup-effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;

    async function poll() {
      while (!cancelled && mountedRef.current) {
        try {
          const data = await getChromeStatus(client.id, { fallbackToClient: true });
          if (cancelled || !mountedRef.current) break;

          if (data?.chrome_status != null) setLiveChromeStatus(data.chrome_status);
          if (data?.chrome_color  != null) setLiveChromeColor(data.chrome_color);
          if (data?.last_seen     != null) setLastSeen(data.last_seen);

          // Synkronisér uptime-base uden at resette ticker
          if (data?.uptime != null) {
            const parsed = parseInt(String(data.uptime), 10);
            if (!isNaN(parsed) && parsed >= 0) {
              uptimeBaseRef.current  = parsed;
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
    return () => { cancelled = true; };
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Handlinger
  // ---------------------------------------------------------------------------
  const handleClientAction = useCallback(async (action) => {
    if (!client?.id) return;
    await clientAction(client.id, action);
    // Giv backend 1 sekund til at processere, hent derefter frisk klient-data
    setTimeout(() => {
      if (mountedRef.current) handleRefresh?.();
    }, 1000);
  }, [client?.id, handleRefresh]);

  const handleOpenTerminal = useCallback(() => {
    if (client?.id) openTerminal(client.id);
  }, [client?.id]);

  const handleOpenRemoteDesktop = useCallback(() => {
    if (client?.id) openRemoteDesktop(client.id);
  }, [client?.id]);

  // ---------------------------------------------------------------------------
  // Afledte værdier
  // ---------------------------------------------------------------------------
  const clientOnline = client?.isOnline ?? false;

  // FIX: useMemo — genskabes ikke ved hver render
  const displayUptime = useMemo(
    () => uptime ?? client?.uptime ?? null,
    [uptime, client?.uptime]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Container
      maxWidth="xl"
      disableGutters
      sx={{ px: isMobile ? 0.5 : 2, py: isMobile ? 0.5 : 2 }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? 1 : 2 }}>

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
          // FIX: calendarDialogOpen fjernet — bruges ikke i børnekomponenten
          calendarLoading={calendarLoading}
          setCalendarDialogOpen={setCalendarDialogOpen}
          clientOnline={clientOnline}
        />

        {/* Livestream */}
        <ClientDetailsLivestreamSection
          clientId={client?.id}
          streamKey={streamKey}
          refreshing={refreshing}
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
