import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Hls from "hls.js";
import {
  Box, Card, Typography, CircularProgress, Alert, IconButton,
  Tooltip, Grid, Stack, Divider, useMediaQuery, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useTheme, alpha } from "@mui/material/styles";
import { useAuth } from "../../auth/authcontext";
import { apiUrl, updateClient } from "../../api";

const HEALTH_POLL_MS = 1000;
const LAST_SEGMENT_POLL_MS = 1000;
const AUTO_RECONNECT_DELAY_MS = 2000;

// Low-latency regular HLS target. Med 2s segmenter giver det typisk 5-10s end-to-end.
const HLS_LIVE_SYNC_SECONDS = 3;
const HLS_MAX_LATENCY_SECONDS = 8;
const HLS_CATCH_UP_SEEK_SECONDS = 10;


const DISPLAY_RESOLUTION_PRESETS = [
  { value: "auto", label: "Auto-detekter skærmstørrelse", mode: "auto", width: null, height: null },
  { value: "hd_720p", label: "16:9 · HD / 720p · 1280×720", mode: "fixed", width: 1280, height: 720 },
  { value: "hd_ready", label: "16:9 · HD Ready · 1366×768", mode: "fixed", width: 1366, height: 768 },
  { value: "hd_plus", label: "16:9 · HD+ · 1600×900", mode: "fixed", width: 1600, height: 900 },
  { value: "full_hd", label: "16:9 · Full HD / 1080p · 1920×1080", mode: "fixed", width: 1920, height: 1080 },
  { value: "qhd_1440p", label: "16:9 · QHD / 1440p · 2560×1440", mode: "fixed", width: 2560, height: 1440 },
  { value: "uhd_4k", label: "16:9 · 4K UHD · 3840×2160", mode: "fixed", width: 3840, height: 2160 },
  { value: "wxga", label: "16:10 · WXGA · 1280×800", mode: "fixed", width: 1280, height: 800 },
  { value: "wuxga", label: "16:10 · WUXGA · 1920×1200", mode: "fixed", width: 1920, height: 1200 },
  { value: "wqxga", label: "16:10 · WQXGA · 2560×1600", mode: "fixed", width: 2560, height: 1600 },
  { value: "ultrawide_fhd", label: "Ultrawide · Full HD · 2560×1080", mode: "fixed", width: 2560, height: 1080 },
  { value: "ultrawide_qhd", label: "Ultrawide · QHD · 3440×1440", mode: "fixed", width: 3440, height: 1440 },
  { value: "super_ultrawide", label: "Super ultrawide · 5120×1440", mode: "fixed", width: 5120, height: 1440 },
  { value: "signage_wide", label: "Digital signage wide · 3840×1080", mode: "fixed", width: 3840, height: 1080 },
  { value: "hd_portrait", label: "Portrait · HD · 720×1280", mode: "fixed", width: 720, height: 1280 },
  { value: "hd_ready_portrait", label: "Portrait · HD Ready · 768×1366", mode: "fixed", width: 768, height: 1366 },
  { value: "full_hd_portrait", label: "Portrait · Full HD · 1080×1920", mode: "fixed", width: 1080, height: 1920 },
  { value: "qhd_portrait", label: "Portrait · QHD · 1440×2560", mode: "fixed", width: 1440, height: 2560 },
  { value: "uhd_4k_portrait", label: "Portrait · 4K · 2160×3840", mode: "fixed", width: 2160, height: 3840 },
  { value: "custom", label: "Custom · Brugerdefineret bredde/højde", mode: "fixed", width: null, height: null },
];

function getDisplayResolutionPreset(value) {
  return DISPLAY_RESOLUTION_PRESETS.find((p) => p.value === value) || DISPLAY_RESOLUTION_PRESETS[0];
}

function findPresetByDimensions(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return DISPLAY_RESOLUTION_PRESETS.find(
    (p) => p.value !== "auto" && p.value !== "custom" && p.width === w && p.height === h
  ) || null;
}

function getInitialDisplaySettingsForm(client) {
  const configuredPresetValue = client?.display_resolution_preset || "auto";
  const configuredPreset = getDisplayResolutionPreset(configuredPresetValue);

  const configuredMode = String(client?.display_resolution_mode || configuredPreset.mode || "auto").toLowerCase();
  const configuredWidth = client?.display_resolution_width ?? configuredPreset.width ?? "";
  const configuredHeight = client?.display_resolution_height ?? configuredPreset.height ?? "";

  // Hvis der allerede er gemt en fast/custom indstilling, skal dialogen åbne med den.
  if (configuredPresetValue !== "auto" || configuredMode === "fixed") {
    return {
      preset: configuredPreset.value,
      width: String(configuredWidth || ""),
      height: String(configuredHeight || ""),
      refreshRate: String(client?.display_resolution_refresh_rate ?? ""),
    };
  }

  // Hvis klienten har rapporteret en aktuel opløsning, er den mere nyttig som
  // startpunkt end "Auto", når superadmin åbner dialogen efter en auto-detektering.
  const currentWidth = client?.display_resolution_current_width;
  const currentHeight = client?.display_resolution_current_height;
  const currentPreset = findPresetByDimensions(currentWidth, currentHeight);

  if (currentPreset) {
    return {
      preset: currentPreset.value,
      width: String(currentPreset.width || ""),
      height: String(currentPreset.height || ""),
      refreshRate: String(client?.display_resolution_current_refresh_rate ?? ""),
    };
  }

  if (currentWidth && currentHeight) {
    return {
      preset: "custom",
      width: String(currentWidth),
      height: String(currentHeight),
      refreshRate: String(client?.display_resolution_current_refresh_rate ?? ""),
    };
  }

  const fallbackPreset = getDisplayResolutionPreset("full_hd");
  return {
    preset: fallbackPreset.value,
    width: String(fallbackPreset.width || ""),
    height: String(fallbackPreset.height || ""),
    refreshRate: "",
  };
}

