import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getClient, getMarkedDays, getCurrentSeason } from "../../api";
import ClientDetailsPage from "./ClientDetailsPage";
import { Snackbar, Alert as MuiAlert, Box, Card, Typography } from "@mui/material";

// FIX: Beregn nuværende sæson som string "2025/2026" — bruges som fallback
function getCurrentSeasonString() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

function mergeClientPreserveOnline(prev, updated) {
  if (!updated) return prev;
  return {
    ...(prev || {}),
    ...(updated || {}),
    isOnline: (typeof updated.isOnline === "undefined") ? prev?.isOnline : updated.isOnline
  };
}

export default function ClientDetailsPageWrapper() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [notFound, setNotFound] = useState(false);

  const intervalRef = useRef(null);
  const activeAbortRef = useRef(null);
  // FIX: Spor om vi er paused pga. skjult tab
  const isPausedRef = useRef(false);

  const fetchAllData = async (forceUpdate = false) => {
    if (!clientId) return null;
    setCalendarLoading(true);
    setNotFound(false);

    if (activeAbortRef.current) {
      try { activeAbortRef.current.abort(); } catch { }
      activeAbortRef.current = null;
    }
    const ac = new AbortController();
    activeAbortRef.current = ac;

    try {
      const [clientData, season] = await Promise.all([
        getClient(clientId),
        getCurrentSeason()
      ]);

      if (ac.signal.aborted) {
        activeAbortRef.current = null;
        setCalendarLoading(false);
        return null;
      }

      // FIX: Brug season.id hvis det er en string, ellers beregn fra dato
      const seasonStr = (season?.id && typeof season.id === "string" && season.id.includes("/"))
        ? season.id
        : getCurrentSeasonString();

      let calendarData = {};
      try {
        calendarData = await getMarkedDays(seasonStr, clientId);
      } catch (errInner) {
        if (!ac.signal.aborted) {
          setSnackbar({ open: true, message: "Kunne ikke hente kalenderdata: " + (errInner?.message || errInner), severity: "warning" });
        }
      }

      if (ac.signal.aborted) {
        activeAbortRef.current = null;
        setCalendarLoading(false);
        return null;
      }

      setClient(prev => {
        if (forceUpdate || JSON.stringify(clientData) !== JSON.stringify(prev)) {
          return mergeClientPreserveOnline(prev, clientData);
        }
        return prev;
      });

      setMarkedDays({ ...(calendarData?.markedDays || {}) });
      activeAbortRef.current = null;
      setCalendarLoading(false);
      return clientData;

    } catch (err) {
      if (err?.name === "AbortError") {
        activeAbortRef.current = null;
        setCalendarLoading(false);
        return null;
      }

      const msg = err?.message ? String(err.message) : "Ukendt fejl ved hentning af data";
      const lower = msg.toLowerCase();
      const isAuthOrNotFound =
        lower.includes("401") || lower.includes("403") || lower.includes("404") ||
        lower.includes("ingen adgang") || lower.includes("ikke fundet") || lower.includes("unauthorized");

      if (isAuthOrNotFound) {
        setNotFound(true);
        setSnackbar({ open: true, message: "Ingen adgang eller klient ikke fundet", severity: "error" });
      } else {
        setSnackbar({ open: true, message: "Fejl ved hentning af data: " + msg, severity: "error" });
      }

      activeAbortRef.current = null;
      setCalendarLoading(false);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!clientId) return;
      await fetchAllData(false);
      if (cancelled) return;

      // FIX: Pause interval når tab er skjult
      const handleVisibilityChange = () => {
        isPausedRef.current = document.visibilityState === "hidden";
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        // FIX: Skip fetch hvis tab er skjult eller forrige fetch stadig kører
        if (isPausedRef.current) return;
        if (activeAbortRef.current) return; // FIX: Undgå race condition
        fetchAllData(false);
      }, 15000);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (activeAbortRef.current) {
        try { activeAbortRef.current.abort(); } catch { }
        activeAbortRef.current = null;
      }
    };
  }, [clientId]);

  // FIX: handleRefresh accepterer { silent } option for at undgå dobbelt snackbar
  const handleRefresh = async (options = {}) => {
    const silent = options?.silent === true;
    setRefreshing(true);
    await fetchAllData(true);
    setRefreshing(false);
    if (!silent) {
      setSnackbar({ open: true, message: "Data opdateret!", severity: "success" });
      setStreamKey(k => k + 1);
    }
  };

  const handleRestartStream = () => {
    setStreamKey(k => k + 1);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const handleShowSnackbar = (msgObj) => {
    if (!msgObj || typeof msgObj !== "object") return;
    setSnackbar({ open: true, message: msgObj.message || "", severity: msgObj.severity || "success" });
  };

  if (notFound) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" color="error">
            Klienten blev ikke fundet eller du har ikke adgang.
          </Typography>
        </Card>
        <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
          <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </MuiAlert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <>
      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
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
        showSnackbar={handleShowSnackbar}
      />
    </>
  );
}
