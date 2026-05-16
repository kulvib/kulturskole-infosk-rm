import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import ClientDetailsPage from "./ClientDetailsPage";
import { getClient, getMarkedDays, getCurrentSeason } from "../../api";

/*
  ClientDetailsPageWrapper.jsx

  FIX (kritisk): if (!id) return  satte aldrig loading=false → uendelig spinner.
  FIX: handleRefresh accepterer nu silent=true (bruges af handleClientAction)
       så der ikke vises snackbar ved knap-handlinger.
  FIX: mountedRef guard på alle async operationer.
  FIX: getMarkedDays(season, id) — korrekt parameter-rækkefølge.
*/

export default function ClientDetailsPageWrapper({ showSnackbar: showSnackbarProp }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [streamKey, setStreamKey] = useState(0);

  const mountedRef = useRef(true);

  // Robust showSnackbar
  const showSnackbar = useCallback((opts) => {
    if (typeof showSnackbarProp === "function") {
      showSnackbarProp(opts);
    } else {
      const { message, severity } = opts || {};
      if (severity === "error") console.warn("[snackbar error]", message);
      else console.info("[snackbar]", message);
    }
  }, [showSnackbarProp]);

  // Hent klient
  const fetchClient = useCallback(async (isRefresh = false) => {
    // FIX: Sæt loading=false og returner tidligt hvis id mangler
    if (!id) {
      setLoading(false);
      setRefreshing(false);
      setError("Ingen klient-ID fundet i URL.");
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await getClient(id);
      if (!mountedRef.current) return;
      if (!data) {
        setError("Klienten blev ikke fundet.");
        return;
      }
      setClient(data);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.response?.status === 403 || err?.status === 403) {
        setError("Du har ikke adgang til denne klient.");
      } else if (err?.response?.status === 404 || err?.status === 404) {
        setError("Klienten blev ikke fundet.");
      } else {
        setError("Kunne ikke hente klientdata: " + (err?.message || String(err)));
      }
    } finally {
      // FIX: finally kører altid — loading ryddes korrekt
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [id]);

  // Hent kalendermarkinger
  const fetchMarkedDays = useCallback(async () => {
    if (!id) return;
    setCalendarLoading(true);
    try {
      const seasonData = await getCurrentSeason();
      const season = seasonData?.id ?? seasonData?.season ?? null;
      if (!season) {
        setMarkedDays({});
        return;
      }
      // Korrekt parameter-rækkefølge: getMarkedDays(season, client_id)
      const data = await getMarkedDays(season, id);
      if (!mountedRef.current) return;
      const days = data?.markedDays ?? data?.marked_days ?? data ?? {};
      setMarkedDays(typeof days === "object" && !Array.isArray(days) ? days : {});
    } catch (err) {
      if (!mountedRef.current) return;
      console.warn("Kunne ikke hente kalendermarkinger:", err?.message || err);
      setMarkedDays({});
    } finally {
      if (mountedRef.current) setCalendarLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    fetchClient(false);
    fetchMarkedDays();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchClient, fetchMarkedDays]);

  // Refresh handler — silent=true bruges af handleClientAction (ingen snackbar)
  const handleRefresh = useCallback(async (silent = false) => {
    await Promise.all([fetchClient(true), fetchMarkedDays()]);
    if (!silent && mountedRef.current) {
      showSnackbar({ message: "Klient opdateret", severity: "success" });
    }
  }, [fetchClient, fetchMarkedDays, showSnackbar]);

  // Stream restart
  const handleRestartStream = useCallback(() => {
    setStreamKey((prev) => prev + 1);
  }, []);

  // --- Render ---

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, flexDirection: "column", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Henter klientdata...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, flexDirection: "column", gap: 2, px: 2 }}>
        <Typography variant="h6" color="error" align="center">
          {error}
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
          <Button variant="outlined" onClick={() => fetchClient(false)}>
            Prøv igen
          </Button>
          <Button variant="outlined" onClick={() => navigate("/clients")}>
            Tilbage til klientoversigt
          </Button>
        </Box>
      </Box>
    );
  }

  if (!client) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, flexDirection: "column", gap: 2 }}>
        <Typography variant="body1" color="text.secondary">
          Ingen klientdata tilgængelig.
        </Typography>
        <Button variant="outlined" onClick={() => navigate("/clients")}>
          Tilbage til klientoversigt
        </Button>
      </Box>
    );
  }

  return (
    <ClientDetailsPage
      client={client}
      refreshing={refreshing}
      handleRefresh={handleRefresh}
      markedDays={markedDays}
      calendarLoading={calendarLoading}
      streamKey={streamKey}
      onRestartStream={handleRestartStream}
      showSnackbar={showSnackbar}
    />
  );
}
