import React, { useEffect, useRef, useState, useMemo } from "react";
import Hls from "hls.js";
import {
  Box, Card, Typography, CircularProgress, Alert, IconButton,
  Tooltip, Grid, Stack, Divider, useMediaQuery
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useTheme, alpha } from "@mui/material/styles";
import { useAuth } from "../../auth/authcontext";
import { apiUrl } from "../../api";

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
  const ukedage = ["Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag"];
  const d = new Date(date);
  const dayName = ukedage[d.getDay()];
  const day   = d.getDate().toString().padStart(2,"0");
  const month = (d.getMonth()+1).toString().padStart(2,"0");
  const year  = d.getFullYear();
  const hour  = d.getHours().toString().padStart(2,"0");
  const min   = d.getMinutes().toString().padStart(2,"0");
  const sec   = d.getSeconds().toString().padStart(2,"0");
  return `${dayName} ${day}.${month} ${year}, kl. ${hour}:${min}:${sec}`;
}

function getLagStatus(lag) {
  if (lag == null) return { text: "Beregner forsinkelse …", color: "#888" };
  if (lag < 8)   return { text: "Live",                                             color: "#43a047" };
  if (lag < 35)  return { text: `Stream er ${Math.round(lag)} sekunder forsinket`, color: "#43a047" };
  if (lag < 70)  return { text: `Stream er ${Math.round(lag)} sekunder forsinket`, color: "#f90"    };
  return           { text: `Stream er ${Math.round(lag)} sekunder forsinket`,       color: "#e53935" };
}

function formatLagValue(val) {
  if (val == null) return "-";
  return Number(val).toFixed(1) + "s";
}

