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

  FIX (disabled knapper): handleClientAction awaiter nu handleRefresh direkte
    i stedet for setTimeout(..., 1000). Det sikrer at actionLoading forbliver
    true under hele API-kald + refresh-cyklussen — knapperne forbliver disabled.

  FIX (snackbar): handleRefresh kaldes med silent=true ved knap-handlinger
    så der ikke vises "Klient opdateret" ved hvert klik.

  FIX (oppetid dynamisk): uptimeBaseRef + uptimeFetchRef + lokal ticker.
  FIX (CalendarDialog sti): ../calendarpage/ClientCalendarDialog
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

  const mountedRef = useRef(true);

  // Sæt initial uptime + chrome status fra client prop
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

  // Lokal uptime ticker — tæller hvert sekund
  useEffect(() => {
    if (uptimeBaseRef.current == null || uptimeFetchRef.current == null) return;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const elapsed = Math.round((Date.now() - uptimeFetchRef.current) / 1000);
      setUptime(uptimeBaseRef.current + elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [client?.id]);

  // getChromeStatus polling — synkroniserer uptime-base med backend
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

  // Cleanup ved unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // --- Handlinger ---
  const handleClientAction = useCallback(
    async (action) => {
      if (!client?.id) return;

      // Send kommando til backend
      await clientAction(client.id, action);

      // FIX: Vent kort så backend kan behandle handlingen,
      // derefter refresh SYNKRONT — actionLoading forbliver true hele vejen.
      // silent=true forhindrer "Klient opdateret" snackbar ved hvert klik.
      await new Promise((res) => setTimeout(res, 600));
      if (mountedRef.current) {
        await handleRefresh?.(true); // true = silent refresh
      }
    },
    [client?.id, handleRefresh]
  );

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
