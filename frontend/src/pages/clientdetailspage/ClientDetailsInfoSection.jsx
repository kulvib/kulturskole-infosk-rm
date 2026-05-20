import React from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Box,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  useMediaQuery,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { apiUrl } from "../../api";
import { useAuth } from "../../auth/authcontext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UKEDAGE = [
  "Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag",
];

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    accept: "application/json",
    ...extra,
  };
}

async function requestUbuntuUpdate(clientId) {
  if (!clientId) throw new Error("Mangler klient-id");

  const res = await fetch(`${apiUrl}/api/clients/${encodeURIComponent(clientId)}/os-update`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Backend kan i sjældne tilfælde returnere tom body.
  }

  if (!res.ok) {
    throw new Error(data?.detail || data?.message || `Ubuntu-opdatering fejlede (${res.status})`);
  }

  return data;
}

function formatDateShort(dt) {
  const dayName = UKEDAGE[dt.getDay()];
  const day   = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  const year  = dt.getFullYear();
  return `${dayName} ${day}.${month} ${year}`;
}

/**
 * Slår en dato op i markedDays-objektet.
 * Prøver tre nøgle-formater for at være robust mod backend-variationer:
 *   1. "YYYY-MM-DDT00:00:00"
 *   2. "YYYY-MM-DD"
 *   3. Prefix-match (første nøgle der starter med "YYYY-MM-DD")
 */
function getStatusAndTimesFromRaw(markedDays, dt) {
  const yyyy = dt.getFullYear();
  const mm   = (dt.getMonth() + 1).toString().padStart(2, "0");
  const dd   = dt.getDate().toString().padStart(2, "0");
  const dateKeyFull  = `${yyyy}-${mm}-${dd}T00:00:00`;
  const dateKeyShort = `${yyyy}-${mm}-${dd}`;

  const data =
    markedDays[dateKeyFull] ||
    markedDays[dateKeyShort] ||
    Object.entries(markedDays).find(([k]) => k.startsWith(dateKeyShort))?.[1];

  if (!data || !data.status || data.status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }
  return {
    status:   "on",
    powerOn:  data.onTime  || "",
    powerOff: data.offTime || "",
  };
}

/**
 * Formatér oppetid til "X d., X t., X min., X sek."
 * Håndterer:
 *   - Rent sekund-tal (fra lokal ticker): "86400"
 *   - D-HH:MM:SS: "1-02:03:04"
 *   - HH:MM:SS: "02:03:04"
 *   - MM:SS: "03:04"
 */
function formatUptime(uptimeStr) {
  if (uptimeStr === null || uptimeStr === undefined || uptimeStr === "") {
    return "ukendt";
  }
  const str = String(uptimeStr).trim();
  if (!str) return "ukendt";

  let totalSeconds = 0;

  if (str.includes("-") && str.includes(":")) {
    // Format: "D-HH:MM:SS"
    const [d, hms] = str.split("-");
    const [h = "0", m = "0", s = "0"] = hms.split(":");
    totalSeconds =
      parseInt(d, 10) * 86400 +
      parseInt(h, 10) * 3600 +
      parseInt(m, 10) * 60 +
      parseInt(s, 10);
  } else if (str.includes(":")) {
    // Format: "HH:MM:SS" eller "MM:SS"
    const parts = str.split(":").map(Number);
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else {
      totalSeconds = parts[0] || 0;
    }
  } else {
    // Rent sekund-tal
    const parsed = parseInt(str, 10);
    totalSeconds = isNaN(parsed) ? 0 : parsed;
  }

  if (isNaN(totalSeconds) || totalSeconds < 0) return "ukendt";

  const days  = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins  = Math.floor((totalSeconds % 3600) / 60);
  const secs  = totalSeconds % 60;

  return `${days} d., ${hours} t., ${mins} min., ${secs} sek.`;
}

