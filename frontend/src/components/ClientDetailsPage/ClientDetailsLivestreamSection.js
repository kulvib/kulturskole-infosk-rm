import React, { useEffect, useRef, useState, useMemo } from "react";
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
  Stack,
  Divider,
  useMediaQuery
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useTheme, alpha } from "@mui/material/styles";
import { useAuth } from "../../auth/authcontext";

// This file adjusted to avoid fixed heights that create internal scrollbars.
// Cards/container elements no longer force height:100% or fixed minHeights.

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

function formatLagValue(val) {
  if (val == null) return "-";
  return Number(val).toFixed(3).replace(/(\.\d*?[1-9])0+$|\.0*$/, "$1");
}

export default function ClientDetailsLivestreamSection({
  clientId,
  refreshing: parentRefreshing = false,
  onRestartStream = null,
  streamKey = null,
  clientOnline = true
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [manifestReady, setManifestReady] = useState(false);
  const [error, setError] = useState("");
  const [lastLive, setLastLive] = useState(null);

  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastSegmentLag, setLastSegmentLag] = useState(null);

  const [playerLag, setPlayerLag] = useState(null);
  const [manifestProgramDateTime, setManifestProgramDateTime] = useState(null);
  const [manifestProgramLag, setManifestProgramLag] = useState(null);

  const [lastFetched, setLastFetched] = useState(null);

  const [buffering, setBuffering] = useState(false);

  const [currentSegment, setCurrentSegment] = useState("-");

  const [autoRefreshed, setAutoRefreshed] = useState(false);
  const [manualRefreshed, setManualRefreshed] = useState(false);

  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    setRefreshing(Boolean(parentRefreshing));
  }, [parentRefreshing]);

  useEffect(() => {
    if (!showControls) return;
    const timeout = setTimeout(() => setShowControls(false), 2200);
    return () => clearTimeout(timeout);
  }, [showControls]);

  const handleMouseMove = () => setShowControls(true);

  function handleVideoWaiting() { setBuffering(true); }
  function handleVideoPlaying() { setBuffering(false); }
  function handleVideoCanPlay() { setBuffering(false); }

  const effectiveRefreshKey = useMemo(() => {
    return (typeof streamKey !== "undefined" && streamKey !== null) ? streamKey : localRefreshKey;
  }, [streamKey, localRefreshKey]);

  useEffect(() => {
    if (!clientId) return;
    if (clientOnline === false) return;
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
  }, [clientId, effectiveRefreshKey, clientOnline]);

  useEffect(() => {
    if (!clientId) return;
    if (clientOnline === false) {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.removeAttribute("src");
          videoRef.current.load();
        } catch {}
      }
      setManifestReady(false);
      setError("");
      return;
    }

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
      if (video && video.canPlayType && video.canPlayType("application/vnd.apple.mpegurl")) {
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
      if (video) {
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
      }
    };

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.removeAttribute("src");
          videoRef.current.load();
        } catch {}
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
  }, [clientId, effectiveRefreshKey, clientOnline]);

  useEffect(() => {
    if (!clientId) return;
    if (clientOnline === false) return;
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
  }, [clientId, manifestReady, effectiveRefreshKey, clientOnline]);

  useEffect(() => {
    if (!manifestReady) return;
    if (clientOnline === false) return;
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
  }, [manifestReady, effectiveRefreshKey, clientOnline]);

  useEffect(() => {
    if (!clientId || !manifestReady) return;
    if (clientOnline === false) return;
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
  }, [clientId, manifestReady, effectiveRefreshKey, clientOnline]);

  useEffect(() => {
    let interval;
    if (manifestReady) {
      setLastLive(new Date());
      interval = setInterval(() => {
        setLastLive(new Date());
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [manifestReady, effectiveRefreshKey]);

  useEffect(() => {
    if (clientOnline === false) return;
    const interval = setInterval(() => {
      setAutoRefreshed(true);
      if (typeof onRestartStream === "function") {
        onRestartStream();
      } else {
        setLocalRefreshKey(k => k + 1);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [onRestartStream, clientOnline]);

  useEffect(() => {
    if (autoRefreshed) {
      const timeout = setTimeout(() => setAutoRefreshed(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [autoRefreshed]);

  useEffect(() => {
    if (manualRefreshed) {
      const timeout = setTimeout(() => setManualRefreshed(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [manualRefreshed]);

  const handleRefreshClick = () => {
    if (clientOnline === false) return;
    setManualRefreshed(true);
    if (typeof onRestartStream === "function") {
      onRestartStream();
    } else {
      setRefreshing(true);
      setLocalRefreshKey(k => k + 1);
      setTimeout(() => setRefreshing(false), 800);
    }
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

  const disabledOverlay = clientOnline === false ? { opacity: 0.65 } : {};

  return (
    <Card elevation={2} sx={{ borderRadius: 2, p: isMobile ? 1 : 2, overflow: "visible", ...disabledOverlay }}>
      <Grid
        container
        spacing={isMobile ? 1 : 2}
        alignItems="flex-start"
      >
        {/* Kolonne 1 */}
        <Grid item xs={12} md={3} minWidth={0}>
          <Stack spacing={1}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
                Stream
              </Typography>
              <Box
                sx={{
                  width: isMobile ? 8 : 10,
                  height: isMobile ? 8 : 10,
                  borderRadius: "50%",
                  bgcolor: clientOnline === false ? "#9e9e9e" : (manifestReady ? "#43a047" : "#e53935"),
                  border: "1px solid #ddd",
                  mr: 1,
                  animation: manifestReady && clientOnline !== false ? "pulsate 2s infinite" : "none"
                }}
              />
              <Tooltip title={clientOnline === false ? "Klienten er offline" : "Genindlæs stream"}>
                <span>
                  <IconButton
                    aria-label="refresh"
                    onClick={handleRefreshClick}
                    size={isMobile ? "small" : "medium"}
                    disabled={refreshing || !clientId || clientOnline === false}
                  >
                    { (refreshing && clientOnline !== false) ? <CircularProgress size={isMobile ? 20 : 18} color="inherit" /> : <RefreshIcon sx={{ fontSize: isMobile ? 26 : undefined }} /> }
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Typography variant="body2" sx={{ color: lagStatus.color, fontSize: isMobile ? 13 : undefined }}>
              {clientOnline === false ? "Klienten er offline — stream ikke tilgængelig" : (lagStatus.text || "Ingen status")}
            </Typography>
            <Box>
              {manualRefreshed && clientOnline !== false && (
                <Alert severity="info" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>
                  Stream blev genstartet manuelt
                </Alert>
              )}
              {autoRefreshed && clientOnline !== false && (
                <Alert severity="info" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>
                  Stream blev automatisk genstartet
                </Alert>
              )}
              {error && clientOnline !== false && (
                <Alert severity="error" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>
                  {error}
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
              position: "relative",
              overflow: "visible"
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: "100%",
                display: (manifestReady && clientOnline !== false) ? "flex" : "none",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible"
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setShowControls(false)}
              tabIndex={0}
              onFocus={() => setShowControls(true)}
              onBlur={() => setShowControls(false)}
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
                  height: "auto",
                  borderRadius: 8,
                  border: "2px solid #444",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.19)",
                  background: "#000",
                  margin: 0,
                  display: "block",
                }}
                tabIndex={-1}
                key={effectiveRefreshKey}
              />
              {manifestReady && clientOnline !== false && (
                <IconButton
                  onClick={handleFullscreen}
                  aria-label="Fuld skærm"
                  sx={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    bgcolor: alpha("#222", 0.6),
                    color: "#fff",
                    borderRadius: "50%",
                    zIndex: 20,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.19)",
                    opacity: showControls ? 1 : 0,
                    pointerEvents: showControls ? "auto" : "none",
                    transition: "opacity 0.3s",
                    "&:hover": {
                      bgcolor: alpha("#111", 0.85)
                    }
                  }}
                  size={isMobile ? "small" : "medium"}
                  tabIndex={0}
                >
                  <FullscreenIcon sx={{ fontSize: isMobile ? 26 : 32 }} />
                </IconButton>
              )}
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
                  <CircularProgress size={isMobile ? 20 : 40} color="inherit" />
                  <Typography variant="body2" sx={{ color: "#fff", ml: isMobile ? 1 : 2, fontSize: isMobile ? 12 : undefined }}>
                    Buffering …
                  </Typography>
                </Box>
              )}
            </Box>
            {!manifestReady || clientOnline === false ? (
              <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                bgcolor: clientOnline === false ? "#fafafa" : "transparent",
                borderRadius: 1,
                py: 2
              }}>
                {clientOnline === false ? (
                  <Typography variant="body2" sx={{ fontSize: isMobile ? 13 : undefined }}>
                    Klienten er offline — livestream deaktiveret
                  </Typography>
                ) : (
                  <>
                    <CircularProgress size={isMobile ? 24 : 32} />
                    <Typography variant="body2" sx={{ ml: 2, fontSize: isMobile ? 13 : undefined }}>Forbinder til stream …</Typography>
                  </>
                )}
              </Box>
            ) : null}
          </Box>
        </Grid>
        {/* Kolonne 3 - kun for admin */}
        {user?.role === "admin" && (
          <Grid item xs={12} md={4} minWidth={0}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : undefined }}>
                Klient ID: {clientId}
              </Typography>
              {(manifestProgramDateTime || lastSegmentTimestamp) && clientOnline !== false && (
                <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : undefined }}>
                  Sidste manifest hentet:{" "}
                  {manifestProgramDateTime
                    ? formatDateTimeWithDay(new Date(manifestProgramDateTime))
                    : lastSegmentTimestamp
                      ? formatDateTimeWithDay(new Date(lastSegmentTimestamp))
                      : ""}
                </Typography>
              )}
              {lastFetched && clientOnline !== false && (
                <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : undefined }}>
                  Sidste kontakt til serveren: {formatDateTimeWithDay(lastFetched)}
                </Typography>
              )}
              <Divider sx={{ my: isMobile ? 0.5 : 1 }} />
              <Box
                sx={{
                  background: "#f7f7f7",
                  borderRadius: 1,
                  p: 1,
                  mt: 1,
                  mb: 1,
                  display: 'inline-block'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "#111",
                    fontFamily: '"Courier New", Courier, monospace',
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    display: "block",
                    mb: 0.5,
                    fontSize: isMobile ? 11 : undefined,
                  }}
                >
                  Debug info:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#222",
                    fontFamily: '"Courier New", Courier, monospace',
                    display: "block",
                    fontSize: isMobile ? 11 : undefined,
                  }}
                >
                  <Tooltip title={`Råværdi: ${playerLag ?? "-"}`}>
                    <span>playerLag=<b>{formatLagValue(playerLag)}</b></span>
                  </Tooltip>
                  ,{" "}
                  <Tooltip title={`Råværdi: ${manifestProgramLag ?? "-"}`}>
                    <span>manifestProgramLag=<b>{formatLagValue(manifestProgramLag)}</b></span>
                  </Tooltip>
                  ,{" "}
                  <Tooltip title={`Råværdi: ${lastSegmentLag ?? "-"}`}>
                    <span>backendLag=<b>{formatLagValue(lastSegmentLag)}</b></span>
                  </Tooltip>
                  , lagType=<b>{lagType}</b>
                </Typography>
                {!isSafari() && clientOnline !== false && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#444",
                      fontFamily: '"Courier New", Courier, monospace',
                      textAlign: "left",
                      mt: 1,
                      fontSize: isMobile ? 11 : undefined,
                    }}
                  >
                    Segment: <b>{currentSegment}</b>
                  </Typography>
                )}
                {isSafari() && clientOnline !== false && (
                  <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                    <span role="img" aria-label="advarsel" style={{ fontSize: "1.2em", marginRight: 4 }}>⚠️</span>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#b25c00",
                        fontFamily: '"Courier New", Courier, monospace',
                        fontWeight: 700,
                        fontSize: isMobile ? 11 : undefined,
                      }}
                    >
                      Safari: Segmentnummer vises ikke. Forsinkelse er kun estimeret ud fra serverens sidste segment.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Stack>
          </Grid>
        )}
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
