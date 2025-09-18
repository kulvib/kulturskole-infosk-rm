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

function LiveStatusBadge({ lagText, lastFetched }) {
  // Fjernet statusikon og tekst, da det nu vises i headeren
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", ml: 2 }}>
      {lagText && (
        <Typography variant="caption" sx={{ color: lagText === "Stream er live" ? "#43a047" : "#f90", textAlign: "right", mt: 0.5 }}>
          {lagText}
        </Typography>
      )}
      {lastFetched && (
        <Typography variant="caption" sx={{ color: "#888", textAlign: "right", mt: 0.5 }}>
          Sidste stream hentet: {formatDateTimeWithDay(lastFetched)}
        </Typography>
      )}
      <style>
        {`
          @keyframes pulsate {
            0% { transform: scale(1); opacity: 1; background: #43a047; }
            50% { transform: scale(1.25); opacity: 0.5; background: #43a047; }
            100% { transform: scale(1); opacity: 1; background: #43a047; }
          }
        `}
      </style>
    </Box>
  );
}

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
  return `${Math.round(lagSeconds/60)} minutter`;
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

  useEffect(() => {
    if (!manifestReady) return;
    let interval;
    interval = setInterval(() => {
      const hls = hlsRef.current;
      const video = videoRef.current;
      if (hls && video && hls.liveSyncPosition && typeof video.currentTime === "number") {
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

  let lagText = "";
  if (playerLag !== null) {
    if (playerLag < 1.5) {
      lagText = "Stream er live";
    } else {
      lagText = `Stream er ${formatLag(playerLag)} forsinket`;
    }
  }

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ pb: 1.5 }}>
            {/* Header med overskrift, refresh og status-ikon */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
                Stream
              </Typography>
              <Typography component="span" variant="h6" sx={{ fontWeight: 400, ml: 1 }}>
                – klient ID: {clientId}
              </Typography>
              <Tooltip title="Genindlæs stream">
                <span>
                  <IconButton
                    aria-label="refresh"
                    onClick={handleRefresh}
                    size="small"
                    sx={{ ml: 1 }}
                    disabled={refreshing}
                  >
                    {refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                  </IconButton>
                </span>
              </Tooltip>
              <Box sx={{ flexGrow: 1 }} />
              {/* Status-ikon uden tekst */}
              <Box sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: manifestReady ? "#43a047" : "#e53935",
                boxShadow: "0 0 2px rgba(0,0,0,0.12)",
                border: "1px solid #ddd",
                ml: 2,
                animation: manifestReady ? "pulsate 2s infinite" : "none"
              }} />
              <style>
                {`
                  @keyframes pulsate {
                    0% { transform: scale(1); opacity: 1; background: #43a047; }
                    50% { transform: scale(1.25); opacity: 0.5; background: #43a047; }
                    100% { transform: scale(1); opacity: 1; background: #43a047; }
                  }
                `}
              </style>
            </Box>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 200,
                width: "100%",
              }}
            >
              {!manifestReady && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    {error ? "Prøver igen ..." : "Venter på klientstream ..."}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: manifestReady ? "flex" : "none", alignItems: "center", justifyContent: "center", width: "100%" }}>
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
                    margin: "0 auto",
                  }}
                  tabIndex={-1}
                />
              </Box>
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
              {/* Statusbadge med lag og sidste hentet */}
              <LiveStatusBadge
                lagText={lagText}
                lastFetched={lastFetched}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
