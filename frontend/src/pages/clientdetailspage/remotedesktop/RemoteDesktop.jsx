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
import { apiUrl } from "../../../api";

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

  const wsRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("Ikke forbundet");
  const [error, setError] = useState("");
  const [frameSrc, setFrameSrc] = useState("");
  const [screenSize, setScreenSize] = useState({ width: null, height: null });
  const [lastFrameTs, setLastFrameTs] = useState(null);
  const [textToType, setTextToType] = useState("");

  const canControl = connected && agentConnected && sessionId;

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

  const handleClick = useCallback((event) => {
    if (!canControl) return;
    const pos = getRemoteCoordinates(event);
    if (!pos) return;

    send({
      type: "mouse",
      action: event.detail >= 2 ? "double_click" : "click",
      ...pos,
    });
  }, [canControl, getRemoteCoordinates, send]);

  const handleContextMenu = useCallback((event) => {
    event.preventDefault();
    if (!canControl) return;
    const pos = getRemoteCoordinates(event);
    if (!pos) return;

    send({
      type: "mouse",
      action: "right_click",
      ...pos,
    });
  }, [canControl, getRemoteCoordinates, send]);

  const handleMouseMove = useCallback((event) => {
    if (!canControl) return;
    const pos = getRemoteCoordinates(event);
    if (!pos) return;
    // Throttle simpelt via timestamp på elementet.
    const now = Date.now();
    const last = Number(imgRef.current?.dataset?.lastMove || "0");
    if (now - last < 80) return;
    if (imgRef.current) imgRef.current.dataset.lastMove = String(now);

    send({
      type: "mouse",
      action: "move",
      ...pos,
    });
  }, [canControl, getRemoteCoordinates, send]);

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

  const sendText = useCallback(() => {
    if (!textToType) return;
    send({ type: "text", text: textToType });
    setTextToType("");
  }, [send, textToType]);

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
  }, []);

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
        </Stack>

        <Alert severity="warning">
          Remote desktop giver skærm-, mus- og tastaturadgang til klienten. Bruges kun af superadmin.
        </Alert>

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Paper
          ref={containerRef}
          elevation={3}
          sx={{
            bgcolor: "#111",
            p: 1,
            borderRadius: 2,
            overflow: "auto",
            minHeight: 360,
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
                  onClick={handleClick}
                  onContextMenu={handleContextMenu}
                  onMouseMove={handleMouseMove}
                  onWheel={handleWheel}
                  sx={{
                    maxWidth: "100%",
                    height: "auto",
                    cursor: canControl ? "crosshair" : "not-allowed",
                    borderRadius: 1,
                    userSelect: "none",
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
            <Stack direction="row" spacing={1} alignItems="center">
              <KeyboardIcon />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Tastatur
              </Typography>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Button disabled={!canControl} variant="outlined" onClick={() => sendKey("F5")}>F5</Button>
              <Button disabled={!canControl} variant="outlined" onClick={() => sendKey("ctrl+r")}>Ctrl+R</Button>
              <Button disabled={!canControl} variant="outlined" onClick={() => sendKey("Escape")}>Escape</Button>
              <Button disabled={!canControl} variant="outlined" onClick={() => sendKey("Return")}>Enter</Button>
              <Button disabled={!canControl} variant="outlined" onClick={() => sendKey("BackSpace")}>Backspace</Button>
              <Button disabled={!canControl} variant="outlined" color="warning" onClick={() => sendKey("alt+F4")}>Alt+F4</Button>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                label="Skriv tekst på klient"
                value={textToType}
                onChange={(e) => setTextToType(e.target.value)}
                size="small"
                fullWidth
                disabled={!canControl}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendText();
                  }
                }}
              />
              <Button disabled={!canControl || !textToType} variant="contained" onClick={sendText} startIcon={<KeyboardIcon />}>
                Send tekst
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <MouseIcon fontSize="small" />
              <Typography variant="caption" color="text.secondary">
                Mus: venstreklik, dobbeltklik, højreklik og scroll på skærmbilledet.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
