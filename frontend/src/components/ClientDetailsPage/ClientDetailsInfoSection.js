import React from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Box,
  IconButton,
  useMediaQuery
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";

/*
  ClientDetailsInfoSection (opdateret)
  - Bruger uptime og lastSeen props direkte (de opdateres af parent's 1s chrome-status poll).
  - Komponent er memoized (React.memo) med en custom comparator, så den kun rerender når relevante props ændrer sig:
    client (nøglefelter), markedDays, uptime eller lastSeen.
  - Mindsker unødvendige rerenders, men sikrer at "Oppetid" og "Sidst set" opdateres straks når parent ændrer disse props.
*/

// Fælles StatusBadge med 2 sekunders puls animation
function StatusBadge({ color, text, animate = false, isMobile = false }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: isMobile ? 1 : 2 }}>
      <Box sx={{
        width: isMobile ? 8 : 10,
        height: isMobile ? 8 : 10,
        borderRadius: "50%",
        bgcolor: color,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
        mr: 1,
        animation: animate ? "pulsate 2s infinite" : "none"
      }} />
      <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : undefined }}>
        {text}
      </Typography>
      {animate && (
        <style>
          {`
            @keyframes pulsate {
              0% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.25);
                opacity: 0.5;
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }
          `}
        </style>
      )}
    </Box>
  );
}

