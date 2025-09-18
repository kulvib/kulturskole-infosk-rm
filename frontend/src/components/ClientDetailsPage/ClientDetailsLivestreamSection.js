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

// ... LiveStatusBadge og formateringsfunktioner som før ...

export default function ClientDetailsLivestreamSection({ clientId, isAdmin }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestReady, setManifestReady] = useState(false);
  const [error, setError] = useState("");
  const [lastLive, setLastLive] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Server-lag state (fra backend: tid siden sidste segment blev skrevet)
  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastSegmentLag, setLastSegmentLag] = useState(null);

  // Player-lag state (forsinkelse fra Hls.js live edge)
  const [playerLag, setPlayerLag] = useState(null);

  // Intelligent reset: kun hvis sidste segment er >5 minutter gammelt eller ingen manifest
  useEffect(() => {
    if (!clientId) return;
    let ignore = false;

    async function maybeResetSegments() {
      try {
        const resp = await fetch(`/api/hls/${clientId}/last-segment-info`);
        let doReset = false;
        if (!resp.ok) {
          doReset = true; // ingen manifest, reset
        } else {
          const data = await resp.json();
          if (!data.timestamp || data.error) {
            doReset = true;
          } else {
            const segTime = new Date(data.timestamp).getTime();
            if (Date.now() - segTime > 5 * 60 * 1000) { // 5 minutter
              doReset = true;
            }
          }
        }
        if (!ignore && doReset) {
          await fetch(`/api/hls/${clientId}/reset`, { method: "POST" });
        }
      } catch (e) {
        // fejl ignoreres
      }
    }
    maybeResetSegments();
    return () => { ignore = true; };
  }, [clientId, refreshKey]);

  // Polls for manifest, and handles auto-reconnect
  useEffect(() => {
    if (!clientId) return;
    const video = videoRef.current;
    const hlsUrl = `/hls/${clientId}/index.m3u8`;

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
    }, manifestReady ? 5000 : 250);

    return () => {
      stopPolling = true;
      clearInterval(pollInterval);
      cleanup();
    };
  }, [clientId, refreshKey]);

  // Poll server-side lag (tid siden server modtog sidste segment)
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

  // Poll player-lag via Hls.js liveSyncPosition vs video.currentTime
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

  // Admin: manuel reset (kun for admins/support)
  const handleAdminReset = async () => {
    setError(""); // Clear any old error
    try {
      const resp = await fetch(`/api/hls/${clientId}/reset`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || (data && data.message && data.message !== "reset done")) {
        setError(data?.errors?.join(", ") || data?.message || "Fejl ved nulstilling");
      } else {
        setRefreshKey(prev => prev + 1); // force reload
      }
    } catch {
      setError("Kunne ikke nulstille segmenter (netværksfejl)");
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
              {isAdmin && (
                <Tooltip title="Nulstil segmenter (admin)">
                  <span>
                    <IconButton
                      aria-label="reset"
                      onClick={handleAdminReset}
                      size="small"
                      sx={{ ml: 1 }}
                    >
                      <RefreshIcon color="error" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
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
              {/* Sidst set info og lag-info */}
              {lastLive && manifestReady && (
                <>
                  <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 1 }}>
                    Sidst set: {formatDateTimeWithDay(lastLive)}
                  </Typography>
                  {/* PLAYER-LAG: hvor langt bagud er brugeren ift. live edge */}
                  {playerLag !== null && (
                    <Typography variant="caption" sx={{ color: playerLag < 2 ? "#43a047" : "#f90", mt: 0.5, textAlign: "center", width: "100%" }}>
                      {playerLag < 1.5
                        ? "Du ser helt live!"
                        : `Du ser streamen med ${formatLag(playerLag)} forsinkelse fra live`}
                    </Typography>
                  )}
                  {/* SERVER-LAG: hvor gammelt er serverens seneste segment */}
                  {lastSegmentTimestamp && lastSegmentLag !== null && (
                    <Typography variant="caption" sx={{ color: "#888", mt: 0.5, textAlign: "center", width: "100%" }}>
                      Seneste segment modtaget for {formatLag(lastSegmentLag)} siden
                      {lastSegmentTimestamp && (
                        <> ({formatDateTimeWithDay(new Date(lastSegmentTimestamp))})</>
                      )}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