function normalizeDisplayResolutionStatus(status) {
  return String(status || "unknown").trim().toLowerCase();
}

function formatCurrentDisplayResolution(client) {
  if (client?.display_resolution_current_width && client?.display_resolution_current_height) {
    return `${client.display_resolution_current_width}×${client.display_resolution_current_height}${
      client?.display_resolution_current_refresh_rate
        ? ` @ ${client.display_resolution_current_refresh_rate}Hz`
        : ""
    }${client?.display_resolution_current_output ? ` · ${client.display_resolution_current_output}` : ""}`;
  }
  return "Ikke rapporteret endnu";
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameOptionalNumber(a, b, tolerance = 0.01) {
  const na = parseOptionalNumber(a);
  const nb = parseOptionalNumber(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) <= tolerance;
}

function formatResolutionLabel(width, height, refreshRate = null) {
  const w = parseOptionalNumber(width);
  const h = parseOptionalNumber(height);
  if (!w || !h) return "Ukendt opløsning";
  const refresh = parseOptionalNumber(refreshRate);
  return `${w}×${h}${refresh ? ` @ ${refresh}Hz` : ""}`;
}

function getDisplayResolutionStatusMeta(status, presetValue = "auto", error = "", actionValue = null) {
  const s = normalizeDisplayResolutionStatus(status);
  const action = String(actionValue || "").trim().toLowerCase();
  const isDetect = action === "detect";
  const isAuto = presetValue === "auto";

  if (s === "pending") {
    return {
      busy: true,
      severity: "info",
      title: isDetect || isAuto
        ? "Auto-detektering er startet"
        : "Skærmændring er sendt til klienten",
      detail: isDetect || isAuto
        ? "Afventer at klienten rapporterer den aktuelle skærm."
        : "Afventer at klienten henter den nye konfiguration og rapporterer tilbage.",
      short: isDetect || isAuto ? "Auto-detektering kører" : "Skærmændring afventer klienten",
    };
  }

  if (s === "applying") {
    return {
      busy: true,
      severity: "info",
      title: "Klienten anvender skærmopløsningen",
      detail: "Klienten kører xrandr og tester den valgte opløsning.",
      short: "Klienten anvender opløsningen…",
    };
  }

  if (s === "detected") {
    return {
      busy: false,
      severity: "success",
      title: "Auto-detektering gennemført",
      detail: "Klienten har rapporteret den aktuelle skærmopløsning.",
      short: "Auto-detektering gennemført",
    };
  }

  if (s === "applied") {
    return {
      busy: false,
      severity: "success",
      title: "Skærmopløsning anvendt",
      detail: "Klienten har anvendt opløsningen og rapporteret den tilbage.",
      short: "Skærmopløsning anvendt",
    };
  }

  if (s === "error") {
    return {
      busy: false,
      severity: "error",
      title: "Skærmændring fejlede",
      detail: error || "Klienten rapporterede en fejl under skærmhåndteringen.",
      short: "Skærmændring fejlede",
    };
  }

  return {
    busy: false,
    severity: "info",
    title: "Ingen aktiv skærmproces",
    detail: "Der er ikke en aktiv auto-detektering eller skærmændring i gang.",
    short: "Ingen aktiv skærmproces",
  };
}

function getOptimisticDisplayResolutionMeta(action, isSaveOnly = false) {
  const a = String(action || "").trim().toLowerCase();

  if (a === "detect") {
    return {
      busy: true,
      severity: "info",
      title: "Auto-detektering er sendt til klienten",
      detail: "Venter på at klienten rapporterer den aktuelle skærm.",
      short: "Auto-detektering afventer klienten",
    };
  }

  if (a === "apply") {
    return {
      busy: true,
      severity: "info",
      title: isSaveOnly ? "Fast opløsning gemmes" : "Skærmændring er sendt til klienten",
      detail: isSaveOnly
        ? "Venter på at klienten bekræfter den faste opløsning."
        : "Venter på at klienten anvender den valgte opløsning.",
      short: isSaveOnly ? "Fast opløsning gemmes" : "Skærmændring afventer klienten",
    };
  }

  return null;
}

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

async function sendLivestreamCommand(clientId, action) {
  if (!clientId) throw new Error("Mangler klient-id");

  const resp = await fetch(
    `${apiUrl}/api/clients/${encodeURIComponent(clientId)}/chrome-command`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ action, source: "actionbutton" }),
      signal: AbortSignal.timeout(8000),
    }
  );

  let data = null;
  try {
    data = await resp.json();
  } catch {
    // ignore empty/non-json response
  }

  if (!resp.ok) {
    throw new Error(data?.detail || data?.message || `Kunne ikke sende ${action} (${resp.status})`);
  }

  return data;
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
  if (lag == null) {
    return { text: "Beregner forsinkelse …", color: "#888" };
  }

  const rounded = Math.round(lag);

  if (lag < 3) {
    return { text: "Live", color: "#43a047" };
  }

  if (lag < 20) {
    return { text: `Stream er ${rounded} sekunder forsinket`, color: "#43a047" };
  }

  if (lag < 30) {
    return { text: `Stream er ${rounded} sekunder forsinket`, color: "#f90" };
  }

  return { text: `Stream er ${rounded} sekunder forsinket`, color: "#e53935" };
}

