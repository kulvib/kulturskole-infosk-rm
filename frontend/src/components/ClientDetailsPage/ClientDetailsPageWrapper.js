import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getClient, getMarkedDays, getCurrentSeason } from "../../api";
import ClientDetailsPage from "./ClientDetailsPage";
import { Snackbar, Alert as MuiAlert, Box, Card, Typography } from "@mui/material";

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  // Central snackbar (wrapper) til al brugerfeedback
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  // Fejltilstand ved manglende adgang/404
  const [notFound, setNotFound] = useState(false);

  // Ref til interval så vi kan starte interval EFTER første fetch og rydde korrekt
  const intervalRef = useRef(null);
  // Ref til aktiv AbortController for fetchAllData så vi kan afbryde request ved unmount
  const activeAbortRef = useRef(null);

  // Helper: merge client but preserve previous isOnline unless server explicitly provided it
  function mergeClientPreserveOnline(prev, updated) {
    if (!updated) return prev;
    return {
      ...(prev || {}),
      ...(updated || {}),
      isOnline: (typeof updated.isOnline === "undefined") ? prev?.isOnline : updated.isOnline
    };
  }

  // Fetch all data - returnerer clientData eller null
  const fetchAllData = async (forceUpdate = false) => {
    if (!clientId) return null;
    setCalendarLoading(true);
    setNotFound(false);

    // afbrydel tidligere fetch hvis nogen
    if (activeAbortRef.current) {
      try { activeAbortRef.current.abort(); } catch {}
      activeAbortRef.current = null;
    }
    const ac = new AbortController();
    activeAbortRef.current = ac;

    try {
      const [clientData, season] = await Promise.all([
        getClient(clientId),
        getCurrentSeason()
      ]);
      // hent markedDays (kan bruge season.id)
      let calendarData = {};
      try {
        calendarData = await getMarkedDays(season.id, clientId);
      } catch (errInner) {
        // ikke fatal for klientvisning — vis snackbar, men fortsæt
        setSnackbar({ open: true, message: "Kunne ikke hente kalenderdata: " + (errInner?.message || errInner), severity: "warning" });
      }

      setClient(prev => {
        // hvis forceUpdate eller data er forskellig, merge men bevar prev.isOnline hvis server ikke returnerede det
        if (forceUpdate || JSON.stringify(clientData) !== JSON.stringify(prev)) {
          return mergeClientPreserveOnline(prev, clientData);
        }
        return prev;
      });

      setMarkedDays({ ...calendarData?.markedDays });

      activeAbortRef.current = null;
      setCalendarLoading(false);
      return clientData;
    } catch (err) {
      // Hvis fetch blev afbrudt, ignorer
      if (err && err.name === "AbortError") {
        activeAbortRef.current = null;
        setCalendarLoading(false);
        return null;
      }

      // Undersøg fejltekst/status hvis muligt — sæt notFound kun for 401/403/404
      const msg = (err && err.message) ? String(err.message) : "Ukendt fejl ved hentning af data";
      const lower = msg.toLowerCase();
      const isAuthOrNotFound = lower.includes("401") || lower.includes("403") || lower.includes("404") || lower.includes("ingen adgang") || lower.includes("ikke fundet") || lower.includes("unauthorized");

      if (isAuthOrNotFound) {
        setNotFound(true);
        setSnackbar({ open: true, message: "Ingen adgang eller klient ikke fundet", severity: "error" });
      } else {
        // midlertidig/netværksfejl — vis snackbar men behold siden
        setSnackbar({ open: true, message: "Fejl ved hentning af data: " + msg, severity: "error" });
      }

      activeAbortRef.current = null;
      setCalendarLoading(false);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    // IIFE for at kunne await før interval oprettes
    (async () => {
      if (!clientId) return;
      // initial hent
      await fetchAllData(false);
      if (cancelled) return;

      // Start interval EFTER initial fetch så child får client tidligt
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        // ignorer result — fetchAllData internt opdaterer state
        fetchAllData(false);
      }, 15000); // full client: every 15s
    })();

    return () => {
      cancelled = true;
      // clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // abort active fetch if any
      if (activeAbortRef.current) {
        try { activeAbortRef.current.abort(); } catch {}
        activeAbortRef.current = null;
      }
    };
  }, [clientId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData(true);
    setRefreshing(false);
    setSnackbar({ open: true, message: "Data opdateret!", severity: "success" });
    setStreamKey(k => k + 1); // Genstart stream sammen med opdatering
  };

  const handleRestartStream = () => {
    setStreamKey(k => k + 1);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  // Centraliseret snackbar-funktion, sendes ned til children som showSnackbar
  const handleShowSnackbar = (msgObj) => {
    if (!msgObj || typeof msgObj !== "object") return;
    setSnackbar({ open: true, message: msgObj.message || "", severity: msgObj.severity || "success" });
  };

  // Hvis fejlet fetch/adgang -> vis fejl
  if (notFound) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" color="error">
            Klienten blev ikke fundet eller du har ikke adgang.
          </Typography>
        </Card>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3500}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </MuiAlert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <>
      {/* Central (wrapper) snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      <ClientDetailsPage
        client={client}
        refreshing={refreshing}
        handleRefresh={handleRefresh}
        markedDays={markedDays}
        calendarLoading={calendarLoading}
        streamKey={streamKey}
        onRestartStream={handleRestartStream}
        showSnackbar={handleShowSnackbar} // Central snackbar-funktion ned til child
      />
    </>
  );
}
