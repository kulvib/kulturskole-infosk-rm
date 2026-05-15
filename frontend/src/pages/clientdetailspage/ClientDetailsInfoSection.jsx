import React from "react";
import {
  Grid, Card, CardContent, Typography, Button, Tooltip,
  Table, TableHead, TableBody, TableCell, TableContainer, TableRow,
  Box, IconButton, useMediaQuery, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Chip
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import { useTheme } from "@mui/material/styles";
import { requestOsUpdate } from "../../api";
import { useAuth } from "../../auth/authcontext";

function StatusBadge({ color, text, animate = false, isMobile = false }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: isMobile ? 1 : 2 }}>
      <Box sx={{
        width: isMobile ? 8 : 10, height: isMobile ? 8 : 10,
        borderRadius: "50%", bgcolor: color,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)", border: "1px solid #ddd", mr: 1,
        animation: animate ? "pulsate 2s infinite" : "none"
      }} />
      <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : undefined }}>
        {text}
      </Typography>
      {animate && (
        <style>{`
          @keyframes pulsate {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.25); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      )}
    </Box>
  );
}

function formatDateShort(dt) {
  const ukedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const day = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  return `${ukedage[dt.getDay()]} ${day}.${month} ${dt.getFullYear()}`;
}

// FIX: Håndterer både YYYY-MM-DDT00:00:00 og YYYY-MM-DD nøgleformat
function getStatusAndTimesFromRaw(markedDays, dt) {
  const yyyy = dt.getFullYear();
  const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getDate().toString().padStart(2, "0");
  const dateKeyShort = `${yyyy}-${mm}-${dd}`;
  const dateKeyFull = `${dateKeyShort}T00:00:00`;
  const data = markedDays[dateKeyFull]
    || markedDays[dateKeyShort]
    || Object.entries(markedDays || {}).find(([k]) => k.startsWith(dateKeyShort))?.[1];
  if (!data || !data.status || data.status === "off") return { status: "off", powerOn: "", powerOff: "" };
  return { status: "on", powerOn: data.onTime || "", powerOff: data.offTime || "" };
}

function StatusText({ status, isMobile = false }) {
  return (
    <Typography variant="body2" sx={{
      fontWeight: 600, color: status === "on" ? "#43a047" : "#e53935",
      textTransform: "lowercase", fontSize: isMobile ? 12 : undefined
    }}>
      {status.toLowerCase()}
    </Typography>
  );
}

function ClientPowerShortTable({ markedDays, isMobile = false }) {
  const days = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
  const cellStyle = { whiteSpace: "nowrap", py: 0, px: isMobile ? 1 : 1.625, fontSize: isMobile ? 12 : 14 };
  const hasData = markedDays && Object.keys(markedDays).length > 0;

  if (!hasData) {
    return (
      <Typography variant="body2" sx={{ color: "#888", mt: 1, fontSize: isMobile ? 12 : 14 }}>
        Ingen kalenderdata for denne klient.
      </Typography>
    );
  }

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
          {days.map(dt => {
            const { status, powerOn, powerOff } = getStatusAndTimesFromRaw(markedDays, dt);
            return (
              <TableRow key={dt.toISOString().slice(0, 10)} sx={{ height: isMobile ? 22 : 30 }}>
                <TableCell sx={cellStyle}>{formatDateShort(dt)}</TableCell>
                <TableCell sx={cellStyle}><StatusText status={status} isMobile={isMobile} /></TableCell>
                <TableCell sx={cellStyle}>{status === "on" && powerOn ? powerOn : ""}</TableCell>
                <TableCell sx={cellStyle}>{status === "on" && powerOff ? powerOff : ""}</TableCell>
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
  const d = dateStr.endsWith("Z") || dateStr.match(/[\+\-]\d{2}:?\d{2}$/)
    ? new Date(dateStr) : new Date(dateStr + "Z");
  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: withSeconds ? "2-digit" : undefined, hour12: false
  });
  const parts = formatter.formatToParts(d);
  const get = type => parts.find(p => p.type === type)?.value || "";
  return withSeconds
    ? `${get("day")}.${get("month")} ${get("year")}, kl. ${get("hour")}:${get("minute")}:${get("second")}`
    : `${get("day")}.${get("month")} ${get("year")}, kl. ${get("hour")}:${get("minute")}`;
}

// FIX: Smart oppetid-formatter — viser kun relevante enheder
function formatUptime(uptimeStr) {
  if (!uptimeStr) return "ukendt";

  let totalSeconds = 0;

  // Håndter decimal fra /proc/uptime fx "185112.45 12345.67"
  const firstToken = String(uptimeStr).trim().split(/\s+/)[0];
  const asFloat = parseFloat(firstToken);

  if (!isNaN(asFloat) && !String(uptimeStr).includes(":") && !String(uptimeStr).includes("-")) {
    // Rent tal (sekunder) — evt. med decimal
    totalSeconds = Math.floor(asFloat);
  } else if (String(uptimeStr).includes("-")) {
    // Format: "2-03:45:12" (dag-timer:min:sek)
    const [d, hms] = String(uptimeStr).split("-");
    const [h = "0", m = "0", s = "0"] = hms.split(":");
    totalSeconds = parseInt(d, 10) * 86400 + parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
  } else if (String(uptimeStr).includes(":")) {
    // Format: "HH:MM:SS" eller "MM:SS"
    const parts = String(uptimeStr).split(":").map(Number);
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    else totalSeconds = parts[0];
  } else {
    totalSeconds = Math.floor(parseFloat(uptimeStr) || 0);
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  // FIX: Vis kun relevante enheder
  if (days > 0) return `${days} d., ${hours} t., ${mins} min.`;
  if (hours > 0) return `${hours} t., ${mins} min.`;
  if (mins > 0) return `${mins} min., ${secs} sek.`;
  return `${secs} sek.`;
}

function SystemInfoTable({ client, uptime, lastSeen, isMobile = false, onRequestOsUpdate }) {
  const { user } = useAuth();
  const isAdminOrSuper = user?.role === "admin" || user?.role === "superadmin";

  const cellStyle = {
    border: 0, fontWeight: 600, whiteSpace: "nowrap",
    pr: isMobile ? 0.25 : 0.5, py: 0, verticalAlign: "middle",
    height: isMobile ? 22 : 30, fontSize: isMobile ? 12 : 14,
  };
  const valueCellStyle = {
    border: 0, pl: isMobile ? 0.25 : 0.5, py: 0,
    verticalAlign: "middle", height: isMobile ? 22 : 30, fontSize: isMobile ? 12 : 14,
  };

  const updatesAvailable = client?.ubuntu_updates_available ?? 0;
  const pendingOsUpdate = client?.pending_os_update ?? false;

  return (
    <TableContainer>
      <Table size="small" aria-label="systeminfo">
        <TableBody>

          {/* Ubuntu version + opdateringsstatus */}
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Ubuntu version:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <span>{client.ubuntu_version || "ukendt"}</span>
                {/* Vis chip hvis opdateringer er tilgængelige */}
                {updatesAvailable > 0 && (
                  <Chip
                    label={`${updatesAvailable} opdatering${updatesAvailable !== 1 ? "er" : ""}`}
                    size="small"
                    color="warning"
                    sx={{ height: 18, fontSize: "0.68rem" }}
                  />
                )}
                {/* Vis "afventer" chip hvis update er sendt men ikke udført */}
                {pendingOsUpdate && (
                  <Chip
                    label="Opdatering sendt..."
                    size="small"
                    color="info"
                    sx={{ height: 18, fontSize: "0.68rem" }}
                  />
                )}
              </Box>
            </TableCell>
          </TableRow>

          {/* Opdater Ubuntu knap — kun admin/superadmin og kun hvis opdateringer tilgængelige */}
          {isAdminOrSuper && updatesAvailable > 0 && (
            <TableRow sx={{ height: isMobile ? 28 : 36 }}>
              <TableCell sx={cellStyle} />
              <TableCell sx={valueCellStyle}>
                <Tooltip title={pendingOsUpdate ? "Opdatering er allerede sendt til klienten" : "Send opdateringsanmodning til klienten"}>
                  <span>
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      startIcon={<SystemUpdateAltIcon fontSize="small" />}
                      onClick={onRequestOsUpdate}
                      disabled={pendingOsUpdate || client?.isOnline === false}
                      sx={{ fontSize: isMobile ? "0.72rem" : "0.8rem", py: 0.3 }}
                    >
                      {pendingOsUpdate ? "Afventer opdatering..." : "Opdater Ubuntu"}
                    </Button>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          )}

          {/* Oppetid */}
          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Oppetid:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {formatUptime(uptime)}
              </Box>
            </TableCell>
          </TableRow>

          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Sidst set:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center" }}>{formatDateTime(lastSeen, true)}</Box>
            </TableCell>
          </TableRow>

          <TableRow sx={{ height: isMobile ? 22 : 30 }}>
            <TableCell sx={cellStyle}>Tilføjet:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center" }}>{formatDateTime(client.created_at, true)}</Box>
            </TableCell>
          </TableRow>

        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CopyField({ value, isMobile = false }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    if (!value || value === "ukendt") return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const t = document.createElement("textarea");
        t.value = value; t.style.position = "fixed"; t.style.left = "-9999px";
        document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
      }
      setCopied(true); setTimeout(() => setCopied(false), 800);
    } catch { }
  };
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <span style={{ fontSize: isMobile ? 12 : undefined }}>{value}</span>
      {value && value !== "ukendt" && (
        <Tooltip title={copied ? "Kopieret!" : "Kopier"} arrow>
          <IconButton onClick={handleCopy} size="small"
            sx={{ ml: 0.5, p: 0, height: isMobile ? "1em" : "1.4em", width: isMobile ? "1em" : "1.4em" }}>
            <ContentCopyIcon sx={{ fontSize: isMobile ? "0.8em" : "1em", verticalAlign: "middle" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function NetworkInfoTable({ client, isMobile = false }) {
  const cellStyle = {
    border: 0, fontWeight: 600, whiteSpace: "nowrap",
    pr: isMobile ? 0.25 : 0.5, py: 0, verticalAlign: "middle",
    height: isMobile ? 22 : 30, fontSize: isMobile ? 12 : 14,
  };
  const valueCellStyle = {
    border: 0, pl: isMobile ? 0.25 : 0.5, py: 0,
    verticalAlign: "middle", height: isMobile ? 22 : 30, fontSize: isMobile ? 12 : 14,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="netværksinfo">
        <TableBody>
          {[
            ["IP-adresse WLAN:", client.wifi_ip_address],
            ["MAC-adresse WLAN:", client.wifi_mac_address],
            ["IP-adresse LAN:", client.lan_ip_address],
            ["MAC-adresse LAN:", client.lan_mac_address],
          ].map(([label, value]) => (
            <TableRow key={label} sx={{ height: isMobile ? 22 : 30 }}>
              <TableCell sx={cellStyle}>{label}</TableCell>
              <TableCell sx={valueCellStyle}><CopyField value={value || "ukendt"} isMobile={isMobile} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ClientDetailsInfoSection({
  client,
  markedDays,
  uptime,
  lastSeen,
  calendarDialogOpen,
  setCalendarDialogOpen,
  clientOnline,
  showSnackbar,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [osUpdateDialogOpen, setOsUpdateDialogOpen] = React.useState(false);
  const [osUpdateLoading, setOsUpdateLoading] = React.useState(false);

  const isOffline = (typeof clientOnline !== "undefined") ? clientOnline === false : client?.isOnline === false;
  const disabledOverlay = isOffline ? { opacity: 0.65, filter: "grayscale(20%)", bgcolor: "#fafafa" } : {};

  const handleRequestOsUpdate = async () => {
    if (!client?.id) return;
    setOsUpdateLoading(true);
    try {
      await requestOsUpdate(client.id);
      setOsUpdateDialogOpen(false);
      if (typeof showSnackbar === "function") {
        showSnackbar({ message: "Opdateringsanmodning sendt til klienten!", severity: "success" });
      }
    } catch (err) {
      if (typeof showSnackbar === "function") {
        showSnackbar({ message: err.message || "Kunne ikke sende opdateringsanmodning", severity: "error" });
      }
    } finally {
      setOsUpdateLoading(false);
    }
  };

  return (
    <>
      {/* Bekræftelsesdialog — Ubuntu opdatering */}
      <Dialog open={osUpdateDialogOpen} onClose={() => !osUpdateLoading && setOsUpdateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Opdater Ubuntu</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            Du er ved at sende en opdateringsanmodning til:
          </Typography>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>
            {client?.locality || client?.name}
          </Typography>
          <Typography sx={{ mb: 1 }}>
            Klienten vil køre <code>apt-get upgrade</code> og kan genstarte bagefter.
          </Typography>
          <Typography color="error" sx={{ fontWeight: 600 }}>
            Infoskærmen kan gå offline i kort tid under opdateringen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOsUpdateDialogOpen(false)} disabled={osUpdateLoading}>
            Annuller
          </Button>
          <Button
            color="warning" variant="contained"
            onClick={handleRequestOsUpdate}
            disabled={osUpdateLoading}
            startIcon={osUpdateLoading ? <CircularProgress size={16} color="inherit" /> : <SystemUpdateAltIcon />}
          >
            {osUpdateLoading ? "Sender..." : "Ja, opdater Ubuntu"}
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={isMobile ? 0.5 : 1}>
        {/* Kalender */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%", ...disabledOverlay }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1, fontSize: isMobile ? 16 : undefined }}>
                  Kalender
                </Typography>
                <Tooltip title="Vis kalender">
                  <span>
                    <Button size="small" variant="text"
                      sx={{ minWidth: 0, color: "text.secondary", fontSize: isMobile ? "0.8rem" : "0.85rem", textTransform: "none", px: isMobile ? 0.5 : 1, borderRadius: isMobile ? 5 : 8 }}
                      onClick={() => setCalendarDialogOpen(true)}>
                      <ArrowForwardIosIcon sx={{ fontSize: isMobile ? 13 : 16 }} />
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              <ClientPowerShortTable markedDays={markedDays} isMobile={isMobile} />
            </CardContent>
          </Card>
        </Grid>

        {/* Systeminfo */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%", ...disabledOverlay }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : undefined }}>
                  Systeminfo
                </Typography>
              </Box>
              <SystemInfoTable
                client={client}
                uptime={uptime}
                lastSeen={lastSeen}
                isMobile={isMobile}
                onRequestOsUpdate={() => setOsUpdateDialogOpen(true)}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Netværksinfo */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%", ...disabledOverlay }}>
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
    </>
  );
}