function formatDateShort(dt) {
  const ukedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const dayName = ukedage[dt.getDay()];
  const day = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  const year = dt.getFullYear();
  return `${dayName} ${day}.${month} ${year}`;
}
function getStatusAndTimesFromRaw(markedDays, dt) {
  const dateKey = `${dt.getFullYear()}-${(dt.getMonth()+1).toString().padStart(2,"0")}-${dt.getDate().toString().padStart(2,"0")}T00:00:00`;
  const data = markedDays[dateKey];
  if (!data || !data.status || data.status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }
  return {
    status: "on",
    powerOn: data.onTime || "",
    powerOff: data.offTime || ""
  };
}
function StatusText({ status, isMobile=false }) {
  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        color: status === "on" ? "#43a047" : "#e53935",
        textTransform: "lowercase",
        fontSize: isMobile ? 12 : undefined
      }}
    >
      {status.toLowerCase()}
    </Typography>
  );
}
function ClientPowerShortTable({ markedDays, isMobile=false }) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  const cellStyle = { whiteSpace: "nowrap", py: 0, px: isMobile ? 1 : 1.625, fontSize: isMobile ? 12 : 14 };

  return (
    <TableContainer sx={isMobile ? { maxWidth: "100vw" } : {}}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Dato</TableCell>
            <TableCell sx={cellStyle}>Status</TableCell>
            <TableCell sx={cellStyle}>Tænd</TableCell>
            <TableCell sx={cellStyle}>Sluk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((dt) => {
            const { status, powerOn, powerOff } = getStatusAndTimesFromRaw(markedDays, dt);
            return (
              <TableRow key={dt.toISOString().slice(0, 10)} sx={{ height: isMobile ? 22 : 30 }}>
                <TableCell sx={cellStyle}>{formatDateShort(dt)}</TableCell>
                <TableCell sx={cellStyle}><StatusText status={status} isMobile={isMobile} /></TableCell>
                <TableCell sx={cellStyle}>
                  {status === "on" && powerOn ? powerOn : ""}
                </TableCell>
                <TableCell sx={cellStyle}>
                  {status === "on" && powerOff ? powerOff : ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function formatDateTime(dateStr, withSeconds = false) {
  if (!dateStr) return "ukendt";
  let d;
  // Accept ISO-ish strings or epoch numbers
  if (typeof dateStr === "number") {
    d = new Date(dateStr);
  } else {
    if (dateStr.endsWith("Z") || dateStr.match(/[\+\-]\d{2}:?\d{2}$/)) {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr + "Z");
    }
  }
  if (Number.isNaN(d.getTime())) return "ukendt";
  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const day = parts.find(p => p.type === "day")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const year = parts.find(p => p.type === "year")?.value || "";
  const hour = parts.find(p => p.type === "hour")?.value || "";
  const minute = parts.find(p => p.type === "minute")?.value || "";
  const second = withSeconds ? (parts.find(p => p.type === "second")?.value || "00") : undefined;
  return withSeconds
    ? `${day}.${month} ${year}, kl. ${hour}:${minute}:${second}`
    : `${day}.${month} ${year}, kl. ${hour}:${minute}`;
}

function formatUptime(uptimeStr) {
  if (!uptimeStr) return "ukendt";
  let totalSeconds = 0;
  if (typeof uptimeStr === "number") {
    totalSeconds = Math.floor(uptimeStr);
  } else if (uptimeStr.includes('-')) {
    const [d, hms] = uptimeStr.split('-');
    const [h = "0", m = "0", s = "0"] = hms.split(':');
    totalSeconds =
      parseInt(d, 10) * 86400 +
      parseInt(h, 10) * 3600 +
      parseInt(m, 10) * 60 +
      parseInt(s, 10);
  } else if (uptimeStr.includes(':')) {
    const parts = uptimeStr.split(':').map(Number);
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      totalSeconds = parts[0];
    }
  } else {
    totalSeconds = parseInt(uptimeStr, 10);
  }
  if (!isFinite(totalSeconds) || Number.isNaN(totalSeconds)) return "ukendt";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${days} d., ${hours} t., ${mins} min., ${secs} sek.`;
}

function SystemInfoTable({ client, uptime, lastSeen, isMobile=false }) {
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
  const valueCellStyle = {
    border: 0,
    pl: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="systeminfo">
        <TableBody>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Ubuntu version:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: isMobile ? "22px" : "30px" }}>
                {client?.ubuntu_version || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Oppetid:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: isMobile ? "22px" : "30px" }}>
                {formatUptime(uptime)}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Sidst set:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: isMobile ? "22px" : "30px" }}>
                {formatDateTime(lastSeen, true)}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Tilføjet:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: isMobile ? "22px" : "30px" }}>
                {formatDateTime(client?.created_at, true)}
              </Box>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Helper for clipboard copy
function CopyField({ value, isMobile=false }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!value || value === "ukendt") return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", lineHeight: isMobile ? "22px" : "30px" }}>
      <span style={{ fontSize: isMobile ? 12 : undefined }}>{value}</span>
      {value && value !== "ukendt" && (
        <Tooltip title={copied ? "Kopieret!" : "Kopier"} arrow>
          <IconButton
            aria-label="kopier"
            onClick={handleCopy}
            size={isMobile ? "small" : "small"}
            sx={{ ml: 0.5, p: 0, height: isMobile ? "1em" : "1.4em", width: isMobile ? "1em" : "1.4em" }}
          >
            <ContentCopyIcon sx={{ fontSize: isMobile ? "0.8em" : "1em", verticalAlign: "middle" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function NetworkInfoTable({ client, isMobile=false }) {
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
  const valueCellStyle = {
    border: 0,
    pl: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="netværksinfo">
        <TableBody>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>IP-adresse WLAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <CopyField value={client?.wifi_ip_address || "ukendt"} isMobile={isMobile} />
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>MAC-adresse WLAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <CopyField value={client?.wifi_mac_address || "ukendt"} isMobile={isMobile} />
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>IP-adresse LAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <CopyField value={client?.lan_ip_address || "ukendt"} isMobile={isMobile} />
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>MAC-adresse LAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <CopyField value={client?.lan_mac_address || "ukendt"} isMobile={isMobile} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ClientDetailsInfoSection({
  client,
  markedDays = {},
  uptime,
  lastSeen,
  calendarDialogOpen,
  setCalendarDialogOpen,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Grid container spacing={isMobile ? 0.5 : 1}>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
          <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1, fontSize: isMobile ? 16 : undefined }}>
                Kalender
              </Typography>
              <Tooltip title="Vis kalender">
                <span>
                  <Button
                    size="small"
                    variant="text"
                    sx={{
                      minWidth: 0,
                      color: "text.secondary",
                      fontSize: isMobile ? "0.8rem" : "0.85rem",
                      textTransform: "none",
                      px: isMobile ? 0.5 : 1,
                      verticalAlign: "middle",
                      borderRadius: isMobile ? 5 : 8
                    }}
                    onClick={() => setCalendarDialogOpen(true)}
                  >
                    <ArrowForwardIosIcon sx={{ fontSize: isMobile ? 13 : 16 }} />
                  </Button>
                </span>
              </Tooltip>
            </Box>
            <ClientPowerShortTable markedDays={markedDays} isMobile={isMobile} />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
          <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : undefined }}>
                Systeminfo
              </Typography>
            </Box>
            <SystemInfoTable client={client} uptime={uptime} lastSeen={lastSeen} isMobile={isMobile} />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
          <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : undefined }}>
                Netværksinfo
              </Typography>
            </Box>
            <NetworkInfoTable client={client} isMobile={isMobile} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// Custom comparator: only re-render when relevant props change
function propsAreEqual(prev, next) {
  // compare client identity and a few key display fields
  const prevClient = prev.client || {};
  const nextClient = next.client || {};
  if (prevClient.id !== nextClient.id) return false;
  if (prevClient.ubuntu_version !== nextClient.ubuntu_version) return false;
  if (prevClient.created_at !== nextClient.created_at) return false;
  // network fields
  if ((prevClient.wifi_ip_address || "") !== (nextClient.wifi_ip_address || "")) return false;
  if ((prevClient.wifi_mac_address || "") !== (nextClient.wifi_mac_address || "")) return false;
  if ((prevClient.lan_ip_address || "") !== (nextClient.lan_ip_address || "")) return false;
  if ((prevClient.lan_mac_address || "") !== (nextClient.lan_mac_address || "")) return false;

  // markedDays: shallow compare keys length (typical small object)
  const prevMarked = prev.markedDays || {};
  const nextMarked = next.markedDays || {};
  const prevKeys = Object.keys(prevMarked);
  const nextKeys = Object.keys(nextMarked);
  if (prevKeys.length !== nextKeys.length) return false;
  for (let i = 0; i < prevKeys.length; i++) {
    const k = prevKeys[i];
    if (prevMarked[k] !== nextMarked[k]) return false;
  }

  // uptime and lastSeen must be compared — these are expected to change frequently via parent poll
  if ((prev.uptime || "") !== (next.uptime || "")) return false;
  if ((prev.lastSeen || "") !== (next.lastSeen || "")) return false;

  // calendar dialog handlers don't affect rendering comparison
  return true;
}

export default React.memo(ClientDetailsInfoSection, propsAreEqual);
