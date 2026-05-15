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
import { apiUrl } from "../../api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithRetry(url, options = {}, maxAttempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options.headers || {}) },
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok || attempt === maxAttempts) return resp;
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 8000);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastError || new Error("All retry attempts failed");
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function formatDateTimeWithDay(date) {
  if (!date) return "";
  const ukedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const d = new Date(date);
  const dayName = ukedage[d.getDay()];
  const day     = d.getDate().toString().padStart(2, "0");
  const month   = (d.getMonth() + 1).toString().padStart(2, "0");
  const year    = d.getFullYear();
  const hour    = d.getHours().toString().padStart(2, "0");
  const min     = d.getMinutes().toString().padStart(2, "0");
  const sec     = d.getSeconds().toString().padStart(2, "0");
  return `${dayName} ${day}.${month} ${year}, kl. ${hour}:${min}:${sec}`;
}

function getLagStatus(lag) {
  if (lag == null) return { text: "", color: "#888" };
  if (lag < 8)   return { text: "Live",                                                        color: "#43a047" };
  if (lag < 20)  return { text: `Stream er ${Math.round(lag)} sekunder forsinket`,             color: "#43a047" };
  if (lag < 60)  return { text: `Stream er ${Math.round(lag)} sekunder forsinket`,             color: "#f90" };
  return           { text: `Stream er ${Math.round(lag)} sekunder forsinket`,                  color: "#e53935" };
}