function formatLagValue(val) {
  if (val == null) return "-";
  return Number(val).toFixed(2) + "s";
}

function extractSegNum(filename) {
  if (!filename) return null;
  const m = String(filename).match(/segment_(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default function ClientDetailsLivestreamSection({
  client = null,
  clientId,
  refreshing: parentRefreshing = false,
  onRestartStream = null,
  onCommandSent = null,
  onDisplayResolutionSettingsSaved = null,
  streamKey = null,
  clientOnline = true
}) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);

  const [serverReady, setServerReady]           = useState(false);
  const [manifestReady, setManifestReady]       = useState(false);
  const [error, setError]                       = useState("");
  const [buffering, setBuffering]               = useState(false);
  const [currentSegNum, setCurrentSegNum]       = useState(null);
  const [fragDuration, setFragDuration]         = useState(2);
  const [lastSegNum, setLastSegNum]             = useState(null);
  const [lastSegmentLag, setLastSegmentLag]     = useState(null);
  const [lastSegmentTimestamp, setLastSegmentTimestamp] = useState(null);
  const [lastFetched, setLastFetched]           = useState(null);
  const [showControls, setShowControls]         = useState(false);
  const [localRefreshKey, setLocalRefreshKey]   = useState(0);
  const [refreshing, setRefreshing]             = useState(false);
  const [streamStale, setStreamStale]           = useState(false);
  const [autoStartStatus, setAutoStartStatus]   = useState("");
  const [autoStartError, setAutoStartError]     = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    preset: "auto",
    width: "",
    height: "",
    refreshRate: "",
  });
  const [displayResolutionWatching, setDisplayResolutionWatching] = useState(false);
  const [displayResolutionWatchingAction, setDisplayResolutionWatchingAction] = useState(null);
  const [displayResolutionSawWorkingState, setDisplayResolutionSawWorkingState] = useState(false);
  const [displayResolutionRequestBaseline, setDisplayResolutionRequestBaseline] = useState("");

  const autoStartRequestedRef = useRef(false);
  const autoStartInFlightRef  = useRef(false);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const showDebug = isSuperadmin;

  /*
    VIGTIGT:
    Tidligere brugte komponenten ENTEN parent streamKey ELLER localRefreshKey.
    Hvis parent altid sender streamKey, havde lokal refresh og automatisk HLS-retry
    ingen effekt, fordi effectiveRefreshKey ikke ændrede sig.

    Nu kombineres begge, så både parent-refresh, manuel refresh og auto-reconnect
    tvinger HLS/health-effekterne til at starte forfra.
  */
  const effectiveRefreshKey = useMemo(() => {
    const parentKey = streamKey ?? "none";
    return `${parentKey}:${localRefreshKey}`;
  }, [streamKey, localRefreshKey]);

  const resetStreamState = useCallback(() => {
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
    }

    setServerReady(false);
    setManifestReady(false);
    setError("");
    setBuffering(false);
    setCurrentSegNum(null);
    setFragDuration(2);
    setLastSegNum(null);
    setLastSegmentLag(null);
    setLastSegmentTimestamp(null);
    setLastFetched(null);
    setStreamStale(false);
    setAutoStartError("");
  }, []);


  const ensureStreamStarted = useCallback(async (reason = "auto", { force = false } = {}) => {
    if (!clientId || clientOnline === false) return false;
    if (!force && autoStartRequestedRef.current) return false;
    if (autoStartInFlightRef.current) return false;

    autoStartRequestedRef.current = true;
    autoStartInFlightRef.current = true;
    setAutoStartError("");
    setAutoStartStatus(reason === "manual_refresh" ? "Genstarter livestream …" : "Starter livestream …");

    try {
      await sendLivestreamCommand(clientId, "livestream_start");
      if (typeof onCommandSent === "function") {
        try {
          onCommandSent({ action: "livestream_start", reason });
        } catch {
          // Ignorer callback-fejl — livestream bestillingen er allerede sendt.
        }
      }
      setAutoStartStatus("Livestream er bestilt — venter på segmenter …");
      return true;
    } catch (err) {
      autoStartRequestedRef.current = false;
      setAutoStartStatus("");
      setAutoStartError(err?.message || "Kunne ikke starte livestream.");
      return false;
    } finally {
      autoStartInFlightRef.current = false;
    }
  }, [clientId, clientOnline, onCommandSent]);

  useEffect(() => {
    autoStartRequestedRef.current = false;
    autoStartInFlightRef.current = false;
    setAutoStartStatus("");
    setAutoStartError("");
  }, [clientId]);

  const wasOnlineRef = useRef(clientOnline !== false);

  /*
    Når klienten går offline, skal gammel HLS-instans og gamle segment-data ryddes.
    Når klienten kommer online igen efter shutdown/reboot, skal streamen starte helt
    forfra automatisk uden at brugeren trykker refresh.
  */
  useEffect(() => {
    const isOnline = clientOnline !== false;
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!isOnline) {
      autoStartRequestedRef.current = false;
      resetStreamState();
      return undefined;
    }

    if (!wasOnline && isOnline) {
      autoStartRequestedRef.current = false;
      resetStreamState();
      setRefreshing(true);
      setLocalRefreshKey((k) => k + 1);
      const t = window.setTimeout(() => setRefreshing(false), 800);
      return () => window.clearTimeout(t);
    }

    return undefined;
  }, [clientOnline, resetStreamState]);

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
              if (!stop) {
                setServerReady(true);
                setStreamStale(false);
                setAutoStartStatus("");
                setAutoStartError("");
              }
              return;
            }

            if (!stop) {
              setStreamStale(data.has_segments && data.is_stale);
            }

            // Denne komponent er ansvarlig for at starte livestreamen.
            // Hvis der ikke findes aktive segmenter, bestil livestream_start én gang
            // og fortsæt derefter health-polling indtil segmenterne dukker op.
            if (!stop && clientOnline !== false && (!data.has_segments || data.is_stale)) {
              await ensureStreamStarted(data.is_stale ? "stale_stream" : "missing_segments");
            }
          }
        } catch {}
        if (!stop) await new Promise(res => setTimeout(res, HEALTH_POLL_MS));
      }
    }

    pollUntilReady();
    return () => { stop = true; };
  }, [clientId, effectiveRefreshKey, clientOnline, ensureStreamStarted]);

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

    const token = localStorage.getItem("token");
    const hlsParams = new URLSearchParams();
    hlsParams.set("_kiosk_refresh", String(effectiveRefreshKey));
    hlsParams.set("_ts", String(Date.now()));
    if (token) hlsParams.set("token", token);

    const hlsUrl = `${apiUrl}/hls/${clientId}/index.m3u8?${hlsParams.toString()}`;

    let fatalErrorTimeout = null;
    let playTimeout       = null;

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Vi bruger almindelig HLS med korte segmenter, ikke LL-HLS.
        // liveSyncDuration holder browseren tættere på live edge end den gamle 3x8s-buffer.
        liveSyncDuration:             HLS_LIVE_SYNC_SECONDS,
        liveMaxLatencyDuration:       HLS_MAX_LATENCY_SECONDS,
        initialLiveManifestSize:      1,
        maxBufferLength:              6,
        maxMaxBufferLength:           10,
        backBufferLength:             0,
        liveBackBufferLength:         0,
        maxLiveSyncPlaybackRate:      1.25,
        enableWorker:                 true,
        startLevel:                   -1,
        lowLatencyMode:               false,
        forceKeyFrameOnDiscontinuity: false,
        manifestLoadingTimeOut:       5000,
        manifestLoadingMaxRetry:      4,
        fragLoadingTimeOut:           10000,
        fragLoadingMaxRetry:          4,
      });

      hlsRef.current = hls;

      video.muted       = true;
      video.autoplay    = true;
      video.playsInline = true;

      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(hlsUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setManifestReady(true);
        setError("");
        playTimeout = setTimeout(() => video.play().catch(() => {}), 100);
      });

      hls.on(Hls.Events.LEVEL_LOADED, () => {
        // Hvis browseren driver for langt bagud, spring tættere på live edge.
        // Det holder forsinkelsen nede efter netværkshak uden at genstarte hele HLS-instansen.
        try {
          const livePos = hls.liveSyncPosition;
          if (Number.isFinite(livePos) && Number.isFinite(video.currentTime)) {
            const behind = livePos - video.currentTime;
            if (behind > HLS_CATCH_UP_SEEK_SECONDS) {
              video.currentTime = Math.max(0, livePos - 0.25);
            }
          }
        } catch {}
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError("Fatal streamfejl. Prøver automatisk at genstarte om lidt …");
          hls.destroy(); hlsRef.current = null;
          try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
          setManifestReady(false); setServerReady(false);
          if (fatalErrorTimeout) clearTimeout(fatalErrorTimeout);
          fatalErrorTimeout = setTimeout(() => setLocalRefreshKey(k => k + 1), AUTO_RECONNECT_DELAY_MS);
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
        try {
          const livePos = hls.liveSyncPosition;
          if (Number.isFinite(livePos) && Number.isFinite(video.currentTime)) {
            const behind = livePos - video.currentTime;
            if (behind > HLS_CATCH_UP_SEEK_SECONDS) {
              video.currentTime = Math.max(0, livePos - 0.25);
            }
          }
        } catch {}
      });

      return () => {
        if (fatalErrorTimeout) clearTimeout(fatalErrorTimeout);
        if (playTimeout) clearTimeout(playTimeout);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
        setManifestReady(false);
      };

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
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
    }
    // eslint-disable-next-line
  }, [clientId, effectiveRefreshKey, clientOnline, serverReady]);

  // -------------------------------------------------------------------------
  // Backend polling — hvert 2s
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
            const num = extractSegNum(data.segment);
            if (num !== null) setLastSegNum(num);
            if (data.timestamp) {
              setLastSegmentTimestamp(data.timestamp);
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
        await new Promise(res => setTimeout(res, LAST_SEGMENT_POLL_MS));
      }
    }

    pollLastSegment();
    return () => { stop = true; };
  }, [clientId, manifestReady, effectiveRefreshKey, clientOnline]);

  // -------------------------------------------------------------------------
  // Forsinkelsesberegning
  // -------------------------------------------------------------------------
  const computedLag = useMemo(() => {
    if (lastSegNum != null && currentSegNum != null && lastSegmentLag != null) {
      const segsBehind = lastSegNum - currentSegNum;
      const lag = segsBehind * fragDuration + lastSegmentLag;
      return lag >= 0 ? Math.round(lag) : null;
    }
    if (lastSegmentLag != null) {
      return Math.round(lastSegmentLag);
    }
    return null;
  }, [lastSegNum, currentSegNum, fragDuration, lastSegmentLag]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleRefreshClick = async () => {
    if (clientOnline === false) return;

    autoStartRequestedRef.current = false;
    resetStreamState();

    // Bestil/refresh selve klient-streamen og trigger derefter fuld HLS-geninitialisering.
    await ensureStreamStarted("manual_refresh", { force: true });

    // effectiveRefreshKey kombinerer parent streamKey + localRefreshKey,
    // så dette virker også når parent har sendt streamKey.
    setRefreshing(true);
    setLocalRefreshKey(k => k + 1);
    window.setTimeout(() => setRefreshing(false), 800);

    if (typeof onRestartStream === "function") {
      try { onRestartStream(); } catch {}
    }
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

  const loadingText = autoStartError
    ? autoStartError
    : autoStartStatus
      ? autoStartStatus
      : streamStale
        ? "Stream er gået ned — venter på genstart …"
        : !serverReady ? "Venter på at stream starter …"
        : "Forbinder til stream …";

  const displayResolutionStatusNorm = normalizeDisplayResolutionStatus(client?.display_resolution_status);
  const displayResolutionMeta = useMemo(
    () => getDisplayResolutionStatusMeta(
      client?.display_resolution_status,
      client?.display_resolution_preset || "auto",
      client?.display_resolution_error || "",
      client?.display_resolution_action || null
    ),
    [
      client?.display_resolution_status,
      client?.display_resolution_preset,
      client?.display_resolution_error,
      client?.display_resolution_action,
    ]
  );
  const currentDisplayReport = useMemo(
    () => formatCurrentDisplayResolution(client),
    [
      client?.display_resolution_current_width,
      client?.display_resolution_current_height,
      client?.display_resolution_current_refresh_rate,
      client?.display_resolution_current_output,
    ]
  );
  const displayResolutionBusy =
    settingsSaving || displayResolutionWatching || displayResolutionMeta.busy;

  const selectedDisplayPreset = getDisplayResolutionPreset(settingsForm.preset);
  const selectedDisplayIsAuto = selectedDisplayPreset.value === "auto";
  const selectedDisplayWidth = selectedDisplayIsAuto
    ? null
    : parseOptionalNumber(settingsForm.width);
  const selectedDisplayHeight = selectedDisplayIsAuto
    ? null
    : parseOptionalNumber(settingsForm.height);
  const selectedDisplayRefreshRate = selectedDisplayIsAuto
    ? null
    : parseOptionalNumber(settingsForm.refreshRate);

  const selectedResolutionDescription = selectedDisplayIsAuto
    ? "Auto-detekter skærmstørrelse"
    : formatResolutionLabel(selectedDisplayWidth, selectedDisplayHeight, selectedDisplayRefreshRate);

  const currentDisplayWidth = parseOptionalNumber(client?.display_resolution_current_width);
  const currentDisplayHeight = parseOptionalNumber(client?.display_resolution_current_height);
  const currentDisplayRefreshRate = parseOptionalNumber(client?.display_resolution_current_refresh_rate);

  const selectedMatchesCurrentDisplay =
    !selectedDisplayIsAuto &&
    selectedDisplayWidth === currentDisplayWidth &&
    selectedDisplayHeight === currentDisplayHeight &&
    (
      selectedDisplayRefreshRate === null ||
      currentDisplayRefreshRate === null ||
      sameOptionalNumber(selectedDisplayRefreshRate, currentDisplayRefreshRate)
    );

  const configuredDisplayPreset = client?.display_resolution_preset || "auto";
  const configuredDisplayPresetObj = getDisplayResolutionPreset(configuredDisplayPreset);
  const configuredDisplayMode = String(
    client?.display_resolution_mode || configuredDisplayPresetObj.mode || "auto"
  ).toLowerCase();
  const configuredDisplayWidth = parseOptionalNumber(
    client?.display_resolution_width ?? configuredDisplayPresetObj.width
  );
  const configuredDisplayHeight = parseOptionalNumber(
    client?.display_resolution_height ?? configuredDisplayPresetObj.height
  );
  const configuredDisplayRefreshRate = parseOptionalNumber(client?.display_resolution_refresh_rate);

  const selectedMatchesConfiguredDisplay = selectedDisplayIsAuto
    ? configuredDisplayMode === "auto" && configuredDisplayPreset === "auto"
    : configuredDisplayMode === "fixed" &&
      configuredDisplayPreset === selectedDisplayPreset.value &&
      configuredDisplayWidth === selectedDisplayWidth &&
      configuredDisplayHeight === selectedDisplayHeight &&
      sameOptionalNumber(configuredDisplayRefreshRate, selectedDisplayRefreshRate);

  const displayResolutionHasResult =
    displayResolutionStatusNorm === "detected" || displayResolutionStatusNorm === "applied";

  const selectedDisplayAlreadyActive =
    !selectedDisplayIsAuto &&
    selectedMatchesCurrentDisplay &&
    selectedMatchesConfiguredDisplay &&
    displayResolutionHasResult;

  const selectedDisplayCanBeSavedAsFixed =
    !selectedDisplayIsAuto &&
    selectedMatchesCurrentDisplay &&
    !selectedMatchesConfiguredDisplay;

  const displaySaveButtonLabel = settingsSaving
    ? "Sender…"
    : displayResolutionStatusNorm === "error"
    ? "Prøv igen"
    : selectedDisplayAlreadyActive
    ? "Allerede aktiv"
    : selectedDisplayCanBeSavedAsFixed
    ? "Gem som fast opløsning"
    : "Gem og anvend";

  const displaySaveButtonDisabled =
    settingsSaving ||
    displayResolutionMeta.busy ||
    displayResolutionWatching ||
    !clientId ||
    selectedDisplayAlreadyActive;

  const optimisticDisplayResolutionMeta = displayResolutionWatching
    ? getOptimisticDisplayResolutionMeta(displayResolutionWatchingAction, selectedDisplayCanBeSavedAsFixed)
    : null;

  const displayResolutionUiMeta = displayResolutionMeta.busy
    ? displayResolutionMeta
    : optimisticDisplayResolutionMeta || displayResolutionMeta;



  const currentDisplayDescription = currentDisplayReport;

  const openSettingsDialog = useCallback(() => {
    setSettingsForm(getInitialDisplaySettingsForm(client));
    setSettingsMessage("");
    setSettingsError("");
    setSettingsOpen(true);
  }, [client]);

  const handlePresetChange = useCallback((event) => {
    const value = event.target.value;
    const preset = getDisplayResolutionPreset(value);
    setSettingsForm((prev) => ({
      ...prev,
      preset: value,
      width: preset.width ? String(preset.width) : "",
      height: preset.height ? String(preset.height) : "",
    }));
  }, []);

  const handleAutoDetectDisplayResolution = useCallback(async () => {
    if (!clientId || settingsSaving || displayResolutionMeta.busy || displayResolutionWatching) return;

    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMessage("");

    try {
      setDisplayResolutionRequestBaseline(String(client?.display_resolution_updated_at || ""));
      await updateClient(clientId, {
        display_resolution_action: "detect",
      });

      setDisplayResolutionWatching(true);
      setDisplayResolutionWatchingAction("detect");
      setDisplayResolutionSawWorkingState(false);
      setSettingsMessage("");

      if (typeof onDisplayResolutionSettingsSaved === "function") {
        try { await onDisplayResolutionSettingsSaved(); } catch {}
      }
    } catch (err) {
      setSettingsError(err?.message || "Kunne ikke starte auto-detektering.");
    } finally {
      setSettingsSaving(false);
    }
  }, [
    clientId,
    settingsSaving,
    displayResolutionMeta.busy,
    displayResolutionWatching,
    client?.display_resolution_updated_at,
    onDisplayResolutionSettingsSaved,
  ]);

  const handleSaveLivestreamSettings = useCallback(async () => {
    if (!clientId || displaySaveButtonDisabled) return;

    const preset = selectedDisplayPreset;
    const isAuto = selectedDisplayIsAuto;
    const width = selectedDisplayWidth;
    const height = selectedDisplayHeight;
    const refreshRate = selectedDisplayRefreshRate;

    if (!isAuto && (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240)) {
      setSettingsError("Bredde og højde skal være mindst 320×240 px.");
      return;
    }
    if (refreshRate !== null && (!Number.isFinite(refreshRate) || refreshRate < 1 || refreshRate > 240)) {
      setSettingsError("Refresh rate skal være mellem 1 og 240 Hz.");
      return;
    }

    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      setDisplayResolutionRequestBaseline(String(client?.display_resolution_updated_at || ""));
      await updateClient(clientId, {
        display_resolution_preset: preset.value,
        display_resolution_mode: isAuto ? "auto" : "fixed",
        display_resolution_width: isAuto ? null : width,
        display_resolution_height: isAuto ? null : height,
        display_resolution_refresh_rate: isAuto ? null : refreshRate,
        display_resolution_rotation: "normal",
        display_resolution_action: "apply",
      });
      setDisplayResolutionWatching(true);
      setDisplayResolutionWatchingAction("apply");
      setDisplayResolutionSawWorkingState(false);
      // Statusfeltet øverst i dialogen viser nu processen.
      // Undgå ekstra dobbeltbesked under formularen.
      setSettingsMessage("");
      if (typeof onDisplayResolutionSettingsSaved === "function") {
        try { await onDisplayResolutionSettingsSaved(); } catch {}
      }
    } catch (err) {
      setSettingsError(err?.message || "Kunne ikke gemme skærmindstillinger.");
    } finally {
      setSettingsSaving(false);
    }
  }, [
    clientId,
    displaySaveButtonDisabled,
    selectedDisplayPreset,
    selectedDisplayIsAuto,
    selectedDisplayWidth,
    selectedDisplayHeight,
    selectedDisplayRefreshRate,
    selectedDisplayCanBeSavedAsFixed,
    client?.display_resolution_updated_at,
    onDisplayResolutionSettingsSaved,
  ]);

  useEffect(() => {
    const isWorkingStatus =
      displayResolutionStatusNorm === "pending" ||
      displayResolutionStatusNorm === "applying";

    const isTerminalStatus =
      displayResolutionStatusNorm === "detected" ||
      displayResolutionStatusNorm === "applied" ||
      displayResolutionStatusNorm === "error";

    if (displayResolutionWatching && isWorkingStatus && !displayResolutionSawWorkingState) {
      setDisplayResolutionSawWorkingState(true);
    }

    const statusBelongsToCurrentRequest =
      displayResolutionSawWorkingState ||
      (
        !!client?.display_resolution_updated_at &&
        String(client.display_resolution_updated_at) !== String(displayResolutionRequestBaseline || "")
      );

    if (displayResolutionWatching && isTerminalStatus && statusBelongsToCurrentRequest) {
      const shouldRefreshStream =
        displayResolutionWatchingAction === "apply" &&
        displayResolutionStatusNorm === "applied";

      if (shouldRefreshStream) {
        autoStartRequestedRef.current = false;
        resetStreamState();
        setRefreshing(true);
        setLocalRefreshKey((k) => k + 1);
        window.setTimeout(() => setRefreshing(false), 800);

        if (typeof onRestartStream === "function") {
          try { onRestartStream(); } catch {}
        }
      }

      setDisplayResolutionWatching(false);
      setDisplayResolutionWatchingAction(null);
      setDisplayResolutionSawWorkingState(false);
      return undefined;
    }

    // Poll kun mens der faktisk kører en skærmproces.
    // Tidligere blev der poll'et hvert 1,5 sek. bare fordi dialogen var åben,
    // hvilket gav unødvendige silentRefresh-loops og ekstra renders.
    const shouldPoll =
      displayResolutionWatching ||
      isWorkingStatus;

    if (!shouldPoll || typeof onDisplayResolutionSettingsSaved !== "function") {
      return undefined;
    }

    let stopped = false;

    const refreshDisplayResolutionStatus = async () => {
      try {
        await onDisplayResolutionSettingsSaved();
      } catch {
        // Parent refresh-fejl skal ikke lukke dialogen eller vise falsk status.
      }
    };

    refreshDisplayResolutionStatus();
    const timer = window.setInterval(() => {
      if (!stopped) refreshDisplayResolutionStatus();
    }, 1500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    displayResolutionWatching,
    displayResolutionWatchingAction,
    displayResolutionSawWorkingState,
    displayResolutionStatusNorm,
    displayResolutionRequestBaseline,
    client?.display_resolution_updated_at,
    onDisplayResolutionSettingsSaved,
    onRestartStream,
    resetStreamState,
  ]);

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

            {isSuperadmin && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Skærm: {currentDisplayDescription}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: displayResolutionUiMeta.severity === "error"
                      ? "error.main"
                      : displayResolutionUiMeta.busy
                      ? "info.main"
                      : "text.secondary",
                  }}
                >
                  {displayResolutionBusy ? "Proces: " : "Seneste status: "}
                  {displayResolutionUiMeta.short}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={openSettingsDialog}
                  disabled={!clientId}
                  sx={{ textTransform: "none" }}
                >
                  Skærmindstillinger
                </Button>
              </Box>
            )}

            {(error || autoStartError) && clientOnline !== false && (
              <Alert severity="error" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>
                {error || autoStartError}
              </Alert>
            )}
          </Stack>
        </Grid>

        {/* Video */}
        <Grid item xs={12} md={showDebug ? 5 : 9} minWidth={0}>
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
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  maxWidth: "100%",
                  aspectRatio: "16 / 9",
                  maxHeight: isMobile ? 220 : showDebug ? 320 : 460,
                  bgcolor: "#000",
                  borderRadius: 1,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <video
                  ref={videoRef}
                  id="livestream-video"
                  autoPlay playsInline muted
                  onWaiting={handleVideoWaiting}
                  onPlaying={handleVideoPlaying}
                  onCanPlay={handleVideoCanPlay}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: 8,
                    border: "2px solid #444",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.19)",
                    background: "#000",
                    display: "block",
                  }}
                  tabIndex={-1}
                  key={effectiveRefreshKey}
                />

                {/* Loading overlay */}
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
        {showDebug && (
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
                  autoStart=<b>{autoStartStatus ? "ja" : "nej"}</b>,{" "}
                  manifestReady=<b>{manifestReady ? "ja" : "nej"}</b>
                </Typography>
                <Typography variant="caption" sx={{
                  color: "#222", fontFamily: '"Courier New", Courier, monospace',
                  display: "block", fontSize: isMobile ? 11 : undefined
                }}>
                  spillerSeg=<b>{currentSegNum ?? "-"}</b>,{" "}
                  sidsteSeg=<b>{lastSegNum ?? "-"}</b>,{" "}
                  segSek=<b>{Number(fragDuration).toFixed(2)}s</b>
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


      <Dialog open={settingsOpen} onClose={() => !settingsSaving && setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Skærmindstillinger</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert
              severity={displayResolutionUiMeta.severity}
              icon={displayResolutionUiMeta.busy || settingsSaving ? <CircularProgress size={16} /> : undefined}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {settingsSaving ? "Sender skærmhandling…" : displayResolutionUiMeta.title}
              </Typography>
              <Typography variant="body2">
                {settingsSaving ? "Sender handlingen til backend." : displayResolutionUiMeta.detail}
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                Aktuel rapporteret skærm: {currentDisplayReport}
              </Typography>
              {client?.display_resolution_error && displayResolutionStatusNorm === "error" && (
                <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                  Fejl: {client.display_resolution_error}
                </Typography>
              )}
            </Alert>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button
                variant="outlined"
                color="info"
                onClick={handleAutoDetectDisplayResolution}
                disabled={displayResolutionBusy || !clientId}
              >
                {settingsSaving && displayResolutionWatchingAction === "detect" ? (
                  <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                ) : null}
                Auto-detekter aktuel skærm
              </Button>
              <Typography variant="caption" color="text.secondary">
                Læser kun aktuel skærm — ændrer og gemmer ikke skærmindstillingen.
              </Typography>
            </Box>

            <TextField
              select
              label="Vælg opløsning der skal anvendes"
              value={settingsForm.preset}
              onChange={handlePresetChange}
              fullWidth
              size="small"
            >
              {DISPLAY_RESOLUTION_PRESETS.filter((preset) => preset.value !== "auto").map((preset) => (
                <MenuItem key={preset.value} value={preset.value}>{preset.label}</MenuItem>
              ))}
            </TextField>

            {settingsForm.preset !== "auto" && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Bredde"
                    type="number"
                    size="small"
                    fullWidth
                    value={settingsForm.width}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, width: e.target.value }))}
                    disabled={settingsForm.preset !== "custom"}
                    inputProps={{ min: 320, max: 8192 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Højde"
                    type="number"
                    size="small"
                    fullWidth
                    value={settingsForm.height}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, height: e.target.value }))}
                    disabled={settingsForm.preset !== "custom"}
                    inputProps={{ min: 320, max: 8192 }}
                  />
                </Grid>
              </Grid>
            )}

            {settingsForm.preset !== "auto" && (
              <TextField
                label="Refresh rate (valgfri)"
                type="number"
                size="small"
                fullWidth
                value={settingsForm.refreshRate}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, refreshRate: e.target.value }))}
                inputProps={{ min: 1, max: 240, step: "0.01" }}
                helperText="Lad feltet være tomt for at bruge skærmens standard-refresh rate"
              />
            )}

            {!selectedDisplayIsAuto && selectedDisplayAlreadyActive && (
              <Alert severity="success">
                Den valgte opløsning ({selectedResolutionDescription}) er allerede valgt og aktiv på klienten.
              </Alert>
            )}

            {!selectedDisplayIsAuto && selectedDisplayCanBeSavedAsFixed && (
              <Alert severity="info">
                Den valgte opløsning ({selectedResolutionDescription}) matcher den aktuelle skærm.
                Knappen gemmer den som fast opløsning, så klienten bruger den fremover.
              </Alert>
            )}

            {!selectedDisplayIsAuto && !selectedDisplayAlreadyActive && !selectedDisplayCanBeSavedAsFixed && (
              <Alert severity="warning">
                Tryk “Gem og anvend” for at ændre klientens fysiske skærm til {selectedResolutionDescription}.
              </Alert>
            )}

            {settingsError && <Alert severity="error">{settingsError}</Alert>}
            {settingsMessage && <Alert severity="info">{settingsMessage}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)} disabled={settingsSaving}>
            {displayResolutionBusy ? "Luk — processen fortsætter" : "Luk"}
          </Button>
          <Button onClick={handleSaveLivestreamSettings} variant="contained" disabled={displaySaveButtonDisabled}>
            {settingsSaving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
            {displaySaveButtonLabel}
          </Button>
        </DialogActions>
      </Dialog>

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
