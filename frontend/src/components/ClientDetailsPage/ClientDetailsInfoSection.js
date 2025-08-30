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
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

// Online/offline badge, skrifttype og størrelse matcher TableCell
function OnlineStatusBadge({ isOnline }) {
  const color = isOnline ? "#43a047" : "#e53935";
  const text = isOnline ? "Online" : "Offline";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 2 }}>
      <Box sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: color,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
        mr: 1,
      }} />
      <Box sx={{ fontWeight: 400 }}>
        {text}
      </Box>
    </Box>
  );
}

// State badge, skrifttype og størrelse matcher TableCell
function StateBadge({ state }) {
  let dotColor = "grey.400";
  let text = state || "Ukendt";
  if (state) {
    switch (state.toLowerCase()) {
      case "normal": dotColor = "#43a047"; break;
      case "sleep": dotColor = "#1976d2"; break;
      case "maintenance": dotColor = "#ffa000"; break;
      case "error": dotColor = "#e53935"; break;
      case "offline": dotColor = "#757575"; break;
      default: dotColor = "grey.400";
    }
  }
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 2 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: dotColor,
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
          mr: 1,
        }}
      />
      <Box sx={{ fontWeight: 400 }}>
        {text.charAt(0).toUpperCase() + text.slice(1)}
      </Box>
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
function StatusText({ status }) {
  return (
    <Box sx={{
      fontWeight: 600,
      color: status === "on" ? "#43a047" : "#e53935",
      textTransform: "lowercase"
    }}>
      {status}
    </Box>
  );
}
function ClientPowerShortTable({ markedDays }) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  const cellStyle = { whiteSpace: "nowrap", py: 0, px: 1.625 };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ height: 30 }}>
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
              <TableRow key={dt.toISOString().slice(0, 10)} sx={{ height: 30 }}>
                <TableCell sx={cellStyle}>{formatDateShort(dt)}</TableCell>
                <TableCell sx={cellStyle}><StatusText status={status} /></TableCell>
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
  if (dateStr.endsWith("Z") || dateStr.match(/[\+\-]\d{2}:?\d{2}$/)) {
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
  if (uptimeStr.includes('-')) {
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
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${days} d., ${hours} t., ${mins} min., ${secs} sek.`;
}
function SystemInfoTable({ client, uptime, lastSeen }) {
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
  };
  const valueCellStyle = {
    border: 0,
    pl: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="systeminfo">
        <TableBody>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>Ubuntu version:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.ubuntu_version || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>Oppetid:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {formatUptime(uptime)}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>Sidst set:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {formatDateTime(lastSeen, true)}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>Tilføjet:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {formatDateTime(client.created_at, true)}
              </Box>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
function NetworkInfoTable({ client }) {
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
  };
  const valueCellStyle = {
    border: 0,
    pl: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="netværksinfo">
        <TableBody>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>IP-adresse WLAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.wifi_ip_address || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>MAC-adresse WLAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.wifi_mac_address || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>IP-adresse LAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.lan_ip_address || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30 }}>
            <TableCell sx={cellStyle}>MAC-adresse LAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.lan_mac_address || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
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
}) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
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
                      fontSize: "0.85rem",
                      textTransform: "none",
                      px: 1,
                      verticalAlign: "middle",
                      borderRadius: 8
                    }}
                    onClick={() => setCalendarDialogOpen(true)}
                  >
                    <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
                  </Button>
                </span>
              </Tooltip>
            </Box>
            <ClientPowerShortTable markedDays={markedDays} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Systeminfo
              </Typography>
              <StateBadge state={client.state} />
            </Box>
            <SystemInfoTable client={client} uptime={uptime} lastSeen={lastSeen} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Netværksinfo
              </Typography>
              <OnlineStatusBadge isOnline={client.isOnline} />
            </Box>
            <NetworkInfoTable client={client} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