function formatLagValue(val) {
  if (val == null) return "-";
  return Number(val).toFixed(1) + "s";
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------
export default function ClientDetailsLivestreamSection({
  clientId,
  refreshing: parentRefreshing = false,
  onRestartStream = null,
  streamKey = null,
  clientOnline = true
}) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);

  const [serverReady, setServerReady]               = useState(false);
  const [manifestReady, setManifestReady]           = useState(false);
  const [error, setError]                           = useState("");
  const [buffering, setBuffering]                   = useState(false);
  const [currentSegment, setCurrentSegment]         = useState("-");
  const [lastFetched, setLastFetched]               = useState(null);
  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastSegmentLag, setLastSegmentLag]         = useState(null);
  const [playerLag, setPlayerLag]                   = useState(null);   // HLS.js latency (Chrome/Firefox)
  const [safariLag, setSafariLag]                   = useState(null);   // video.duration - video.currentTime (Safari)
  const [showControls, setShowControls]             = useState(false);
  const [localRefreshKey, setLocalRefreshKey]       = useState(0);
  const [refreshing, setRefreshing]                 = useState(false);
  const [streamStale, setStreamStale]               = useState(false);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const effectiveRefreshKey = useMemo(() => {
    return (streamKey !== null && streamKey !== undefined) ? streamKey : localRefreshKey;
  }, [streamKey, localRefreshKey]);

  // -------------------------------------------------------------------------
  // Poll /health indtil serveren har friske segmenter klar
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!clientId || !clientOnline) return;
    setServerReady(false);
    setStreamStale(false);
    let stop = false;

    async function pollUntilReady() {
      while (!stop) {
        try {
          const resp = await fetch(
            `${apiUrl}/api/hls/${clientId}/health`,
            { headers: getAuthHeaders(), signal: AbortSignal.timeout(5000) }
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data.has_segments && !data.is_stale) {
              if (!stop) { setServerReady(true); setStreamStale(false); }
              return;
            }
            if (!stop) setStreamStale(data.has_segments && data.is_stale);
          }
        } catch {}
        if (!stop) await new Promise(res => setTimeout(res, 2000));
      }
    }

    pollUntilReady();
    return () => { stop = true; };
  }, [clientId, effectiveRefreshKey, clientOnline]);

  // -------------------------------------------------------------------------
  // HLS.js lifecycle — starter kun når serverReady er true
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!clientId || !clientOnline || !serverReady) return;
    setManifestReady(false);
    setError("");
    setPlayerLag(null);
    setSafariLag(null);

    const video = videoRef.current;
    if (!video) return;

    const token  = localStorage.getItem("token");

    // Token sendes som query-parameter i manifest-URL'en.
    // Segmenter hentes af StaticFiles som ikke kræver auth.
    // Vi bruger IKKE xhrSetup/Authorization-header da det trigger
    // CORS preflight i Firefox og Chrome — StaticFiles blokerer OPTIONS.
    const hlsUrl = token
      ? `${apiUrl}/hls/${clientId}/index.m3u8?token=${encodeURIComponent(token)}`
      : `${apiUrl}/hls/${clientId}/index.m3u8`;

    let fatalErrorTimeout = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // -----------------------------------------------------------------------
      // Safari: native HLS — ingen HLS.js, ingen CORS-problemer
      // -----------------------------------------------------------------------
      video.src         = hlsUrl;
      video.muted       = true;
      video.autoplay    = true;
      video.playsInline = true;

      const onLoaded = () => {
        setManifestReady(true);
        video.play().catch(() => {});
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });

      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
        setManifestReady(false);
      };

    } else if (Hls.isSupported()) {
      // -----------------------------------------------------------------------
      // HLS.js: Chrome + Firefox
      //
      // VIGTIGT: xhrSetup er FJERNET.
      // Authorization-header triggererede CORS preflight OPTIONS på segment-
      // requests. StaticFiles håndterer ikke OPTIONS → 405 → segmenter blokeret
      // i Firefox og Chrome. Token er i manifest-URL'en som query-param — det
      // er nok. Segmenter kræver ikke auth (de serves af StaticFiles direkte).
      // -----------------------------------------------------------------------
      const hls = new Hls({
        liveSyncDurationCount:       7,   // 7 × 6s = 42s bag live-kant
        liveMaxLatencyDurationCount: 10,  // 10 × 6s = 60s maks bagud
        initialLiveManifestSize:     4,   // vent på 4 segmenter inden start
        maxBufferLength:             20,
        maxMaxBufferLength:          30,
        liveBackBufferLength:        6,
        enableWorker:                true,
        startLevel:                  -1,
        lowLatencyMode:              false,
        // xhrSetup FJERNET — eliminerer CORS preflight på segment-requests
      });

      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setManifestReady(true);
        setError("");
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError("Fatal streamfejl. Prøver automatisk at genstarte om lidt …");
          hls.destroy();
          hlsRef.current = null;
          try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
          setManifestReady(false);
          setServerReady(false);
          if (fatalErrorTimeout) clearTimeout(fatalErrorTimeout);
          fatalErrorTimeout = setTimeout(() => setLocalRefreshKey(k => k + 1), 3000);
        } else {
          if (data.details === "bufferStalledError") return;
          console.warn("[HLS Error]", data.details);
          setError(data.details || "Ukendt HLS-fejl");
          setTimeout(() => setError(""), 5000);
        }
      });

      hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
        if (data?.frag && typeof data.frag.sn === "number") {
          setCurrentSegment(data.frag.sn);
          setError("");
        }
      });

      video.muted       = true;
      video.autoplay    = true;
      video.playsInline = true;

      return () => {
        if (fatalErrorTimeout) clearTimeout(fatalErrorTimeout);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
        setManifestReady(false);
      };
    }
    // eslint-disable-next-line
  }, [clientId, effectiveRefreshKey, clientOnline, serverReady]);

  // -------------------------------------------------------------------------
  // Manuel refresh
  // -------------------------------------------------------------------------
  const handleRefreshClick = () => {
    if (!clientOnline) return;
    setRefreshing(true);
    setServerReady(false);
    setStreamStale(false);
    setLocalRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  };

  // -------------------------------------------------------------------------
  // Fullscreen
  // -------------------------------------------------------------------------
  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if      (video.requestFullscreen)       video.requestFullscreen();
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    else if (video.msRequestFullscreen)     video.msRequestFullscreen();
  };

  // -------------------------------------------------------------------------
  // Controls auto-hide
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!showControls) return;
    const t = setTimeout(() => setShowControls(false), 2200);
    return () => clearTimeout(t);
  }, [showControls]);

  // -------------------------------------------------------------------------
  // Video events
  // -------------------------------------------------------------------------
  const handleMouseMove   = () => setShowControls(true);
  function handleVideoWaiting() { setBuffering(true);  }
  function handleVideoPlaying() { setBuffering(false); }
  function handleVideoCanPlay() { setBuffering(false); }

  // -------------------------------------------------------------------------
  // HLS.js player lag — Chrome + Firefox
  // hls.latency = spillerens faktiske forsinkelse bag live-kanten.
  // Dette er den korrekte forsinkelsesmåling for HLS.js-browsere.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!manifestReady || isSafari() || clientOnline === false) return;
    const interval = setInterval(() => {
      const hls = hlsRef.current;
      if (hls && typeof hls.latency === "number" && isFinite(hls.latency)) {
        setPlayerLag(Math.max(0, hls.latency));
      } else if (hls && typeof hls.playbackLatency === "number" && isFinite(hls.playbackLatency)) {
        setPlayerLag(Math.max(0, hls.playbackLatency));
      } else {
        setPlayerLag(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [manifestReady, effectiveRefreshKey, clientOnline]);

  // -------------------------------------------------------------------------
  // Safari lag — video.duration - video.currentTime
  // Safari bruger native HLS — ingen HLS.js latency tilgængelig.
  // video.duration = live-kanten i sekunder fra start.
  // video.currentTime = spillerens position.
  // Differensen = faktisk forsinkelse bag live-kanten.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!manifestReady || !isSafari() || clientOnline === false) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && isFinite(video.duration) && video.duration > 0 && video.currentTime > 0) {
        const lag = video.duration - video.currentTime;
        setSafariLag(lag > 0 ? lag : null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [manifestReady, effectiveRefreshKey, clientOnline]);

  // -------------------------------------------------------------------------
  // Backend lag polling — hvert 2s
  // Bruges KUN til debug-info — ikke til forsinkelsesvisning.
  // lastSegmentLag = tid siden server modtog seneste segment (~2-6s).
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!clientId || !manifestReady || clientOnline === false) return;
    let stop = false;

    async function pollLastSegment() {
      while (!stop) {
        try {
          const resp = await fetchWithRetry(
            `${apiUrl}/api/hls/${clientId}/last-segment-info?nocache=${Date.now()}`,
            { credentials: "include" }
          );
          if (resp.ok) {
            const data = await resp.json();
            setLastFetched(new Date());
            if (data.timestamp) {
              setLastSegmentTimestamp(data.timestamp);
              const segTime = new Date(data.timestamp).getTime();
              setLastSegmentLag((Date.now() - segTime) / 1000);
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

    pollLastSegment();
    return () => { stop = true; };
  }, [clientId, manifestReady, effectiveRefreshKey, clientOnline]);

  // -------------------------------------------------------------------------
  // Afledte værdier
  //
  // Forsinkelsesvisning:
  //   Chrome/Firefox → playerLag (hls.latency) = faktisk spillerforsinkelse
  //   Safari         → safariLag (video.duration - video.currentTime)
  //   Fallback       → lastSegmentLag (kun upload-alder, unøjagtig)
  //
  // lastSegmentLag vises KUN i debug-panelet — ikke i status-teksten.
  // -------------------------------------------------------------------------
  const lagToShow = isSafari()
    ? (safariLag ?? lastSegmentLag)
    : (playerLag ?? lastSegmentLag);

  const lagType = isSafari()
    ? (safariLag != null ? "safari-video" : "backend")
    : (playerLag != null ? "player" : "backend");

  const sanitizedLag = lagToShow != null && lagToShow < 0 ? 0 : lagToShow;
  const lagStatus    = getLagStatus(sanitizedLag);
  const disabledOverlay = clientOnline === false ? { opacity: 0.65 } : {};

  const loadingText = streamStale
    ? "Stream er gået ned — venter på genstart …"
    : !serverReady
      ? "Venter på at stream starter …"
      : "Forbinder til stream …";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card elevation={2} sx={{ borderRadius: 2, p: isMobile ? 1 : 2, ...disabledOverlay }}>
      <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-start">

        {/* --- Status kolonne --- */}
        <Grid item xs={12} md={3} minWidth={0}>
          <Stack spacing={1}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>Stream</Typography>
              <Box sx={{
                width: isMobile ? 8 : 10,
                height: isMobile ? 8 : 10,
                borderRadius: "50%",
                bgcolor: clientOnline === false
                  ? "#9e9e9e"
                  : manifestReady
                    ? "#43a047"
                    : streamStale
                      ? "#e53935"
                      : serverReady
                        ? "#ff9800"
                        : "#9e9e9e",
                border: "1px solid #ddd",
                mr: 1,
                animation: (manifestReady && clientOnline !== false) ? "pulsate 2s infinite" : "none"
              }} />
              <Tooltip title={clientOnline === false ? "Klienten er offline" : "Genindlæs stream"}>
                <span>
                  <IconButton
                    aria-label="refresh"
                    onClick={handleRefreshClick}
                    size={isMobile ? "small" : "medium"}
                    disabled={refreshing || !clientId || clientOnline === false}
                  >
                    {(refreshing && clientOnline !== false)
                      ? <CircularProgress size={isMobile ? 20 : 18} color="inherit" />
                      : <RefreshIcon sx={{ fontSize: isMobile ? 26 : undefined }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <Typography variant="body2" sx={{ color: lagStatus.color, fontSize: isMobile ? 13 : undefined }}>
              {clientOnline === false
                ? "Klienten er offline — stream ikke tilgængelig"
                : (lagStatus.text || "Ingen status")}
            </Typography>

            <Box>
              {error && clientOnline !== false && (
                <Alert severity="error" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>
                  {error}
                </Alert>
              )}
            </Box>
          </Stack>
        </Grid>

        {/* --- Video kolonne --- */}
        <Grid item xs={12} md={5} minWidth={0}>
          <Box
            sx={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            onMouseMove={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            tabIndex={0}
            onFocus={() => setShowControls(true)}
            onBlur={() => setShowControls(false)}
          >
            <Box sx={{
              position: "relative",
              width: "100%",
              display: (manifestReady && clientOnline !== false) ? "flex" : "none",
              alignItems: "center",
              justifyContent: "center"
            }}>
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
                key={effectiveRefreshKey}
              />

              {manifestReady && clientOnline !== false && (
                <IconButton
                  onClick={handleFullscreen}
                  aria-label="Fuld skærm"
                  sx={{
                    position: "absolute",
                    bottom: 12, right: 12,
                    bgcolor: alpha("#222", 0.6),
                    color: "#fff",
                    borderRadius: "50%",
                    zIndex: 20,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.19)",
                    opacity: showControls ? 1 : 0,
                    pointerEvents: showControls ? "auto" : "none",
                    transition: "opacity 0.3s",
                    "&:hover": { bgcolor: alpha("#111", 0.85) }
                  }}
                  size={isMobile ? "small" : "medium"}
                  tabIndex={0}
                >
                  <FullscreenIcon sx={{ fontSize: isMobile ? 26 : 32 }} />
                </IconButton>
              )}

              {buffering && (
                <Box sx={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 10, background: "rgba(0,0,0,0.18)", borderRadius: 8,
                }}>
                  <CircularProgress size={isMobile ? 20 : 40} color="inherit" />
                  <Typography variant="body2" sx={{ color: "#fff", ml: isMobile ? 1 : 2, fontSize: isMobile ? 12 : undefined }}>
                    Buffering …
                  </Typography>
                </Box>
              )}
            </Box>

            {(!manifestReady || clientOnline === false) && (
              <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: isMobile ? 100 : 160,
                width: "100%",
                bgcolor: clientOnline === false ? "#fafafa" : "transparent",
                borderRadius: 1
              }}>
                {clientOnline === false ? (
                  <Typography variant="body2" sx={{ fontSize: isMobile ? 13 : undefined }}>
                    Klienten er offline — livestream deaktiveret
                  </Typography>
                ) : (
                  <>
                    <CircularProgress size={isMobile ? 24 : 32} color={streamStale ? "error" : "inherit"} />
                    <Typography variant="body2" sx={{
                      ml: 2, fontSize: isMobile ? 13 : undefined,
                      color: streamStale ? "#e53935" : undefined
                    }}>
                      {loadingText}
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Grid>

        {/* --- Debug kolonne (kun admin/superadmin) --- */}
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <Grid item xs={12} md={4} minWidth={0}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : undefined }}>
                Klient ID: {clientId}
              </Typography>
              {lastSegmentTimestamp && clientOnline !== false && (
                <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : undefined }}>
                  Sidste segment: {formatDateTimeWithDay(new Date(lastSegmentTimestamp))}
                </Typography>
              )}
              {lastFetched && clientOnline !== false && (
                <Typography variant="body2" sx={{ color: "#000", textAlign: "left", fontSize: isMobile ? 13 : undefined }}>
                  Sidst kontakt: {formatDateTimeWithDay(lastFetched)}
                </Typography>
              )}
              <Divider sx={{ my: isMobile ? 0.5 : 1 }} />
              <Box sx={{ background: "#f7f7f7", borderRadius: 1, p: 1, mt: 1, mb: 1 }}>
                <Typography variant="caption" sx={{
                  color: "#111", fontFamily: '"Courier New", Courier, monospace',
                  fontWeight: 700, letterSpacing: 0.2, display: "block", mb: 0.5,
                  fontSize: isMobile ? 11 : undefined
                }}>
                  Debug info:
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  serverReady=<b>{serverReady ? "ja" : "nej"}</b>,{" "}
                  isStale=<b>{streamStale ? "ja" : "nej"}</b>
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  <Tooltip title="HLS.js hls.latency (Chrome/Firefox)">
                    <span>playerLag=<b>{formatLagValue(playerLag)}</b></span>
                  </Tooltip>
                  {" "}
                  <Tooltip title="video.duration - video.currentTime (Safari)">
                    <span>safariLag=<b>{formatLagValue(safariLag)}</b></span>
                  </Tooltip>
                  {" "}
                  <Tooltip title="Tid siden server modtog seneste segment (upload-alder)">
                    <span>backendLag=<b>{formatLagValue(lastSegmentLag)}</b></span>
                  </Tooltip>
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  lagType=<b>{lagType}</b>, vist=<b>{formatLagValue(sanitizedLag)}</b>
                </Typography>
                {clientOnline !== false && (
                  <Typography variant="caption" sx={{
                    color: "#444", fontFamily: '"Courier New", Courier, monospace',
                    display: "block", mt: 0.5, fontSize: isMobile ? 11 : undefined
                  }}>
                    Segment: <b>{currentSegment}</b>
                  </Typography>
                )}
              </Box>
            </Stack>
          </Grid>
        )}
      </Grid>

      <style>{`
        @keyframes pulsate {
          0%   { transform: scale(1);    opacity: 1;   background: #43a047; }
          50%  { transform: scale(1.25); opacity: 0.5; background: #43a047; }
          100% { transform: scale(1);    opacity: 1;   background: #43a047; }
        }
      `}</style>
    </Card>
  );
}