function extractSegNum(filename) {
  if (!filename) return null;
  const m = String(filename).match(/segment_(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default function ClientDetailsLivestreamSection({
  clientId,
  refreshing: parentRefreshing = false,
  onRestartStream = null,
  streamKey = null,
  clientOnline = true
}) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);

  const [serverReady, setServerReady]           = useState(false);
  const [manifestReady, setManifestReady]       = useState(false);
  const [error, setError]                       = useState("");
  const [buffering, setBuffering]               = useState(false);
  const [currentSegNum, setCurrentSegNum]       = useState(null);  // nummer på segment der afspilles nu
  const [fragDuration, setFragDuration]         = useState(8);     // segmentlængde i sekunder
  const [lastSegNum, setLastSegNum]             = useState(null);  // nyeste segment på server
  const [lastSegmentLag, setLastSegmentLag]     = useState(null);  // uploadalder på nyeste segment
  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastFetched, setLastFetched]           = useState(null);
  const [showControls, setShowControls]         = useState(false);
  const [localRefreshKey, setLocalRefreshKey]   = useState(0);
  const [refreshing, setRefreshing]             = useState(false);
  const [streamStale, setStreamStale]           = useState(false);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const effectiveRefreshKey = useMemo(() => {
    return (streamKey !== null && streamKey !== undefined) ? streamKey : localRefreshKey;
  }, [streamKey, localRefreshKey]);

  // -------------------------------------------------------------------------
  // Poll /health
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!clientId || !clientOnline) return;
    setServerReady(false);
    setStreamStale(false);
    let stop = false;

    async function pollUntilReady() {
      while (!stop) {
        try {
          const resp = await fetch(`${apiUrl}/api/hls/${clientId}/health`, {
            headers: getAuthHeaders(), signal: AbortSignal.timeout(5000)
          });
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
  // HLS.js lifecycle
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!clientId || !clientOnline || !serverReady) return;
    setManifestReady(false);
    setError("");
    setCurrentSegNum(null);
    setLastSegNum(null);

    const video = videoRef.current;
    if (!video) return;

    const token  = localStorage.getItem("token");
    const hlsUrl = token
      ? `${apiUrl}/hls/${clientId}/index.m3u8?token=${encodeURIComponent(token)}`
      : `${apiUrl}/hls/${clientId}/index.m3u8`;

    let fatalErrorTimeout = null;
    let playTimeout       = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // -----------------------------------------------------------------------
      // Safari: native HLS
      // -----------------------------------------------------------------------
      video.src = hlsUrl; video.muted = true; video.autoplay = true; video.playsInline = true;
      const onLoaded = () => {
        setManifestReady(true);
        playTimeout = setTimeout(() => video.play().catch(() => {}), 100);
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        if (playTimeout) clearTimeout(playTimeout);
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
        setManifestReady(false);
      };

    } else if (Hls.isSupported()) {
      // -----------------------------------------------------------------------
      // Chrome + Firefox: HLS.js
      //
      // CHROME FIX: korrekt initialiseringsrækkefølge:
      //   1. attachMedia(video) — binder MSE pipeline til video-elementet
      //   2. vent på MEDIA_ATTACHED event
      //   3. loadSource(url) — starter manifest-fetch
      //
      // Forkert rækkefølge (loadSource → attachMedia) giver sort skærm i Chrome
      // fordi MSE-buffere initialiseres inden video-elementet er klar.
      // -----------------------------------------------------------------------
      const hls = new Hls({
        liveSyncDurationCount:       4,   // 4 × 8s = 32s bag live-kant (lavere forsinkelse)
        liveMaxLatencyDurationCount: 6,   // 6 × 8s = 48s maks bagud
        initialLiveManifestSize:     3,
        maxBufferLength:             20,
        maxMaxBufferLength:          30,
        liveBackBufferLength:        8,
        enableWorker:                true,
        startLevel:                  -1,
        lowLatencyMode:              false,
        // xhrSetup FJERNET — ingen Authorization-header på segment-requests
        // → ingen CORS preflight OPTIONS → Firefox og Chrome virker
      });

      hlsRef.current = hls;

      // CHROME FIX: attachMedia FØRST
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        // loadSource KUN efter media er attached
        hls.loadSource(hlsUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setManifestReady(true);
        setError("");
        // play() med lille delay så React når at re-rendre
        playTimeout = setTimeout(() => video.play().catch(() => {}), 100);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError("Fatal streamfejl. Prøver automatisk at genstarte om lidt …");
          hls.destroy(); hlsRef.current = null;
          try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
          setManifestReady(false); setServerReady(false);
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
          setCurrentSegNum(data.frag.sn);
          if (data.frag.duration > 0) setFragDuration(data.frag.duration);
          setError("");
        }
      });

      video.muted = true; video.autoplay = true; video.playsInline = true;

      return () => {
        if (fatalErrorTimeout) clearTimeout(fatalErrorTimeout);
        if (playTimeout) clearTimeout(playTimeout);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
        setManifestReady(false);
      };
    }
    // eslint-disable-next-line
  }, [clientId, effectiveRefreshKey, clientOnline, serverReady]);

  // -------------------------------------------------------------------------
  // Backend polling — hvert 2s
  // Henter nyeste segmentnummer + uploadalder fra serveren.
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

            // Nyeste segmentnummer på server
            const num = extractSegNum(data.segment);
            if (num !== null) setLastSegNum(num);

            if (data.timestamp) {
              setLastSegmentTimestamp(data.timestamp);
              // uploadalder = tid siden server modtog nyeste segment
              setLastSegmentLag((Date.now() - new Date(data.timestamp).getTime()) / 1000);
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
  // Safari: poll video.seekable for forsinkelse
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!manifestReady || !isSafari() || clientOnline === false) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.seekable && video.seekable.length > 0) {
        const liveEdge = video.seekable.end(video.seekable.length - 1);
        const lag = liveEdge - video.currentTime;
        if (isFinite(lag) && lag >= 0 && lag < 600) {
          setLastSegmentLag(lag); // brug som lag-kilde for Safari
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [manifestReady, effectiveRefreshKey, clientOnline]);

  // -------------------------------------------------------------------------
  // Beregning af faktisk forsinkelse
  //
  // FORKLARING:
  //   lastSegNum    = nyeste segments nummer på server (fx 47)
  //   currentSegNum = segment der afspilles nu i spilleren (fx 42)
  //   fragDuration  = varighed pr. segment i sekunder (fra HLS.js, fx 8s)
  //   lastSegmentLag = uploadalder på nyeste segment (tid siden server modtog det, fx 3s)
  //
  //   totalLag = (47 - 42) × 8 + 3 = 43s ✓
  //
  // Dette er den eneste metode der giver præcis forsinkelse uanset browser,
  // clocksync eller EXT-X-PROGRAM-DATE-TIME i manifestet.
  //
  // Safari: bruger video.seekable.end - video.currentTime direkte.
  // -------------------------------------------------------------------------
  const computedLag = useMemo(() => {
    if (isSafari()) {
      // Safari bruger seekable-beregning sat i ovenstående interval
      return lastSegmentLag != null ? Math.round(lastSegmentLag) : null;
    }
    if (lastSegNum != null && currentSegNum != null && lastSegmentLag != null) {
      const segsBehind = lastSegNum - currentSegNum;
      const lag = segsBehind * fragDuration + lastSegmentLag;
      return lag >= 0 ? Math.round(lag) : null;
    }
    return null;
  }, [lastSegNum, currentSegNum, fragDuration, lastSegmentLag]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleRefreshClick = () => {
    if (!clientOnline) return;
    setRefreshing(true); setServerReady(false); setStreamStale(false);
    setLocalRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if      (video.requestFullscreen)       video.requestFullscreen();
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    else if (video.msRequestFullscreen)     video.msRequestFullscreen();
  };

  useEffect(() => {
    if (!showControls) return;
    const t = setTimeout(() => setShowControls(false), 2200);
    return () => clearTimeout(t);
  }, [showControls]);

  function handleVideoWaiting() { setBuffering(true);  }
  function handleVideoPlaying() { setBuffering(false); }
  function handleVideoCanPlay() { setBuffering(false); }

  const lagStatus       = getLagStatus(manifestReady ? computedLag : null);
  const disabledOverlay = clientOnline === false ? { opacity: 0.65 } : {};

  const loadingText = streamStale
    ? "Stream er gået ned — venter på genstart …"
    : !serverReady ? "Venter på at stream starter …"
    : "Forbinder til stream …";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card elevation={2} sx={{ borderRadius: 2, p: isMobile ? 1 : 2, ...disabledOverlay }}>
      <Grid container spacing={isMobile ? 1 : 2} alignItems="flex-start">

        {/* Status */}
        <Grid item xs={12} md={3} minWidth={0}>
          <Stack spacing={1}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>Stream</Typography>
              <Box sx={{
                width: isMobile ? 8 : 10, height: isMobile ? 8 : 10,
                borderRadius: "50%",
                bgcolor: clientOnline === false ? "#9e9e9e"
                  : manifestReady ? "#43a047"
                  : streamStale ? "#e53935"
                  : serverReady ? "#ff9800"
                  : "#9e9e9e",
                border: "1px solid #ddd", mr: 1,
                animation: (manifestReady && clientOnline !== false) ? "pulsate 2s infinite" : "none"
              }} />
              <Tooltip title={clientOnline === false ? "Klienten er offline" : "Genindlæs stream"}>
                <span>
                  <IconButton
                    aria-label="refresh" onClick={handleRefreshClick}
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
                : lagStatus.text}
            </Typography>

            {error && clientOnline !== false && (
              <Alert severity="error" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>{error}</Alert>
            )}
          </Stack>
        </Grid>

        {/* Video */}
        <Grid item xs={12} md={5} minWidth={0}>
          <Box
            sx={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            onMouseMove={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            tabIndex={0} onFocus={() => setShowControls(true)} onBlur={() => setShowControls(false)}
          >
            {clientOnline === false ? (
              <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: isMobile ? 100 : 160, width: "100%",
                bgcolor: "#fafafa", borderRadius: 1
              }}>
                <Typography variant="body2" sx={{ fontSize: isMobile ? 13 : undefined }}>
                  Klienten er offline — livestream deaktiveret
                </Typography>
              </Box>
            ) : (
              <Box sx={{ position: "relative", width: "100%" }}>
                {/* Video ALTID renderet og synlig — aldrig display:none.
                    Chrome's MSE pipeline kræver at video-elementet er i DOM
                    og synligt når afspilning initialiseres. */}
                <video
                  ref={videoRef}
                  id="livestream-video"
                  autoPlay playsInline muted
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
                    display: "block",
                  }}
                  tabIndex={-1}
                  key={effectiveRefreshKey}
                />

                {/* Loading overlay oven på video — erstatter display:none */}
                {!manifestReady && (
                  <Box sx={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#000", borderRadius: 8, zIndex: 5,
                  }}>
                    <CircularProgress
                      size={isMobile ? 24 : 32}
                      color={streamStale ? "error" : "inherit"}
                      sx={{ color: "#fff" }}
                    />
                    <Typography variant="body2" sx={{ color: "#fff", ml: 2, fontSize: isMobile ? 13 : undefined }}>
                      {loadingText}
                    </Typography>
                  </Box>
                )}

                {/* Buffering overlay */}
                {manifestReady && buffering && (
                  <Box sx={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 10, background: "rgba(0,0,0,0.45)", borderRadius: 8,
                  }}>
                    <CircularProgress size={isMobile ? 20 : 40} sx={{ color: "#fff" }} />
                    <Typography variant="body2" sx={{ color: "#fff", ml: isMobile ? 1 : 2, fontSize: isMobile ? 12 : undefined }}>
                      Buffering …
                    </Typography>
                  </Box>
                )}

                {/* Fullscreen */}
                {manifestReady && (
                  <IconButton
                    onClick={handleFullscreen} aria-label="Fuld skærm"
                    sx={{
                      position: "absolute", bottom: 12, right: 12,
                      bgcolor: alpha("#222", 0.6), color: "#fff", borderRadius: "50%",
                      zIndex: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.19)",
                      opacity: showControls ? 1 : 0,
                      pointerEvents: showControls ? "auto" : "none",
                      transition: "opacity 0.3s",
                      "&:hover": { bgcolor: alpha("#111", 0.85) }
                    }}
                    size={isMobile ? "small" : "medium"} tabIndex={0}
                  >
                    <FullscreenIcon sx={{ fontSize: isMobile ? 26 : 32 }} />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>
        </Grid>

        {/* Debug */}
        {(user?.role === "admin" || user?.role === "superadmin") && (
          <Grid item xs={12} md={4} minWidth={0}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: "#000", fontSize: isMobile ? 13 : undefined }}>
                Klient ID: {clientId}
              </Typography>
              {lastSegmentTimestamp && clientOnline !== false && (
                <Typography variant="body2" sx={{ color: "#000", fontSize: isMobile ? 13 : undefined }}>
                  Sidste segment: {formatDateTimeWithDay(new Date(lastSegmentTimestamp))}
                </Typography>
              )}
              {lastFetched && clientOnline !== false && (
                <Typography variant="body2" sx={{ color: "#000", fontSize: isMobile ? 13 : undefined }}>
                  Sidst kontakt: {formatDateTimeWithDay(lastFetched)}
                </Typography>
              )}
              <Divider sx={{ my: isMobile ? 0.5 : 1 }} />
              <Box sx={{ background: "#f7f7f7", borderRadius: 1, p: 1 }}>
                <Typography variant="caption" sx={{
                  color: "#111", fontFamily: '"Courier New", Courier, monospace',
                  fontWeight: 700, display: "block", mb: 0.5, fontSize: isMobile ? 11 : undefined
                }}>
                  Debug info:
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  serverReady=<b>{serverReady ? "ja" : "nej"}</b>,{" "}
                  isStale=<b>{streamStale ? "ja" : "nej"}</b>,{" "}
                  manifestReady=<b>{manifestReady ? "ja" : "nej"}</b>
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  spillerSeg=<b>{currentSegNum ?? "-"}</b>,{" "}
                  sidsteSeg=<b>{lastSegNum ?? "-"}</b>,{" "}
                  segSek=<b>{fragDuration}s</b>
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  <Tooltip title="(sidsteSeg - spillerSeg) × segSek + uploadAlder">
                    <span>totalLag=<b>{formatLagValue(computedLag)}</b></span>
                  </Tooltip>
                  {" · "}
                  <Tooltip title="Uploadalder på nyeste segment">
                    <span>uploadAlder=<b>{formatLagValue(lastSegmentLag)}</b></span>
                  </Tooltip>
                </Typography>
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
