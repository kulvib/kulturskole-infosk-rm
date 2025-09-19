import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Grid,
  Button
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

function formatDateTimeWithDay(date) {
  if (!date) return "";
  const ukedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Ugyldig dato";
  const dayName = ukedage[d.getDay()];
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  const sec = d.getSeconds().toString().padStart(2, "0");
  return `${dayName} ${day}.${month} ${year}, kl. ${hour}:${min}:${sec}`;
}

// Trim mikrosekunder fra timestamp hvis nødvendigt
function safeParseDate(ts) {
  if (!ts) return null;
  // Fjern mikrosekunder, fx ".499584" før Z
  return new Date(ts.replace(/\.\d+Z$/, "Z"));
}

function formatLag(lagSeconds) {
  if (lagSeconds < 1.5) return "";
  if (lagSeconds < 60) return `${Math.round(lagSeconds)} sekunder`;
  return `${Math.round(lagSeconds / 60)} minutter`;
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestReady, setManifestReady] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastSegmentLag, setLastSegmentLag] = useState(null);
  const [playerLag, setPlayerLag] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Setup HLS only once per (clientId, refreshKey)
  useEffect(() => {
    if (!clientId) return;
    const video = videoRef.current;
    if (!video) return;

    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    let hls;
    let destroyed = false;

    async function setupStream() {
      setError("");
      setManifestReady(false);
      // First, check if manifest exists
      try {
        const resp = await fetch(hlsUrl, { method: "HEAD" });
        if (!resp.ok) throw new Error("Streamen ikke fundet endnu");
        setManifestReady(true);
      } catch (e) {
        setError("Kan ikke finde klientstream endnu.");
        setManifestReady(false);
        return;
      }

      // Setup HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.load();
      } else if (Hls.isSupported()) {
        hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal && !destroyed) {
            setError("Streamen blev afbrudt. Prøver igen ...");
            setManifestReady(false);
            hls.destroy();
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
    }

    setupStream();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, [clientId, refreshKey]);

  // Safari/Native stream fallback: mark manifestReady if video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handle = setInterval(() => {
      if (video.readyState >= 2 && !manifestReady) {
        setManifestReady(true);
      }
    }, 1000);
    return () => clearInterval(handle);
  }, [manifestReady]);

  // Poll for lag/segment info
  useEffect(() => {
    if (!clientId) return;
    let stop = false;
    async function pollSegmentLag() {
      while (!stop) {
        try {
          const resp = await fetch(`/api/hls/${clientId}/last-segment-info`);
          if (resp.ok) {
            const data = await resp.json();
            console.log("Segment info fra API:", data);
            if (data.timestamp) {
              setLastSegmentTimestamp(data.timestamp);
              const segTime = safeParseDate(data.timestamp).getTime();
              const now = Date.now();
              setLastSegmentLag((now - segTime) / 1000);
            } else {
              setLastSegmentTimestamp(null);
              setLastSegmentLag(null);
            }
          }
        } catch {
          setLastSegmentTimestamp(null);
          setLastSegmentLag(null);
        }
        await new Promise(res => setTimeout(res, 2000));
      }
    }
    pollSegmentLag();
    return () => { stop = true; };
  }, [clientId, refreshKey]);

  // Poll for lastFetched
  useEffect(() => {
    if (!clientId) return;
    let stop = false;
    async function pollFetched() {
      while (!stop) {
        try {
          const resp = await fetch(`https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`, { method: "HEAD" });
          if (resp.ok) setLastFetched(new Date());
        } catch {}
        await new Promise(res => setTimeout(res, 5000));
      }
    }
    pollFetched();
    return () => { stop = true; };
  }, [clientId, refreshKey]);

  // Poll for player lag (only with HLS)
  useEffect(() => {
    let interval;
    interval = setInterval(() => {
      const hls = hlsRef.current;
      const video = videoRef.current;
      if (
        hls &&
        video &&
        typeof hls.liveSyncPosition === "number" &&
        typeof video.currentTime === "number" &&
        !isNaN(hls.liveSyncPosition) &&
        !isNaN(video.currentTime)
      ) {
        const lag = Math.abs(hls.liveSyncPosition - video.currentTime);
        console.log("liveSyncPosition:", hls.liveSyncPosition, "currentTime:", video.currentTime, "lag:", lag);
        setPlayerLag(lag);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setManifestReady(false);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshKey(prev => prev + 1);
    }, 500);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen();
    } else if (video.msRequestFullscreen) {
      video.msRequestFullscreen();
    }
  };

  // Livestream indikator tekst (ALTID vis) + forbedret fallback
  let lagText = "";
  if (playerLag !== null && !isNaN(playerLag)) {
    if (playerLag < 1.5) {
      lagText = "Stream er live";
    } else {
      lagText = `Stream er ${formatLag(playerLag)} forsinket`;
    }
  }

  // Fallback: hvis playerLag ikke kendes men manifestReady, sig "Stream status ukendt"
  const liveIndicatorValue =
    playerLag !== null && !isNaN(playerLag)
      ? lagText
      : (manifestReady
          ? "Stream status ukendt"
          : "Stream ikke aktiv");

  // Debug-log for timestamp parsing og rendering
  console.log("lastSegmentTimestamp:", lastSegmentTimestamp, safeParseDate(lastSegmentTimestamp));
  console.log("playerLag:", playerLag, "lagText:", lagText, "liveIndicatorValue:", liveIndicatorValue);

  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        <Grid container spacing={2} alignItems="flex-start">
          {/* Kolonne 1: Header/kontrol */}
          <Grid item xs={12} md={4}>
            <Box sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              alignItems: { xs: "flex-start", md: "flex-start" },
              height: "100%",
              mt: 1,
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Stream
                </Typography>
                <Box sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: manifestReady ? "#43a047" : "#e53935",
                  boxShadow: "0 0 2px rgba(0,0,0,0.12)",
                  border: "1px solid #ddd",
                  animation: manifestReady ? "pulsate 2s infinite" : "none"
                }} />
                <Tooltip title="Genindlæs stream">
                  <span>
                    <IconButton
                      aria-label="refresh"
                      onClick={handleRefresh}
                      size="small"
                      disabled={refreshing}
                    >
                      {refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </Box>
          </Grid>
          {/* Kolonne 2: Video + Fuld skærm */}
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                height: "100%",
              }}
            >
              <video
                ref={videoRef}
                id="livestream-video"
                autoPlay
                playsInline
                muted
                style={{
                  maxWidth: 420,
                  maxHeight: 320,
                  borderRadius: 8,
                  border: "2px solid #444",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.19)",
                  background: "#000",
                  margin: 0,
                  display: manifestReady ? "block" : "none",
                }}
                tabIndex={-1}
              />
              {!manifestReady && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, width: 420 }}>
                  <CircularProgress size={32} />
                </Box>
              )}
              {manifestReady && (
                <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                  <Button
                    startIcon={<FullscreenIcon />}
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2, mb: 1, borderRadius: 2 }}
                    onClick={handleFullscreen}
                  >
                    Fuld skærm
                  </Button>
                </Box>
              )}
            </Box>
          </Grid>
          {/* Kolonne 3: Livestream-indikator + Statusinfo */}
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: { xs: "flex-end", md: "flex-end" },
                justifyContent: "flex-start",
                height: "100%",
                gap: 1,
                mt: 1,
                textAlign: "right"
              }}
            >
              {/* Livestream indikator - altid synlig */}
              <Typography variant="body2" sx={{
                color: liveIndicatorValue === "Stream er live" ? "#43a047" : (liveIndicatorValue.includes("forsinket") ? "#f90" : "#888"),
                fontWeight: 700,
                fontSize: "1.1rem",
                mb: 1,
                letterSpacing: "0.02em",
              }}>
                {liveIndicatorValue}
              </Typography>
              {lastFetched && (
                <Typography variant="caption" sx={{ color: "#888", display: "block" }}>
                  Sidste stream hentet: {formatDateTimeWithDay(lastFetched)}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: "#888", display: "block" }}>
                Klient ID: {clientId}
              </Typography>
              {/* NYT: Vis tidspunkt for nyeste videoindhold */}
              {lastSegmentTimestamp && (
                <Typography variant="caption" sx={{ color: "#888", display: "block" }}>
                  Nyeste videoindhold: {formatDateTimeWithDay(safeParseDate(lastSegmentTimestamp))}
                </Typography>
              )}
              {lastSegmentTimestamp && lastSegmentLag !== null && (
                <Typography variant="caption" sx={{ color: "#888", mt: 0.5 }}>
                  Seneste segment modtaget for {lastSegmentLag < 1.5 ? "mindre end 2 sekunder" : formatLag(lastSegmentLag)} siden
                  {lastSegmentTimestamp && (
                    <> ({formatDateTimeWithDay(safeParseDate(lastSegmentTimestamp))})</>
                  )}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
        <style>
          {`
            @keyframes pulsate {
              0% { transform: scale(1); opacity: 1; background: #43a047; }
              50% { transform: scale(1.25); opacity: 0.5; background: #43a047; }
              100% { transform: scale(1); opacity: 1; background: #43a047; }
            }
          `}
        </style>
      </CardContent>
    </Card>
  );
}
