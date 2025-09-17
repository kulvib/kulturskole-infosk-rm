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

// Pulsating badge (samme grønne basisfarve pulserer)
function LiveStatusBadge({ isLive, clientId }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", ml: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "flex-end" }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: isLive ? "#43a047" : "#e53935",
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
          mr: 1,
          animation: isLive ? "pulsate 2s infinite" : "none"
        }} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 400,
            textTransform: "none",
            color: "#222",
            textAlign: "right",
            minWidth: 150
          }}
        >
          {isLive
            ? `stream klient ID: ${clientId}`
            : "offline"}
        </Typography>
      </Box>
      <style>
        {`
          @keyframes pulsate {
            0% {
              transform: scale(1);
              opacity: 1;
              background: #43a047;
            }
            50% {
              transform: scale(1.25);
              opacity: 0.5;
              background: #43a047;
            }
            100% {
              transform: scale(1);
              opacity: 1;
              background: #43a047;
            }
          }
        `}
      </style>
    </Box>
  );
}

// Dansk dato med ugedag
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
      // Hvis du også vil informere AGENT/klient direkte, kan du sende en besked via fx WebSocket eller et andet endpoint her.
      // Denne cleanup sender kun til din backend (server), som er ansvarlig for at fortælle agenten/klienten at stoppe streamen.
    }

    window.addEventListener("beforeunload", cleanupStream);
    return () => {
      window.removeEventListener("beforeunload", cleanupStream);
      cleanupStream();
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

  // Fullscreen handler
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

  return (
    <Grid container spacing={0}>
      <Grid item xs={12}>
        <Card elevation={2} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ pb: 1.5 }}>
            {/* Header med titel, opdater, live indikator (yderst højre) */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Klientstream
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
              <LiveStatusBadge isLive={manifestReady} clientId={clientId} />
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
              {/* Fuld skærm-knap under videoen */}
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
              {/* Sidst set info og forsinkelsesinfo UNDER knappen */}
              {lastLive && manifestReady && (
                <>
                  <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 1 }}>
                    Sidst set: {formatDateTimeWithDay(lastLive)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#888", mt: 0.5, textAlign: "center", width: "100%" }}>
                    stream kan være op til et minut forsinket
                  </Typography>
                </>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