function formatUbuntuUpdates(client) {
  const raw = client?.ubuntu_updates_available;

  if (raw === null || raw === undefined || raw === "") {
    return "ukendt";
  }

  const count = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(count) || count < 0) {
    return "ukendt";
  }

  if (client?.pending_os_update || client?.state === "updating") {
    return count > 0
      ? `Opdatering i gang (${count} pakke(r))`
      : "Opdatering i gang";
  }

  if (count === 0) {
    return "Ingen opdateringer";
  }

  return `${count} pakke(r) klar`;
}

function getUbuntuUpdateCount(client) {
  const raw = client?.ubuntu_updates_available;
  const count = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

function getUbuntuUpdateColor(client) {
  const count = getUbuntuUpdateCount(client);

  if (client?.pending_os_update || client?.state === "updating") {
    return "error.main";
  }

  if (count === null) {
    return "text.secondary";
  }

  // Grøn når der ikke er opdateringer, rød når der er opdateringer.
  return count > 0 ? "error.main" : "success.main";
}

function formatDateTime(dateStr, withSeconds = false) {
  if (!dateStr) return "ukendt";
  let d;
  if (dateStr.endsWith("Z") || dateStr.match(/[\+\-]\d{2}:?\d{2}$/)) {
    d = new Date(dateStr);
  } else {
    d = new Date(dateStr + "Z");
  }
  // Guard mod Invalid Date
  if (isNaN(d.getTime())) return "ukendt";

  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
    hour:     "2-digit",
    minute:   "2-digit",
    second:   withSeconds ? "2-digit" : undefined,
    hour12:   false,
  });
  const parts  = formatter.formatToParts(d);
  const get    = (type) => parts.find((p) => p.type === type)?.value || "";
  const day    = get("day");
  const month  = get("month");
  const year   = get("year");
  const hour   = get("hour");
  const minute = get("minute");
  const second = get("second");
  return withSeconds
    ? `${day}.${month} ${year}, kl. ${hour}:${minute}:${second}`
    : `${day}.${month} ${year}, kl. ${hour}:${minute}`;
}

// ---------------------------------------------------------------------------
// Delte tabel-styles — factory-funktioner så de ikke duplikeres
// ---------------------------------------------------------------------------

function makeCellStyle(isMobile) {
  return {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
}

function makeValueCellStyle(isMobile) {
  return {
    border: 0,
    pl: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
}

// ---------------------------------------------------------------------------
// Konstanter udenfor komponenter
// ---------------------------------------------------------------------------

const NETWORK_ROWS = [
  { label: "IP-adresse WLAN:",  key: "wifi_ip_address" },
  { label: "MAC-adresse WLAN:", key: "wifi_mac_address" },
  { label: "IP-adresse LAN:",   key: "lan_ip_address" },
  { label: "MAC-adresse LAN:",  key: "lan_mac_address" },
];

const ACTIVE_NETWORK_ROWS = [
  { label: "Aktiv forbindelse:", key: "active_network_type" },
  { label: "Aktiv IP:", key: "active_network_ip" },
  { label: "Aktivt interface:", key: "active_network_interface" },
  { label: "Aktiv MAC:", key: "active_network_mac" },
];

const SERVICE_STATUS_ROWS = [
  { label: "Backend sync:", key: "service_clientflow_status" },
  { label: "Kalender service:", key: "service_calendar_status" },
  { label: "Browser Guard:", key: "service_browser_guard_status" },
  { label: "Remote terminal:", key: "service_remote_terminal_status" },
  { label: "Admin terminal:", key: "service_admin_terminal_status" },
  { label: "Remote desktop:", key: "service_remote_desktop_status" },
  { label: "Kiosk X11 guard:", key: "service_kiosk_x11_guard_status" },
  { label: "Selfupdate:", key: "service_selfupdate_status" },
  { label: "Livestream:", key: "livestream_process_status" },
];

function formatDiagnosticValue(value) {
  const text = String(value ?? "").trim();
  return text || "ukendt";
}

function getServiceStatusColor(value) {
  const s = String(value || "").trim().toLowerCase();
  if (["kører", "aktiv", "klar", "running", "active", "success"].includes(s)) return "success.main";
  if (["stop", "stoppet", "inactive", "idle"].includes(s)) return "text.secondary";
  if (["opdaterer", "starting", "requested", "preparing", "downloading", "installing", "starter"].includes(s)) return "info.main";
  if (["fejl", "failed", "error", "mangler", "not-found"].includes(s)) return "error.main";
  return "warning.main";
}

function hasDiagnosticsReport(client) {
  return !!(
    client?.diagnostics_updated_at ||
    client?.active_network_ip ||
    client?.service_clientflow_status ||
    client?.livestream_process_status
  );
}

function formatNetworkValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "ukendt";
  if (text === "127.0.0.1" || text.startsWith("127.")) return "loopback";
  if (text === "00:00:00:00:00:00") return "ukendt";
  return text;
}

// ---------------------------------------------------------------------------
// Sub-komponenter
// ---------------------------------------------------------------------------

function StatusText({ status, isMobile = false }) {
  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        color: status === "on" ? "#43a047" : "#e53935",
        textTransform: "lowercase",
        fontSize: isMobile ? 12 : undefined,
      }}
    >
      {String(status).toLowerCase()}
    </Typography>
  );
}

