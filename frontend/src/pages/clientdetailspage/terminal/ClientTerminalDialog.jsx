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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import TerminalIcon from "@mui/icons-material/Terminal";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { getTerminalBrowserWsUrl } from "../../../api";

function nowTime() {
  return new Date().toLocaleTimeString("da-DK", { hour12: false });
}

function appendLine(setLines, line) {
  setLines((prev) => [...prev, line].slice(-800));
}

function normalizeCommandText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd();
}

function appendCommandEcho(setLines, cmd) {
  const normalized = normalizeCommandText(cmd);
  if (!normalized.trim()) return;

  const rendered = normalized.split("\n").map((line, index) =>
    index === 0 ? `$ ${line}` : `> ${line}`
  );

  setLines((prev) => [...prev, ...rendered].slice(-800));
}

const SUPPORT_COMMAND_GROUPS = [
  {
    title: "Service-status",
    commands: [
      {
        label: "ClientFlow services",
        command:
          "systemctl --no-pager --full status clientflow_service.service clientflow_calendar.service client_terminal_agent.service client_admin_terminal_agent.service client_remote_desktop_agent.service",
      },
      {
        label: "Aktive ClientFlow units",
        command:
          "systemctl list-units --all --type=service | grep -iE 'clientflow|terminal|remote|stream|admin'",
      },
      {
        label: "ClientFlow env uden password",
        command:
          "systemctl show clientflow_service.service -p Environment --no-pager | sed -E 's/CLIENTFLOW_PASSWORD=[^ ]+/CLIENTFLOW_PASSWORD=***/g'",
      },
    ],
  },
  {
    title: "Logs",
    commands: [
      {
        label: "Backend sync log",
        command:
          "journalctl -u clientflow_service.service -n 200 --no-pager -l",
      },
      {
        label: "Kalender log",
        command:
          "journalctl -u clientflow_calendar.service -n 150 --no-pager -l",
      },
      {
        label: "Terminal-agent log",
        command:
          "journalctl -u client_terminal_agent.service -n 150 --no-pager -l",
      },
      {
        label: "Remote desktop-agent log",
        command:
          "journalctl -u client_remote_desktop_agent.service -n 150 --no-pager -l",
      },
      {
        label: "Livestream-linjer fra backend sync",
        command:
          "journalctl -u clientflow_service.service -n 300 --no-pager -l | grep -iE 'livestream|hls|ffmpeg|segment|upload|fejl|error'",
      },
    ],
  },
  {
    title: "Livestream",
    commands: [
      {
        label: "Livestream-processer",
        command:
          "pgrep -af 'livestream.py|ffmpeg' || echo 'Ingen livestream/ffmpeg kører'",
      },
      {
        label: "Seneste lokale segmenter",
        command:
          "ls -lah \"$HOME/api/segments\" 2>/dev/null | tail -30 || echo 'Ingen segments-mappe fundet'",
      },
      {
        label: "Tjek segment_time",
        command:
          "pgrep -af 'ffmpeg' | grep -o -- '-segment_time [0-9.]*' || echo 'Ingen ffmpeg segment_time fundet'",
      },
      {
        label: "Stop hængende livestream lokalt",
        command:
          "pkill -f \"$HOME/api/livestream.py\"; pkill -f 'ffmpeg .*segment_'; pgrep -af 'livestream.py|ffmpeg' || echo 'OK: livestream stoppet'",
      },
    ],
  },
  {
    title: "System og netværk",
    commands: [
      {
        label: "Disk, RAM og oppetid",
        command: "df -h; echo; free -h; echo; uptime",
      },
      {
        label: "IP-adresser",
        command: "ip -br addr",
      },
      {
        label: "Netværksenheder",
        command: "nmcli device status 2>/dev/null || ip link",
      },
      {
        label: "Chrome-processer",
        command:
          "pgrep -af 'chrome|chromium' || echo 'Ingen Chrome/Chromium-processer fundet'",
      },
    ],
  },
];

