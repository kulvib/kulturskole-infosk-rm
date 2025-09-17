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
  Grid
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

// Pulsating grøn badge som matcher dine øvrige badges visuelt
function LiveStatusBadge({ isLive }) {
  const color = isLive ? "#43a047" : "#e53935";
  const text = isLive ? "live" : "offline";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 2 }}>
      <Box sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: color,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
        mr: 1,
        animation: isLive ? "pulsate 1.2s infinite" : "none"
      }} />
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          textTransform: "lowercase",
          color: color
        }}
      >
        {text}
      </Typography>
      <style>
        {`
          @keyframes pulsate {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.5);
              opacity: 0.5;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
    </Box>
  );
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestReady, setManifestReady] = useState(false);
  const [error, setError] = useState("");
  const [lastLive, setLastLive] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // STOP STREAM & RYD OP VED UNLOAD
  useEffect(() => {
    if (!clientId) return;

    function cleanupStream() {
      navigator.sendBeacon(
        `/api/clients/${clientId}/stop-hls`
      );
    }

    window.addEventListener("beforeunload", cleanupStream);
    return () => {
      window.removeEventListener("beforeunload", cleanupStream);
      cleanupStream(); // også ved unmount
    };
  }, [clientId]);

  // Polls for manifest, and handles auto-reconnect
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

    // Poll for manifest
    const poll = async () => {
      try {
        const resp = await fetch(hlsUrl, { method: "HEAD" });
        if (resp.ok) {
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
    }, manifestReady ? 5000 : 1000);

    return () => {
      stopPolling = true;
      clearInterval(pollInterval);
      cleanup();
    };
  }, [clientId, refreshKey]);

  // Opdater Sidst set live hvert 5. sekund så længe streamen er live
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

  // Manuelt refresh (nu med refreshKey)
  const handleRefresh = () => {
    setRefreshing(true);
    setManifestReady(false);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshKey(prev => prev + 1);
    }, 500);
  };

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ pb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                Klientstream
              </Typography>
              <LiveStatusBadge isLive={manifestReady} />
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
            </Box>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {/* Centrer video og loader */}
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
              <video
                ref={videoRef}
                id="livestream-video"
                controls
                autoPlay
                playsInline
                muted
                style={{
                  maxWidth: "100%",
                  maxHeight: 320,
                  borderRadius: 8,
                  display: manifestReady ? "block" : "none",
                  background: "#000",
                  margin: "0 auto"
                }}
                tabIndex={-1}
              />
              {lastLive && manifestReady && (
                <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 2 }}>
                  Sidst set live: {lastLive.toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
