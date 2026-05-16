import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import TerminalIcon from "@mui/icons-material/Terminal";
import { getTerminalBrowserWsUrl } from "../../api";

function nowTime() {
  return new Date().toLocaleTimeString("da-DK", { hour12: false });
}

function appendLine(setLines, line) {
  setLines((prev) => [...prev, line].slice(-800));
}

export default function ClientTerminalDialog({ open, onClose, client }) {
  const [lines, setLines] = React.useState([]);
  const [command, setCommand] = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const [agentConnected, setAgentConnected] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const wsRef = React.useRef(null);
  const outputRef = React.useRef(null);

  React.useEffect(() => {
    if (!open || !client?.id) return undefined;

    setLines([]);
    setConnected(false);
    setAgentConnected(false);
    setRunning(false);

    let ws;
    let closedByComponent = false;

    try {
      ws = new WebSocket(getTerminalBrowserWsUrl(client.id));
      wsRef.current = ws;
    } catch (err) {
      appendLine(setLines, `[${nowTime()}] FEJL: ${err?.message || err}`);
      return undefined;
    }

    ws.onopen = () => {
      setConnected(true);
      appendLine(setLines, `[${nowTime()}] Forbundet til backend-terminalbroker.`);
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        appendLine(setLines, String(event.data));
        return;
      }

      if (msg.type === "hello") {
        setAgentConnected(!!msg.client_connected);
        appendLine(
          setLines,
          `[${nowTime()}] Session ${msg.session_id || "?"}. Agent: ${msg.client_connected ? "forbundet" : "ikke forbundet"}.`
        );
        return;
      }

      if (msg.type === "agent_status") {
        setAgentConnected(!!msg.client_connected);
        appendLine(setLines, `[${nowTime()}] Agent: ${msg.client_connected ? "forbundet" : "afbrudt"}.`);
        return;
      }

      if (msg.type === "status") {
        appendLine(setLines, `[${nowTime()}] ${msg.message}`);
        return;
      }

      if (msg.type === "started") {
        setRunning(true);
        appendLine(setLines, `$ ${msg.command}`);
        return;
      }

      if (msg.type === "output") {
        const prefix = msg.stream === "stderr" ? "" : "";
        String(msg.data || "")
          .replace(/\r/g, "")
          .split("\n")
          .forEach((l, idx, arr) => {
            if (idx === arr.length - 1 && l === "") return;
            appendLine(setLines, prefix + l);
          });
        return;
      }

      if (msg.type === "exit") {
        setRunning(false);
        appendLine(setLines, `[exit ${msg.code}]${msg.cwd ? ` cwd=${msg.cwd}` : ""}`);
        return;
      }

      if (msg.type === "error") {
        setRunning(false);
        appendLine(setLines, `[FEJL] ${msg.message}`);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      setAgentConnected(false);
      setRunning(false);
      if (!closedByComponent) {
        appendLine(setLines, `[${nowTime()}] Forbindelsen blev lukket (${event.code}${event.reason ? `: ${event.reason}` : ""}).`);
      }
    };

    ws.onerror = () => {
      appendLine(setLines, `[${nowTime()}] WebSocket-fejl.`);
    };

    return () => {
      closedByComponent = true;
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [open, client?.id]);

  React.useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const sendCommand = React.useCallback(() => {
    const cmd = command.trim();
    if (!cmd || running || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "run", command: cmd }));
    setCommand("");
  }, [command, running]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendCommand();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TerminalIcon /> Remote terminal
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          size="small"
          label={connected ? "Backend forbundet" : "Backend afbrudt"}
          color={connected ? "success" : "default"}
        />
        <Chip
          size="small"
          label={agentConnected ? "Klient-agent forbundet" : "Klient-agent ikke forbundet"}
          color={agentConnected ? "success" : "warning"}
        />
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Remote terminal giver shell-adgang til klienten. Bruges kun af superadmin.
        </Alert>

        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          Klient: {client?.name || client?.id || "ukendt"}
        </Typography>

        <Box
          ref={outputRef}
          sx={{
            height: { xs: 360, md: 520 },
            overflowY: "auto",
            bgcolor: "#0b0f14",
            color: "#d7e1ea",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            borderRadius: 1.5,
            p: 1.5,
            whiteSpace: "pre-wrap",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {lines.length === 0 ? "Forbinder..." : lines.join("\n")}
        </Box>

        <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
          <TextField
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected || !agentConnected || running}
            size="small"
            fullWidth
            placeholder={agentConnected ? "Skriv kommando, fx: whoami" : "Venter på klient-agent..."}
            InputProps={{
              sx: {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              },
            }}
          />
          <Button
            variant="contained"
            onClick={sendCommand}
            disabled={!connected || !agentConnected || running || !command.trim()}
            sx={{ minWidth: 120 }}
          >
            {running ? <CircularProgress size={18} color="inherit" /> : "Kør"}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