export default function ClientTerminalDialog({ open, onClose, client }) {
  const [lines, setLines] = React.useState([]);
  const [command, setCommand] = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const [agentConnected, setAgentConnected] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [mode, setMode] = React.useState("user");
  const wsRef = React.useRef(null);
  const outputRef = React.useRef(null);
  const lastEchoedCommandRef = React.useRef(null);

  React.useEffect(() => {
    if (!open || !client?.id) return undefined;

    setLines([]);
    setConnected(false);
    setAgentConnected(false);
    setRunning(false);
    lastEchoedCommandRef.current = null;

    let ws;
    let closedByComponent = false;

    try {
      ws = new WebSocket(getTerminalBrowserWsUrl(client.id, mode));
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
          `[${nowTime()}] ${mode === "admin" ? "Admin-terminal" : "Bruger-terminal"} · Session ${msg.session_id || "?"}. Agent: ${
            msg.client_connected ? "forbundet" : "ikke forbundet"
          }.`
        );
        return;
      }

      if (msg.type === "agent_status") {
        setAgentConnected(!!msg.client_connected);
        appendLine(
          setLines,
          `[${nowTime()}] Agent: ${msg.client_connected ? "forbundet" : "afbrudt"}.`
        );
        return;
      }

      if (msg.type === "status") {
        appendLine(setLines, `[${nowTime()}] ${msg.message}`);
        return;
      }

      if (msg.type === "started") {
        setRunning(true);

        // Backend sender også kommandoen tilbage ved start.
        // Hvis vi allerede har ekkoet den lokalt ved afsendelse, undgår vi dublet.
        const startedCommand = normalizeCommandText(msg.command);
        if (startedCommand && startedCommand !== lastEchoedCommandRef.current) {
          appendCommandEcho(setLines, startedCommand);
          lastEchoedCommandRef.current = startedCommand;
        }
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
        lastEchoedCommandRef.current = null;
        appendLine(setLines, `[exit ${msg.code}]${msg.cwd ? ` cwd=${msg.cwd}` : ""}`);
        return;
      }

      if (msg.type === "error") {
        setRunning(false);
        lastEchoedCommandRef.current = null;
        appendLine(setLines, `[FEJL] ${msg.message}`);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      setAgentConnected(false);
      setRunning(false);
      if (!closedByComponent) {
        appendLine(
          setLines,
          `[${nowTime()}] Forbindelsen blev lukket (${event.code}${
            event.reason ? `: ${event.reason}` : ""
          }).`
        );
      }
    };

    ws.onerror = () => {
      appendLine(setLines, `[${nowTime()}] WebSocket-fejl.`);
    };

    return () => {
      closedByComponent = true;
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [open, client?.id, mode]);

  React.useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const sendCommand = React.useCallback(() => {
    const cmd = normalizeCommandText(command);
    if (!cmd.trim() || running || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    appendCommandEcho(setLines, cmd);
    lastEchoedCommandRef.current = cmd;
    setRunning(true);

    try {
      wsRef.current.send(JSON.stringify({ type: "run", command: cmd }));
      setCommand("");
    } catch (err) {
      setRunning(false);
      lastEchoedCommandRef.current = null;
      appendLine(setLines, `[FEJL] Kunne ikke sende kommando: ${err?.message || err}`);
    }
  }, [command, running]);

  const insertCommand = React.useCallback((cmd) => {
    setCommand(cmd);
  }, []);

  const copyCommand = React.useCallback(async (cmd) => {
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      // Clipboard kan være blokeret i nogle browsere. Ignorer.
    }
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      sendCommand();
      return;
    }

    // Normal terminalfølelse: Enter kører kommandoen.
    // Shift+Enter bevares til kommandoer/scripts på flere linjer.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendCommand();
    }
  };

  const handleModeChange = React.useCallback((event, nextMode) => {
    if (!nextMode || running) return;
    setMode(nextMode);
  }, [running]);

  const isAdminMode = mode === "admin";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TerminalIcon /> {isAdminMode ? "Admin terminal" : "Remote terminal"}
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          size="small"
          label={isAdminMode ? "ROOT" : "Bruger"}
          color={isAdminMode ? "error" : "default"}
        />
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
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Klient: {client?.name || client?.id || "ukendt"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {isAdminMode
                ? "Admin-terminal kører som root med fulde systemrettigheder."
                : "Bruger-terminal kører som kiosk-brugeren."}
            </Typography>
          </Box>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={handleModeChange}
            disabled={running}
          >
            <ToggleButton value="user">Bruger-terminal</ToggleButton>
            <ToggleButton value="admin" color="error">Admin-terminal</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Alert severity={isAdminMode ? "error" : "warning"} sx={{ mb: 1.5 }}>
          {isAdminMode
            ? "Admin-terminal har fulde systemrettigheder. Brug kun til fejlfinding og reparation."
            : "Remote terminal shell-adgang som kiosk-brugeren."}
        </Alert>

        <Box
          ref={outputRef}
          sx={{
            height: { xs: 320, md: 440 },
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

        <Box sx={{ display: "flex", gap: 1, mt: 1.5, alignItems: "stretch" }}>
          <TextField
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected || !agentConnected || running}
            size="small"
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            placeholder={
              agentConnected
                ? isAdminMode
                  ? "Skriv root-kommando eller script..."
                  : "Skriv kommando eller script..."
                : "Venter på klient-agent..."
            }
            helperText="Enter kører · Shift+Enter laver ny linje · Ctrl/Cmd+Enter kører også"
            InputProps={{
              sx: {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                alignItems: "flex-start",
              },
            }}
            FormHelperTextProps={{
              sx: { ml: 0, fontSize: 12 },
            }}
          />
          <Button
            variant="contained"
            onClick={sendCommand}
            disabled={!connected || !agentConnected || running || !command.trim()}
            sx={{ minWidth: 120, alignSelf: "flex-start", minHeight: 40 }}
          >
            {running ? <CircularProgress size={18} color="inherit" /> : "Kør"}
          </Button>
        </Box>

        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography fontWeight={700}>Supportkommandoer</Typography>
              <Typography variant="caption" color="text.secondary">
                Indsætter kommandoen i terminalfeltet. Den køres først, når du trykker “Kør”.
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Logvisning er fjernet fra den lokale offentlige GUI. Brug denne superadmin-terminal
              til support. Kommandoerne nedenfor forsøger at undgå at vise adgangskoder.
            </Alert>

            <Stack spacing={1.5}>
              {SUPPORT_COMMAND_GROUPS.map((group) => (
                <Box key={group.title}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                    {group.title}
                  </Typography>
                  <Stack spacing={0.75}>
                    {group.commands.map((item) => (
                      <Box
                        key={item.label}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "180px 1fr auto auto" },
                          gap: 0.75,
                          alignItems: "center",
                          p: 1,
                          borderRadius: 1,
                          bgcolor: "rgba(0,0,0,0.03)",
                        }}
                      >
                        <Typography variant="body2" fontWeight={600}>
                          {item.label}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.command}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => insertCommand(item.command)}
                          disabled={!connected || !agentConnected || running}
                        >
                          Indsæt
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ContentCopyIcon />}
                          onClick={() => copyCommand(item.command)}
                        >
                          Kopiér
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
