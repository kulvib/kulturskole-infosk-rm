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
  const dayName = ukedage[d.getDay()];
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  const sec = d.getSeconds().toString().padStart(2, "0");
  return `${dayName} ${day}.${month} ${year}, kl. ${hour}:${min}:${sec}`;
}

function formatLag(lagSeconds) {
  if (lagSeconds < 1.5) return "";
  if (lagSeconds < 60) return `${Math.round(lagSeconds)} sekunder`;
  return `${Math.round(lagSeconds / 60)} minutter`;
}

function getLagStatus(playerLag, lastSegmentLag) {
  let lag = playerLag !== null ? playerLag : lastSegmentLag;
  if (lag == null) return { text: "", color: "#888" };
  if (lag < 2) return { text: "Live", color: "#43a047" };
  if (lag < 30) return { text: `Forsinket: ${formatLag(lag)} bagud`, color: "#f90" };
  return { text: `Forsinket: ${formatLag(lag)} bagud`, color: "#e53935" };
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestReady, setManifestReady] = useState(false);
  const [error, setError] = useState("");
  const [lastLive, setLastLive] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastSegmentLag, setLastSegmentLag] = useState(null);

  const [playerLag, setPlayerLag] = useState(null);

  const [lastFetched, setLastFetched] = useState(null);

  // Debug: Vis lag-værdier i konsollen
  useEffect(() => {
    if (playerLag !== null || lastSegmentLag !== null) {
      // Fjern evt. hvis du ikke vil have debug log
      console.log("playerLag:", playerLag, "lastSegmentLag:", lastSegmentLag);
    }
  }, [playerLag, lastSegmentLag]);

  useEffect(() => {
    if (!clientId) return;
    let ignore = false;

    async function maybeResetSegments() {
      try {
        const resp = await fetch(`/api/hls/${clientId}/last-segment-info`);
        let doReset = false;
        if (!resp.ok) {
          doReset = true;
        } else {
          const data = await resp.json();
          if (!data.timestamp || data.error) {
            doReset = true;
          } else {
            const segTime = new Date(data.timestamp).getTime();
            if (Date.now() - segTime > 5 * 60 * 1000) {
              doReset = true;
            }
          }
        }
        if (!ignore && doReset) {
          await fetch(`/api/hls/${clientId}/reset`, { method: "POST" });
        }
      } catch (e) {}
    }
    maybeResetSegments();
    return () => { ignore = true; };
  }, [clientId, refreshKey]);

  useEffect(() => {
    if (!clientId) return;
    const video = videoRef.current;
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;

    let hls;
    let manifestChecked = false;
    let stopPolling = false;
    let pollInterval;

    const startPlayback = () => {
      setError("");
      setManifestReady(true);
      setLastLive(new Date());
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
      } else if (Hls.isSupported()) {
        hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setError("Streamen blev afbrudt. Prøver igen ...");
            setManifestReady(false);
            cleanup();
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
    };

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };

    const poll = async () => {
      try {
        const resp = await fetch(hlsUrl, { method: "HEAD" });
        if (resp.ok) {
          setLastFetched(new Date());
          if (!manifestChecked) {
            manifestChecked = true;
            setError("");
            setManifestReady(true);
            startPlayback();
          }
        } else {
          throw new Error("404");
        }
      } catch (e) {
        if (manifestChecked) {
          setError("Streamen blev afbrudt eller forsvandt. Prøver igen ...");
          setManifestReady(false);
          cleanup();
        } else {
          setError("Kan ikke finde klientstream endnu.");
        }
        manifestChecked = false;
      }
    };

    poll();
    pollInterval = setInterval(() => {
      if (stopPolling) return;
      poll();
    }, manifestReady ? 5000 : 250);

    return () => {
      stopPolling = true;
      clearInterval(pollInterval);
      cleanup();
    };
  }, [clientId, refreshKey]);

  // Poll segment info fra backend
  useEffect(() => {
    if (!clientId || !manifestReady) return;
    let stop = false;
    async function pollSegmentLag() {
      while (!stop) {
        try {
          const resp = await fetch(`/api/hls/${clientId}/last-segment-info`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.timestamp) {
              setLastSegmentTimestamp(data.timestamp);
              const segTime = new Date(data.timestamp).getTime();
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
  }, [clientId, manifestReady]);

  // Udregn playerLag fra Hls.js (hvis muligt)
  useEffect(() => {
    if (!manifestReady) return;
    let interval;
    interval = setInterval(() => {
      const hls = hlsRef.current;
      const video = videoRef.current;
      if (hls && video && typeof hls.liveSyncPosition === "number" && typeof video.currentTime === "number") {
        // Debug: Udskriv værdierne
        // console.log("liveSyncPosition", hls.liveSyncPosition, "currentTime", video.currentTime, "lag", hls.liveSyncPosition - video.currentTime);
        const lag = hls.liveSyncPosition - video.currentTime;
        setPlayerLag(lag);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [manifestReady]);

  useEffect(() => {
    let interval;
    if (manifestReady) {
      setLastLive(new Date());
      interval = setInterval(() => {
        setLastLive(new Date());
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [manifestReady]);

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

  const lagStatus = getLagStatus(playerLag, lastSegmentLag);

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ pb: 1.5 }}>
            <Grid container alignItems="flex-start" spacing={2}>
              {/* Venstre: Video */}
              <Grid item>
                <Box
                  sx={{
                    display: manifestReady ? "flex" : "none",
                    alignItems: "flex-start",
                    justifyContent: "center",
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
                    }}
                    tabIndex={-1}
                  />
                </Box>
                {!manifestReady && (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, width: 420 }}>
                    <CircularProgress size={32} />
                  </Box>
                )}
              </Grid>
              {/* Højre: Tekst og kontrol */}
              <Grid item xs>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    height: "100%",
                  }}
                >
                  {/* Header */}
                  <Box sx={{ display: "flex", alignItems: "center", minHeight: 34 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
                      Stream
                    </Typography>
                    <Box sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      bgcolor: manifestReady ? "#43a047" : "#e53935",
                      boxShadow: "0 0 2px rgba(0,0,0,0.12)",
                      border: "1px solid #ddd",
                      mr: 0.5,
                      animation: manifestReady ? "pulsate 2s infinite" : "none"
                    }} />
                  </Box>
                  {/* Statusinfo */}
                  <Box sx={{ textAlign: "left", minWidth: 180, mb: 1 }}>
                    <Typography variant="body2" sx={{ color: lagStatus.color, fontWeight: 700 }}>
                      {lagStatus.text || "Ingen status"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#999" }}>
                      (Debug: playerLag={playerLag}, lastSegmentLag={lastSegmentLag})
                    </Typography>
                    {lastFetched && (
                      <Typography variant="caption" sx={{ color: "#888", display: "block" }}>
                        Sidste stream hentet: {formatDateTimeWithDay(lastFetched)}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: "#888", display: "block" }}>
                      Klient ID: {clientId}
                    </Typography>
                  </Box>
                  {/* Refresh-knap */}
                  <Box sx={{ display: "flex", alignItems: "center", mt: 0, mb: 1 }}>
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
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  )}
                  {/* Fullscreen og segmentinfo */}
                  {manifestReady && (
                    <Button
                      startIcon={<FullscreenIcon />}
                      variant="outlined"
                      size="small"
                      sx={{ mt: 2, mb: 1, borderRadius: 2 }}
                      onClick={handleFullscreen}
                    >
                      Fuld skærm
                    </Button>
                  )}
                  {lastSegmentTimestamp && lastSegmentLag !== null && (
                    <Typography variant="caption" sx={{ color: "#888", mt: 0.5, textAlign: "center", width: "100%" }}>
                      Seneste segment modtaget for {lastSegmentLag < 1.5 ? "mindre end 2 sekunder" : formatLag(lastSegmentLag)} siden
                      {lastSegmentTimestamp && (
                        <> ({formatDateTimeWithDay(new Date(lastSegmentTimestamp))})</>
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
      </Grid>
    </Grid>
  );
}
