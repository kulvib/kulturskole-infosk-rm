import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Box,
  Card,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Grid,
  Button,
  Stack,
  Divider,
  useMediaQuery
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useTheme } from "@mui/material/styles";

// Helper functions
async function fetchLatestProgramDateTime(hlsUrl) {
  try {
    const resp = await fetch(hlsUrl + "?cachebust=" + Date.now());
    if (!resp.ok) return null;
    const manifest = await resp.text();
    const lines = manifest.split('\n');
    let lastDateTime = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
        lastDateTime = lines[i].substring(25);
      }
    }
    return lastDateTime;
  } catch {
    return null;
  }
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
  return `${Math.round(lagSeconds / 60)} minutter`;
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function getLagStatus(playerLag, lastSegmentLag) {
  let lag;
  if (isSafari()) {
    lag = lastSegmentLag;
  } else {
    lag = playerLag !== null ? playerLag : lastSegmentLag;
  }
  if (lag == null) return { text: "", color: "#888" };
  if (lag < 2) return { text: "Live", color: "#43a047" };
  if (lag < 10) return { text: `Stream er ${formatLag(lag)} forsinket`, color: "#43a047" };
  if (lag < 30) return { text: `Stream er ${formatLag(lag)} forsinket`, color: "#f90" };
  return { text: `Stream er ${formatLag(lag)} forsinket`, color: "#e53935" };
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
  const [manifestProgramDateTime, setManifestProgramDateTime] = useState(null);
  const [manifestProgramLag, setManifestProgramLag] = useState(null);

  const [lastFetched, setLastFetched] = useState(null);

  const [buffering, setBuffering] = useState(false);

  const [currentSegment, setCurrentSegment] = useState("-");

  const [autoRefreshed, setAutoRefreshed] = useState(false);

  // Responsive font size for debug
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const debugFontSize = isMobile ? 11 : 12;

  function handleVideoWaiting() {
    setBuffering(true);
  }
  function handleVideoPlaying() {
    setBuffering(false);
  }
  function handleVideoCanPlay() {
    setBuffering(false);
  }

  useEffect(() => {
    if (!clientId) return;
    let ignore = false;

    async function maybeResetSegments() {
      try {
        const resp = await fetch(`/api/hls/${clientId}/last-segment-info?nocache=${Date.now()}`);
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

        hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
          if (data && data.frag && typeof data.frag.sn === "number") {
            setCurrentSegment(data.frag.sn);
          }
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
    if (!clientId) return;
    if (!isSafari() && !manifestReady) return;
    let stop = false;
    async function pollSegmentLag() {
      while (!stop) {
        try {
          const resp = await fetch(`/api/hls/${clientId}/last-segment-info?nocache=${Date.now()}`);
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
      if (hls && typeof hls.latency === "number") {
        setPlayerLag(hls.latency);
      } else if (hls && typeof hls.playbackLatency === "number") {
        setPlayerLag(hls.playbackLatency);
      } else {
        setPlayerLag(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [manifestReady]);

  useEffect(() => {
    if (!clientId || !manifestReady) return;
    let stop = false;
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    async function pollManifestProgramDateTime() {
      while (!stop) {
        const dtStr = await fetchLatestProgramDateTime(hlsUrl);
        if (dtStr) {
          setManifestProgramDateTime(dtStr);
          const segTime = new Date(dtStr).getTime();
          const now = Date.now();
          setManifestProgramLag((now - segTime) / 1000);
        } else {
          setManifestProgramDateTime(null);
          setManifestProgramLag(null);
        }
        await new Promise(res => setTimeout(res, 2000));
      }
    }
    pollManifestProgramDateTime();
    return () => { stop = true; };
  }, [clientId, manifestReady]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setAutoRefreshed(true);
      setManifestReady(false);
      setRefreshKey(prev => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoRefreshed) {
      const timeout = setTimeout(() => setAutoRefreshed(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [autoRefreshed]);

  const handleRefresh = () => {
    setRefreshing(true);
    setManifestReady(false);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshKey(prev => prev + 1);
    }, 500);
    setAutoRefreshed(false);
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

  let lagToShow = playerLag;
  let lagType = "player";
  if (lagToShow == null && manifestProgramLag != null) {
    lagToShow = manifestProgramLag;
    lagType = "manifest";
  }
  if (lagToShow == null && lastSegmentLag != null) {
    lagToShow = lastSegmentLag;
    lagType = "backend";
  }

  let sanitizedLag = lagToShow;
  if (sanitizedLag != null && sanitizedLag < 0) {
    console.warn(
      "[Lag warning] Negativ lag opdaget! Dette bør ikke ske.",
      {
        sanitizedLag,
        lagToShow,
        lagType,
        playerLag,
        manifestProgramLag,
        lastSegmentLag,
        clientTime: new Date().toISOString(),
        manifestProgramDateTime,
        lastSegmentTimestamp,
      }
    );
    sanitizedLag = 0;
  }

  const lagStatus = getLagStatus(sanitizedLag, lastSegmentLag);

  return (
    <Card elevation={2} sx={{ borderRadius: 2, p: isMobile ? 1 : 2 }}>
      <Grid
        container
        spacing={isMobile ? 1 : 2}
        alignItems="flex-start"
      >
        {/* Kolonne 1 */}
        <Grid item xs={12} md={3} minWidth={0}>
          <Stack spacing={1}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mr: 1, fontSize: isMobile ? 18 : 22 }}>
                Stream
              </Typography>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  bgcolor: manifestReady ? "#43a047" : "#e53935",
                  border: "1px solid #ddd",
                  mr: 1,
                  animation: manifestReady ? "pulsate 2s infinite" : "none"
                }}
              />
              <Tooltip title="Genindlæs stream">
                <span>
                  <IconButton
                    aria-label="refresh"
                    onClick={handleRefresh}
                    size={isMobile ? "small" : "medium"}
                    disabled={refreshing}
                  >
                    {refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Typography variant="body1" sx={{ color: lagStatus.color, fontSize: isMobile ? 14 : 16 }}>
              {lagStatus.text || "Ingen status"}
            </Typography>
            <Box>
              {error && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {error}
                </Alert>
              )}
              {autoRefreshed && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Stream blev automatisk genstartet
                </Alert>
              )}
            </Box>
          </Stack>
        </Grid>
        {/* Kolonne 2 */}
        <Grid item xs={12} md={5} minWidth={0}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative"
            }}
          >
            <Box
              sx={{
                display: manifestReady ? "flex" : "none",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                width: "100%"
              }}
            >
              <video
                ref={videoRef}
                id="livestream-video"
                autoPlay
                playsInline
                muted
                onWaiting={handleVideoWaiting}
                onPlaying={handleVideoPlaying}
                onCanPlay={handleVideoCanPlay}
                style={{
                  width: isMobile ? "100%" : 420,
                  maxWidth: "100%",
                  maxHeight: isMobile ? 200 : 320,
                  borderRadius: 8,
                  border: "2px solid #444",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.19)",
                  background: "#000",
                  margin: 0,
                  display: "block",
                }}
                tabIndex={-1}
              />
              {buffering && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                    background: "rgba(0,0,0,0.18)",
                    borderRadius: 8,
                  }}
                >
                  <CircularProgress size={isMobile ? 30 : 40} color="inherit" />
                  <Typography sx={{ color: "#fff", ml: 2, fontSize: isMobile ? 13 : 15 }}>
                    Buffering …
                  </Typography>
                </Box>
              )}
            </Box>
            {!manifestReady && (
              <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: isMobile ? 100 : 160,
                width: "100%"
              }}>
                <CircularProgress size={isMobile ? 24 : 32} />
                <Typography sx={{ ml: 2, fontSize: isMobile ? 13 : 15 }}>Forbinder til stream …</Typography>
              </Box>
            )}
            {manifestReady && (
              <Button
                startIcon={<FullscreenIcon />}
                variant="outlined"
                size={isMobile ? "small" : "medium"}
                sx={{ mt: 2, borderRadius: 2, alignSelf: "center" }}
                onClick={handleFullscreen}
              >
                Fuld skærm
              </Button>
            )}
          </Box>
        </Grid>
        {/* Kolonne 3 */}
        <Grid item xs={12} md={4} minWidth={0}>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : 15 }}>
              Klient ID: {clientId}
            </Typography>
            {(manifestProgramDateTime || lastSegmentTimestamp) && (
              <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : 15 }}>
                Sidste manifest hentet:{" "}
                {manifestProgramDateTime
                  ? formatDateTimeWithDay(new Date(manifestProgramDateTime))
                  : lastSegmentTimestamp
                    ? formatDateTimeWithDay(new Date(lastSegmentTimestamp))
                    : ""}
              </Typography>
            )}
            {lastFetched && (
              <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : 15 }}>
                Sidste kontakt til serveren: {formatDateTimeWithDay(lastFetched)}
              </Typography>
            )}
            <Divider sx={{ my: 1 }} />
            <Typography
              variant="caption"
              sx={{
                color: "#999",
                fontFamily: "monospace",
                textAlign: "left",
                fontSize: debugFontSize,
              }}
            >
              Debug: playerLag={playerLag}, manifestProgramLag={manifestProgramLag}, backendLag={lastSegmentLag}, lagType={lagType}
            </Typography>
            {!isSafari() && (
              <Typography
                variant="caption"
                sx={{
                  color: "#999",
                  fontFamily: "monospace",
                  textAlign: "left",
                  fontSize: debugFontSize,
                }}
              >
                Segment: {currentSegment}
              </Typography>
            )}
            {isSafari() && (
              <Typography
                variant="caption"
                sx={{
                  color: "#f90",
                  fontFamily: "monospace",
                  textAlign: "left",
                  fontSize: debugFontSize,
                }}
              >
                Safari browser: segmentnummer ikke tilgængelig. Forsinkelse er estimeret ud fra serverens sidste segment
              </Typography>
            )}
          </Stack>
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
    </Card>
  );
}