function ClientPowerShortTable({ markedDays, isMobile = false }) {
  // useMemo — days-array genskabes ikke ved hver render
  const days = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      return d;
    });
  }, []);

  // useMemo — cellStyle genskabes ikke ved hver render
  const cellStyle = React.useMemo(() => ({
    whiteSpace: "nowrap",
    py: 0,
    px: isMobile ? 1 : 1.625,
    fontSize: isMobile ? 12 : 14,
  }), [isMobile]);

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
            const { status, powerOn, powerOff } =
              getStatusAndTimesFromRaw(markedDays, dt);
            return (
              <TableRow
                key={dt.toISOString().slice(0, 10)}
                sx={{ height: isMobile ? 22 : 30 }}
              >
                <TableCell sx={cellStyle}>{formatDateShort(dt)}</TableCell>
                <TableCell sx={cellStyle}>
                  <StatusText status={status} isMobile={isMobile} />
                </TableCell>
                <TableCell sx={cellStyle}>
                  {status === "on" && powerOn  ? powerOn  : ""}
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

function CopyField({ value, isMobile = false }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!value || value === "ukendt") return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    } catch {
      // ignore
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", lineHeight: isMobile ? "22px" : "30px" }}>
      <span style={{ fontSize: isMobile ? 12 : undefined }}>{value}</span>
      {value && value !== "ukendt" && (
        <Tooltip title={copied ? "Kopieret!" : "Kopier"} arrow>
          <IconButton
            aria-label="kopier"
            onClick={handleCopy}
            size="small"
            sx={{
              ml: 0.5,
              p: 0,
              height: isMobile ? "1em" : "1.4em",
              width:  isMobile ? "1em" : "1.4em",
            }}
          >
            <ContentCopyIcon
              sx={{ fontSize: isMobile ? "0.8em" : "1em", verticalAlign: "middle" }}
            />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function SystemInfoTable({
  client,
  uptime,
  lastSeen,
  isMobile = false,
  clientOnline,
  showSnackbar,
  onUbuntuUpdateStarted,
  onDiagnosticsRefresh,
}) {
  const cellStyle      = React.useMemo(() => makeCellStyle(isMobile),      [isMobile]);
  const valueCellStyle = React.useMemo(() => makeValueCellStyle(isMobile), [isMobile]);

  const [updateStarting, setUpdateStarting] = React.useState(false);
  const [localMessage, setLocalMessage] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const updateCount = getUbuntuUpdateCount(client);
  const isUpdating = !!client?.pending_os_update || client?.state === "updating";
  const isOffline =
    typeof clientOnline !== "undefined"
      ? clientOnline === false
      : client?.isOnline === false;

  React.useEffect(() => {
    if (isOffline || typeof onDiagnosticsRefresh !== "function") return undefined;
    const timer = window.setInterval(() => {
      try { onDiagnosticsRefresh(); } catch {}
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isOffline, onDiagnosticsRefresh]);

  const canRequestUbuntuUpdate =
    !!client?.id &&
    !isOffline &&
    !isUpdating &&
    !updateStarting;

  const closeConfirmDialog = React.useCallback(() => {
    if (!updateStarting) {
      setConfirmOpen(false);
    }
  }, [updateStarting]);

  const openConfirmDialog = React.useCallback(() => {
    if (!canRequestUbuntuUpdate) return;
    setLocalMessage("");
    setConfirmOpen(true);
  }, [canRequestUbuntuUpdate]);

  const handleConfirmUbuntuUpdate = React.useCallback(async () => {
    if (!canRequestUbuntuUpdate) return;

    setUpdateStarting(true);
    setLocalMessage("");

    try {
      await requestUbuntuUpdate(client.id);

      setLocalMessage("Ubuntu-opdatering bestilt");
      setConfirmOpen(false);

      if (typeof showSnackbar === "function") {
        showSnackbar({
          message: "Ubuntu-opdatering bestilt",
          severity: "success",
        });
      }
      if (typeof onUbuntuUpdateStarted === "function") {
        try {
          await onUbuntuUpdateStarted();
        } catch {
          // Ignorer refresh-fejl efter bestilling af Ubuntu-opdatering.
        }
      }
    } catch (err) {
      const message = err?.message || "Kunne ikke starte Ubuntu-opdatering";
      setLocalMessage(message);
      if (typeof showSnackbar === "function") {
        showSnackbar({
          message,
          severity: "error",
        });
      }
    } finally {
      setUpdateStarting(false);
    }
  }, [
    canRequestUbuntuUpdate,
    client?.id,
    showSnackbar,
    onUbuntuUpdateStarted,
  ]);

  const ubuntuUpdateValue = React.useMemo(() => {
    const text = formatUbuntuUpdates(client);
    const showButton = updateCount === null || updateCount > 0 || isUpdating;

    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          lineHeight: isMobile ? "22px" : "30px",
          fontSize: isMobile ? 12 : 14,
          fontFamily: "inherit",
          fontWeight: 400,
        }}
      >
        <Box component="span" sx={{ fontFamily: "inherit", fontWeight: 400 }}>
          {text}
        </Box>

        {showButton && (
          <Button
            size="small"
            variant="outlined"
            color={updateCount > 0 ? "error" : "primary"}
            onClick={openConfirmDialog}
            disabled={!canRequestUbuntuUpdate}
            sx={{
              minHeight: isMobile ? 22 : 26,
              py: 0,
              px: 1,
              fontSize: isMobile ? 11 : 12,
              textTransform: "none",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              fontWeight: 400,
            }}
          >
            {updateStarting ? (
              <>
                <CircularProgress size={12} sx={{ mr: 0.75 }} />
                Starter...
              </>
            ) : isUpdating ? (
              "Opdaterer..."
            ) : (
              "Opdater Ubuntu"
            )}
          </Button>
        )}

        {localMessage && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              color: localMessage.toLowerCase().includes("fejl") || localMessage.toLowerCase().includes("kunne ikke")
                ? "error.main"
                : "success.main",
              fontWeight: 400,
              fontFamily: "inherit",
            }}
          >
            {localMessage}
          </Typography>
        )}
      </Box>
    );
  }, [
    client,
    updateCount,
    isUpdating,
    isMobile,
    openConfirmDialog,
    canRequestUbuntuUpdate,
    updateStarting,
    localMessage,
  ]);

  const confirmPackageText =
    updateCount === null
      ? "Ubuntu-opdateringer"
      : updateCount === 1
        ? "1 pakke"
        : `${updateCount} pakker`;

  // useMemo — rows + dyre format-kald genskabes ikke ved hver render
  const rows = React.useMemo(() => [
    { label: "Ubuntu version:", value: client?.ubuntu_version || "ukendt" },
    {
      label: "Ubuntu opdateringer:",
      value: ubuntuUpdateValue,
      color: getUbuntuUpdateColor(client),
    },
    { label: "Oppetid:",        value: formatUptime(uptime) },
    { label: "Sidst set:",      value: formatDateTime(lastSeen, true) },
    { label: "Tilføjet:",       value: formatDateTime(client?.created_at, true) },
  ], [
    client?.ubuntu_version,
    client?.ubuntu_updates_available,
    client?.pending_os_update,
    client?.state,
    client?.created_at,
    ubuntuUpdateValue,
    uptime,
    lastSeen,
  ]);

  return (
    <>
      <TableContainer>
        <Table size="small" aria-label="systeminfo">
          <TableBody>
            {rows.map(({ label, value, color }) => (
              <TableRow key={label} sx={{ height: isMobile ? 22 : 30 }}>
                <TableCell sx={cellStyle}>{label}</TableCell>
                <TableCell sx={valueCellStyle}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      lineHeight: isMobile ? "22px" : "30px",
                      color: color || "inherit",
                      fontWeight: 400,
                      fontFamily: "inherit",
                    }}
                  >
                    {value}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={confirmOpen}
        onClose={closeConfirmDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Start Ubuntu-opdatering?
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Du er ved at starte Ubuntu-opdatering på denne klient.
          </Typography>

          <Alert severity={updateCount > 0 ? "warning" : "info"} sx={{ mb: 1.5 }}>
            {updateCount > 0
              ? `${confirmPackageText} installeres. Klienten genstarter automatisk, hvis opdateringen kræver det.`
              : "Der er aktuelt ingen registrerede opdateringer, men klienten tjekker igen, når handlingen startes."}
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Klient: {client?.name || client?.id || "ukendt"}
          </Typography>

          {localMessage && (
            <Typography
              variant="body2"
              sx={{
                mt: 1.5,
                color: localMessage.toLowerCase().includes("fejl") || localMessage.toLowerCase().includes("kunne ikke")
                  ? "error.main"
                  : "success.main",
              }}
            >
              {localMessage}
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={closeConfirmDialog}
            color="inherit"
            disabled={updateStarting}
          >
            Annullér
          </Button>
          <Button
            onClick={handleConfirmUbuntuUpdate}
            color="error"
            variant="contained"
            disabled={!canRequestUbuntuUpdate}
          >
            {updateStarting ? (
              <>
                <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                Starter...
              </>
            ) : (
              "Start opdatering"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DiagnosticTableRows({ rows, client, isMobile = false, copy = false, colored = false }) {
  const cellStyle      = React.useMemo(() => makeCellStyle(isMobile),      [isMobile]);
  const valueCellStyle = React.useMemo(() => makeValueCellStyle(isMobile), [isMobile]);

  return rows.map(({ label, key }) => {
    const value = copy ? formatNetworkValue(client?.[key]) : formatDiagnosticValue(client?.[key]);
    return (
      <TableRow key={key} sx={{ height: isMobile ? 22 : 30 }}>
        <TableCell sx={cellStyle}>{label}</TableCell>
        <TableCell sx={valueCellStyle}>
          {copy ? (
            <CopyField value={value} isMobile={isMobile} />
          ) : (
            <Box
              component="span"
              sx={{
                color: colored ? getServiceStatusColor(value) : "inherit",
                fontWeight: colored ? 600 : 400,
                fontSize: isMobile ? 12 : 14,
              }}
            >
              {value}
            </Box>
          )}
        </TableCell>
      </TableRow>
    );
  });
}

function NetworkInfoTable({ client, isMobile = false, showAdvanced = false }) {
  const diagnosticsReported = hasDiagnosticsReport(client);

  return (
    <>
      {!diagnosticsReported && (
        <Alert severity="info" sx={{ mb: 1, fontSize: isMobile ? 12 : undefined }}>
          Klienten har endnu ikke sendt udvidet diagnostics. Tjek at den nyeste
          clientflow_service.py er installeret på klienten, og genstart
          clientflow_service.service.
        </Alert>
      )}
      <TableContainer>
        <Table size="small" aria-label="netværksinfo">
          <TableBody>
            <DiagnosticTableRows rows={ACTIVE_NETWORK_ROWS} client={client} isMobile={isMobile} copy />
          <TableRow>
            <TableCell colSpan={2} sx={{ border: 0, pt: 0.75, pb: 0.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Adaptere
              </Typography>
            </TableCell>
          </TableRow>
          <DiagnosticTableRows rows={NETWORK_ROWS} client={client} isMobile={isMobile} copy />
          {showAdvanced && (
            <>
              <TableRow>
                <TableCell colSpan={2} sx={{ border: 0, pt: 0.75, pb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Servicestatus
                  </Typography>
                </TableCell>
              </TableRow>
              <DiagnosticTableRows rows={SERVICE_STATUS_ROWS} client={client} isMobile={isMobile} colored />
              <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                <TableCell sx={{ ...makeCellStyle(isMobile), color: "text.secondary", fontWeight: 500 }}>
                  Opdateret:
                </TableCell>
                <TableCell sx={{ ...makeValueCellStyle(isMobile), color: "text.secondary" }}>
                  {formatDateTime(client?.diagnostics_updated_at, true)}
                </TableCell>
              </TableRow>
            </>
          )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------------------

export default function ClientDetailsInfoSection({
  client,
  markedDays,
  uptime,
  lastSeen,
  setCalendarDialogOpen,
  clientOnline,
  calendarLoading = false,
  showSnackbar,
  onUbuntuUpdateStarted,
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const isOffline =
    typeof clientOnline !== "undefined"
      ? clientOnline === false
      : client?.isOnline === false;

  const disabledOverlay = React.useMemo(() =>
    isOffline
      ? { opacity: 0.65, filter: "grayscale(20%)", bgcolor: "#fafafa" }
      : {},
    [isOffline]
  );

  const cardSx = React.useMemo(() => ({
    borderRadius: isMobile ? 1 : 2,
    height: "100%",
    ...disabledOverlay,
  }), [isMobile, disabledOverlay]);

  const contentSx = React.useMemo(() => ({
    px: isMobile ? 1 : 2,
    py: isMobile ? 1 : 2,
  }), [isMobile]);

  const headingSx = React.useMemo(() => ({
    fontWeight: 700,
    flexGrow: 1,
    fontSize: isMobile ? 16 : undefined,
  }), [isMobile]);

  return (
    <Grid container spacing={isMobile ? 0.5 : 1}>

      {/* Kalender */}
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={cardSx}>
          <CardContent sx={contentSx}>
            <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
              <Typography variant="h6" sx={headingSx}>
                Kalender
              </Typography>
              {/* Viser spinner mens kalenderdata hentes fra backend */}
              {calendarLoading && (
                <CircularProgress size={14} sx={{ ml: 1 }} />
              )}
              <Tooltip title="Vis kalender for periode">
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
                      borderRadius: isMobile ? 5 : 8,
                    }}
                    onClick={() => setCalendarDialogOpen(true)}
                  >
                    <ArrowForwardIosIcon sx={{ fontSize: isMobile ? 13 : 16 }} />
                  </Button>
                </span>
              </Tooltip>
            </Box>
            <ClientPowerShortTable
              markedDays={markedDays ?? {}}
              isMobile={isMobile}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Systeminfo */}
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={cardSx}>
          <CardContent sx={contentSx}>
            <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
              <Typography variant="h6" sx={headingSx}>
                Systeminfo
              </Typography>
            </Box>
            <SystemInfoTable
              client={client}
              uptime={uptime}
              lastSeen={lastSeen}
              isMobile={isMobile}
              clientOnline={clientOnline}
              showSnackbar={showSnackbar}
              onUbuntuUpdateStarted={onUbuntuUpdateStarted}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Netværksinfo */}
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={cardSx}>
          <CardContent sx={contentSx}>
            <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
              <Typography variant="h6" sx={headingSx}>
                Netværksinfo
              </Typography>
            </Box>
            <NetworkInfoTable client={client} isMobile={isMobile} showAdvanced={isSuperadmin} />
          </CardContent>
        </Card>
      </Grid>

    </Grid>
  );
}
