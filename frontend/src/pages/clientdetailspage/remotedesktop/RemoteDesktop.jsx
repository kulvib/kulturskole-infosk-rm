import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import MouseIcon from "@mui/icons-material/Mouse";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { apiUrl, getClient } from "../../../api";

function getAuthToken() {
  return localStorage.getItem("token") || "";
}

function getWsBaseUrl() {
  if (apiUrl.startsWith("https://")) return `wss://${apiUrl.slice("https://".length)}`;
  if (apiUrl.startsWith("http://")) return `ws://${apiUrl.slice("http://".length)}`;
  return apiUrl;
}

function getRemoteDesktopWsUrl(clientId) {
  const token = getAuthToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${getWsBaseUrl()}/api/remote-desktop/browser/${encodeURIComponent(clientId)}/ws${qs}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function RemoteDesktop() {
  const { clientId } = useParams();

  const [client, setClient] = useState(null);

  const wsRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const mouseDownRef = useRef(false);
  const lastMouseMoveSentRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("Ikke forbundet");
  const [error, setError] = useState("");
  const [frameSrc, setFrameSrc] = useState("");
  const [screenSize, setScreenSize] = useState({ width: null, height: null });
  const [lastFrameTs, setLastFrameTs] = useState(null);
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [shoutText, setShoutText] = useState("");

  const canControl = connected && agentConnected && sessionId;

  useEffect(() => {
    let cancelled = false;

    async function loadClient() {
      if (!clientId) return;
      try {
        const data = await getClient(clientId);
        if (!cancelled) setClient(data || null);
      } catch {
        if (!cancelled) setClient(null);
      }
    }

    loadClient();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const startStream = useCallback(() => {
    send({ type: "start_stream" });
  }, [send]);

  const stopStream = useCallback(() => {
    send({ type: "stop_stream" });
  }, [send]);

  const connect = useCallback(() => {
    if (!clientId) return;

    try {
      if (wsRef.current) {
        wsRef.current.close();
      }
    } catch {}

    setError("");
    setStatus("Forbinder...");
    setConnected(false);
    setAgentConnected(false);

    const ws = new WebSocket(getRemoteDesktopWsUrl(clientId));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setStatus("Browser forbundet");
    };

    ws.onclose = (event) => {
      setConnected(false);
      setAgentConnected(false);
      setStatus(`Forbindelse lukket${event.reason ? `: ${event.reason}` : ""}`);
    };

    ws.onerror = () => {
      setError("WebSocket-fejl");
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "hello") {
        setSessionId(msg.session_id);
        setAgentConnected(!!msg.agent_connected);
        if (msg.width && msg.height) {
          setScreenSize({ width: msg.width, height: msg.height });
        }
        setStatus(msg.agent_connected ? "Remote desktop klar" : "Venter på klient-agent");
        if (msg.agent_connected) {
          setTimeout(() => send({ type: "start_stream" }), 200);
        }
        return;
      }

      if (msg.type === "agent_status") {
        setAgentConnected(!!msg.agent_connected);
        if (msg.width && msg.height) {
          setScreenSize({ width: msg.width, height: msg.height });
        }
        setStatus(msg.agent_connected ? "Klient-agent forbundet" : "Klient-agent ikke forbundet");
        if (msg.agent_connected) {
          setTimeout(() => send({ type: "start_stream" }), 200);
        }
        return;
      }

      if (msg.type === "stream_started") {
        setScreenSize({ width: msg.width, height: msg.height });
        setStatus(`Stream startet ${msg.width}x${msg.height}@${msg.fps || "?"}fps`);
        return;
      }

      if (msg.type === "frame") {
        setFrameSrc(`data:image/jpeg;base64,${msg.data}`);
        if (msg.width && msg.height) {
          setScreenSize({ width: msg.width, height: msg.height });
        }
        setLastFrameTs(Date.now());
        return;
      }

      if (msg.type === "status") {
        setStatus(msg.message || "Status");
        return;
      }

      if (msg.type === "remote_error" || msg.type === "error") {
        setError(msg.message || "Ukendt fejl");
        return;
      }
    };
  }, [clientId, send]);

  useEffect(() => {
    connect();
    return () => {
      try {
        wsRef.current?.send(JSON.stringify({ type: "stop_stream" }));
        wsRef.current?.close();
      } catch {}
    };
  }, [connect]);

  const frameAgeText = useMemo(() => {
    if (!lastFrameTs) return "";
    const sec = Math.max(0, Math.round((Date.now() - lastFrameTs) / 1000));
    return sec <= 1 ? "seneste frame nu" : `seneste frame ${sec}s siden`;
  }, [lastFrameTs]);

  const getRemoteCoordinates = useCallback((event) => {
    const img = imgRef.current;
    if (!img || !screenSize.width || !screenSize.height) return null;

    const rect = img.getBoundingClientRect();
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    return {
      x: Math.round(px * screenSize.width),
      y: Math.round(py * screenSize.height),
    };
  }, [screenSize]);

  const focusRemoteDesktop = useCallback(() => {
    try {
      containerRef.current?.focus();
    } catch {}
  }, []);

  const sendMouseEvent = useCallback((event, action, extra = {}) => {
    if (!canControl) return;
    const pos = getRemoteCoordinates(event);
    if (!pos) return;

    send({
      type: "mouse",
      action,
      ...pos,
      ...extra,
    });
  }, [canControl, getRemoteCoordinates, send]);

  const handleMouseDown = useCallback((event) => {
    if (!canControl) return;
    event.preventDefault();
    event.stopPropagation();
    focusRemoteDesktop();

    const button = event.button === 2 ? 3 : 1;
    mouseDownRef.current = button === 1;

    sendMouseEvent(event, "down", { button });
  }, [canControl, focusRemoteDesktop, sendMouseEvent]);

  const handleMouseUp = useCallback((event) => {
    if (!canControl) return;
    event.preventDefault();
    event.stopPropagation();

    const button = event.button === 2 ? 3 : 1;
    sendMouseEvent(event, "up", { button });

    if (button === 1) {
      mouseDownRef.current = false;
    }
  }, [canControl, sendMouseEvent]);

  const handleDoubleClick = useCallback((event) => {
    if (!canControl) return;
    event.preventDefault();
    event.stopPropagation();
    sendMouseEvent(event, "double_click");
  }, [canControl, sendMouseEvent]);

  const handleContextMenu = useCallback((event) => {
    event.preventDefault();
    if (!canControl) return;
    event.stopPropagation();
    sendMouseEvent(event, "right_click");
  }, [canControl, sendMouseEvent]);

  const handleMouseMove = useCallback((event) => {
    if (!canControl) return;
    const pos = getRemoteCoordinates(event);
    if (!pos) return;

    const now = Date.now();
    const throttleMs = mouseDownRef.current ? 25 : 80;
    if (now - lastMouseMoveSentRef.current < throttleMs) return;
    lastMouseMoveSentRef.current = now;

    send({
      type: "mouse",
      action: "move",
      ...pos,
      dragging: mouseDownRef.current,
    });
  }, [canControl, getRemoteCoordinates, send]);

  const handleMouseLeave = useCallback((event) => {
    if (!canControl) return;
    if (!mouseDownRef.current) return;

    // Hvis musen forlader billedet mens venstre knap er nede, slipper vi den
    // på klienten, så et vindue ikke bliver ved med at hænge fast.
    sendMouseEvent(event, "up", { button: 1 });
    mouseDownRef.current = false;
  }, [canControl, sendMouseEvent]);

  const handleWheel = useCallback((event) => {
    if (!canControl) return;
    event.preventDefault();
    send({
      type: "mouse",
      action: "scroll",
      delta: event.deltaY < 0 ? 3 : -3,
    });
  }, [canControl, send]);

  const sendKey = useCallback((key) => {
    send({ type: "key", key });
  }, [send]);

  const sendShout = useCallback(() => {
    const message = shoutText.trim();
    if (!message) return;

    const ok = send({
      type: "shout",
      text: message,
      duration: 8,
    });

    if (!ok) {
      setError("Shout out kunne ikke sendes: WebSocket er ikke forbundet.");
      return;
    }

    setStatus("Shout out sendt til klienten");
    setShoutText("");
  }, [send, shoutText]);

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
  }, []);

  const mapBrowserKeyToXdotool = useCallback((key) => {
    const keyMap = {
      Enter: "Return",
      Escape: "Escape",
      Backspace: "BackSpace",
      Delete: "Delete",
      Tab: "Tab",
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      Home: "Home",
      End: "End",
      PageUp: "Page_Up",
      PageDown: "Page_Down",
      Insert: "Insert",
      " ": "space",
    };

    if (keyMap[key]) return keyMap[key];
    if (/^F\d{1,2}$/.test(key)) return key;
    if (key.length === 1) return key.toLowerCase();
    return key;
  }, []);

  const handleRemoteKeyDown = useCallback((event) => {
    if (!keyboardEnabled || !canControl) return;

    const targetTag = String(event.target?.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(targetTag)) return;

    // Undgå at browseren selv scroller/navigerer, når tastaturet bruges til klienten.
    event.preventDefault();
    event.stopPropagation();

    const hasModifier = event.ctrlKey || event.altKey || event.metaKey;

    // Almindelig tekst sendes som tekst, så æ/ø/å og tegn fungerer bedre.
    if (!hasModifier && event.key && event.key.length === 1) {
      send({ type: "text", text: event.key });
      return;
    }

    let key = mapBrowserKeyToXdotool(event.key);

    const parts = [];
    if (event.ctrlKey) parts.push("ctrl");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey && (hasModifier || key.length > 1)) parts.push("shift");
    if (event.metaKey) parts.push("super");
    parts.push(key);

    send({ type: "key", key: parts.join("+") });
  }, [keyboardEnabled, canControl, send, mapBrowserKeyToXdotool]);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
          <Button component={RouterLink} to={`/clients/${clientId}`} startIcon={<ArrowBackIcon />} variant="outlined">
            Tilbage til klient
          </Button>

          <Typography variant="h5" sx={{ flex: 1, fontWeight: 700 }}>
            Fjernskrivebord
          </Typography>

          <Chip
            color={connected ? "success" : "default"}
            label={connected ? "Browser forbundet" : "Browser ikke forbundet"}
          />
          <Chip
            color={agentConnected ? "success" : "warning"}
            label={agentConnected ? "Klient-agent forbundet" : "Venter på klient-agent"}
          />

          <Button onClick={connect} startIcon={<RefreshIcon />} variant="outlined">
            Genforbind
          </Button>
          <Button onClick={requestFullscreen} startIcon={<FullscreenIcon />} variant="outlined">
            Fuld skærm
          </Button>
          <Button
            disabled={!canControl}
            onClick={() => {
              setKeyboardEnabled((prev) => !prev);
              setTimeout(focusRemoteDesktop, 50);
            }}
            startIcon={<KeyboardIcon />}
            variant={keyboardEnabled ? "contained" : "outlined"}
            color={keyboardEnabled ? "success" : "inherit"}
          >
            Tastatur {keyboardEnabled ? "til" : "fra"}
          </Button>
        </Stack>

        <Alert severity="warning">
          Remote desktop - Klient ID: {clientId || "Ukendt"} - Lokation: {client?.locality || "Ikke angivet"}
          {keyboardEnabled
            ? " · Tastatur aktivt"
            : " · Aktiver “Tastatur fra”-knappen og klik derefter på skærmbilledet for at bruge dit eget tastatur."}
        </Alert>

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Paper
          ref={containerRef}
          elevation={3}
          tabIndex={0}
          onKeyDown={handleRemoteKeyDown}
          onClick={focusRemoteDesktop}
          sx={{
            bgcolor: "#111",
            p: 1,
            borderRadius: 2,
            overflow: "auto",
            minHeight: 360,
            outline: keyboardEnabled ? "2px solid" : "none",
            outlineColor: keyboardEnabled ? "primary.main" : "transparent",
          }}
        >
          {!frameSrc ? (
            <Box sx={{ minHeight: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <Stack spacing={2} alignItems="center">
                <CircularProgress color="inherit" />
                <Typography>{status}</Typography>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                width: "100%",
              }}
            >
              <Tooltip title="Venstreklik, højreklik og scroll sendes til klienten">
                <Box
                  component="img"
                  ref={imgRef}
                  src={frameSrc}
                  alt="Remote desktop"
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onDoubleClick={handleDoubleClick}
                  onContextMenu={handleContextMenu}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onWheel={handleWheel}
                  sx={{
                    maxWidth: "100%",
                    height: "auto",
                    cursor: canControl ? "crosshair" : "not-allowed",
                    borderRadius: 1,
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  draggable={false}
                />
              </Tooltip>
            </Box>
          )}
        </Paper>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {status}
            {screenSize.width && screenSize.height ? ` · ${screenSize.width}x${screenSize.height}` : ""}
            {frameAgeText ? ` · ${frameAgeText}` : ""}
          </Typography>

          <Button onClick={startStream} disabled={!connected || !agentConnected} variant="outlined">
            Start stream
          </Button>
          <Button onClick={stopStream} disabled={!connected || !agentConnected} variant="outlined" color="inherit">
            Stop stream
          </Button>
        </Stack>

        <Divider />

        <Paper elevation={1} sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Shout out
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                label="Shout out besked"
                value={shoutText}
                onChange={(e) => setShoutText(e.target.value)}
                size="small"
                fullWidth
                disabled={!canControl}
                inputProps={{ maxLength: 120 }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendShout();
                  }
                }}
              />
              <Button
                disabled={!canControl || !shoutText.trim()}
                variant="contained"
                color="warning"
                onClick={sendShout}
              >
                Send shout out
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
