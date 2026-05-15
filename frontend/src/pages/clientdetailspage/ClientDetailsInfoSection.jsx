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
  useMediaQuery,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";

/*
  ClientDetailsInfoSection.jsx

  FIX: getStatusAndTimesFromRaw søger nu på både:
    - "YYYY-MM-DDT00:00:00" (backend-format)
    - "YYYY-MM-DD"          (kort format, bruges af ClientCalendarDialog)
    - Prefix-match          (robusthed mod ekstra tegn i nøglen)
  Dette sikrer at kalendertabellen viser korrekte data uanset
  hvilket format backend returnerer nøglerne i.

  FIX: formatUptime håndterer rent sekund-tal fra lokal ticker
  samt D-HH:MM:SS, HH:MM:SS og MM:SS formater.
*/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(dt) {
  const ukedage = [
    "Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag",
  ];
  const dayName = ukedage[dt.getDay()];
  const day = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  const year = dt.getFullYear();
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
  const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getDate().toString().padStart(2, "0");
  const dateKeyFull = `${yyyy}-${mm}-${dd}T00:00:00`;
  const dateKeyShort = `${yyyy}-${mm}-${dd}`;

  const data =
    markedDays[dateKeyFull] ||
    markedDays[dateKeyShort] ||
    Object.entries(markedDays).find(([k]) =>
      k.startsWith(dateKeyShort)
    )?.[1];

  if (!data || !data.status || data.status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }
  return {
    status: "on",
    powerOn: data.onTime || "",
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

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${days} d., ${hours} t., ${mins} min., ${secs} sek.`;
}

function formatDateTime(dateStr, withSeconds = false) {
  if (!dateStr) return "ukendt";
  let d;
  if (
    dateStr.endsWith("Z") ||
    dateStr.match(/[\+\-]\d{2}:?\d{2}$/)
  ) {
    d = new Date(dateStr);
  } else {
    d = new Date(dateStr + "Z");
  }
  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  return withSeconds
    ? `${day}.${month} ${year}, kl. ${hour}:${minute}:${second}`
    : `${day}.${month} ${year}, kl. ${hour}:${minute}`;
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
  const days = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }

  const cellStyle = {
    whiteSpace: "nowrap",
    py: 0,
    px: isMobile ? 1 : 1.625,
    fontSize: isMobile ? 12 : 14,
  };

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
                <TableCell sx={cellStyle}>
                  {formatDateShort(dt)}
                </TableCell>
                <TableCell sx={cellStyle}>
                  <StatusText status={status} isMobile={isMobile} />
                </TableCell>
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        lineHeight: isMobile ? "22px" : "30px",
      }}
    >
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
              width: isMobile ? "1em" : "1.4em",
            }}
          >
            <ContentCopyIcon
              sx={{
                fontSize: isMobile ? "0.8em" : "1em",
                verticalAlign: "middle",
              }}
            />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function SystemInfoTable({ client, uptime, lastSeen, isMobile = false }) {
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

  const rows = [
    {
      label: "Ubuntu version:",
      value: client?.ubuntu_version || "ukendt",
      copy: false,
    },
    {
      label: "Oppetid:",
      value: formatUptime(uptime),
      copy: false,
    },
    {
      label: "Sidst set:",
      value: formatDateTime(lastSeen, true),
      copy: false,
    },
    {
      label: "Tilføjet:",
      value: formatDateTime(client?.created_at, true),
      copy: false,
    },
  ];

  return (
    <TableContainer>
      <Table size="small" aria-label="systeminfo">
        <TableBody>
          {rows.map(({ label, value }) => (
            <TableRow key={label} sx={{ height: isMobile ? 22 : 30 }}>
              <TableCell sx={cellStyle}>{label}</TableCell>
              <TableCell sx={valueCellStyle}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    lineHeight: isMobile ? "22px" : "30px",
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
  );
}

function NetworkInfoTable({ client, isMobile = false }) {
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

  const rows = [
    { label: "IP-adresse WLAN:", key: "wifi_ip_address" },
    { label: "MAC-adresse WLAN:", key: "wifi_mac_address" },
    { label: "IP-adresse LAN:", key: "lan_ip_address" },
    { label: "MAC-adresse LAN:", key: "lan_mac_address" },
  ];

  return (
    <TableContainer>
      <Table size="small" aria-label="netværksinfo">
        <TableBody>
          {rows.map(({ label, key }) => (
            <TableRow key={key} sx={{ height: isMobile ? 22 : 30 }}>
              <TableCell sx={cellStyle}>{label}</TableCell>
              <TableCell sx={valueCellStyle}>
                <CopyField
                  value={client?.[key] || "ukendt"}
                  isMobile={isMobile}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
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
  calendarDialogOpen,
  setCalendarDialogOpen,
  clientOnline,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const isOffline =
    typeof clientOnline !== "undefined"
      ? clientOnline === false
      : client?.isOnline === false;

  const disabledOverlay = isOffline
    ? { opacity: 0.65, filter: "grayscale(20%)", bgcolor: "#fafafa" }
    : {};

  const cardSx = {
    borderRadius: isMobile ? 1 : 2,
    height: "100%",
    ...disabledOverlay,
  };

  const contentSx = {
    px: isMobile ? 1 : 2,
    py: isMobile ? 1 : 2,
  };

  const headingSx = {
    fontWeight: 700,
    flexGrow: 1,
    fontSize: isMobile ? 16 : undefined,
  };

  return (
    <Grid container spacing={isMobile ? 0.5 : 1}>
      {/* Kalender */}
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={cardSx}>
          <CardContent sx={contentSx}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mb: isMobile ? 0.5 : 1,
              }}
            >
              <Typography variant="h6" sx={headingSx}>
                Kalender
              </Typography>
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
                    <ArrowForwardIosIcon
                      sx={{ fontSize: isMobile ? 13 : 16 }}
                    />
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
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mb: isMobile ? 0.5 : 1,
              }}
            >
              <Typography variant="h6" sx={headingSx}>
                Systeminfo
              </Typography>
            </Box>
            <SystemInfoTable
              client={client}
              uptime={uptime}
              lastSeen={lastSeen}
              isMobile={isMobile}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Netværksinfo */}
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={cardSx}>
          <CardContent sx={contentSx}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mb: isMobile ? 0.5 : 1,
              }}
            >
              <Typography variant="h6" sx={headingSx}>
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
