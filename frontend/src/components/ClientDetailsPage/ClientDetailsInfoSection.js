import React from "react";
import { Grid, Card, CardContent, Box, Typography, Button, Tooltip, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ClientPowerShortTable from "./ClientPowerShortTable";

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

function CopyIconButton({ value, disabled, iconSize = 16 }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {}
  };

  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <Button
          variant="text"
          size="small"
          onClick={handleCopy}
          disabled={disabled}
          sx={{
            minWidth: 24,
            minHeight: 24,
            p: 0,
            m: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            verticalAlign: "middle"
          }}
        >
          <span style={{ fontSize: iconSize }}>{copied ? "✅" : "📋"}</span>
        </Button>
      </span>
    </Tooltip>
  );
}

function SystemAndNetworkInfoTable({ client, uptime, lastSeen }) {
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
    <>
      {/* Systeminfo */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Systeminfo
      </Typography>
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
      {/* Netværksinfo */}
      <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
        Netværksinfo
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="netværksinfo">
          <TableBody>
            <TableRow sx={{ height: 30 }}>
              <TableCell sx={cellStyle}>IP-adresse WLAN:</TableCell>
              <TableCell sx={valueCellStyle}>
                <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                  {client.wifi_ip_address || "ukendt"}
                  <CopyIconButton value={client.wifi_ip_address || "ukendt"} disabled={!client.wifi_ip_address} iconSize={14} />
                </Box>
              </TableCell>
            </TableRow>
            <TableRow sx={{ height: 30 }}>
              <TableCell sx={cellStyle}>MAC-adresse WLAN:</TableCell>
              <TableCell sx={valueCellStyle}>
                <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                  {client.wifi_mac_address || "ukendt"}
                  <CopyIconButton value={client.wifi_mac_address || "ukendt"} disabled={!client.wifi_mac_address} iconSize={14} />
                </Box>
              </TableCell>
            </TableRow>
            <TableRow sx={{ height: 30 }}>
              <TableCell sx={cellStyle}>IP-adresse LAN:</TableCell>
              <TableCell sx={valueCellStyle}>
                <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                  {client.lan_ip_address || "ukendt"}
                  <CopyIconButton value={client.lan_ip_address || "ukendt"} disabled={!client.lan_ip_address} iconSize={14} />
                </Box>
              </TableCell>
            </TableRow>
            <TableRow sx={{ height: 30 }}>
              <TableCell sx={cellStyle}>MAC-adresse LAN:</TableCell>
              <TableCell sx={valueCellStyle}>
                <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                  {client.lan_mac_address || "ukendt"}
                  <CopyIconButton value={client.lan_mac_address || "ukendt"} disabled={!client.lan_mac_address} iconSize={14} />
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default function ClientDetailsInfoSection({
  client,
  markedDays,
  calendarDialogOpen,
  setCalendarDialogOpen,
}) {
  return (
    <Grid container spacing={2}>
      {/* Kalender paper */}
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
      {/* Systeminfo og Netværksinfo samlet paper */}
      <Grid item xs={12} md={8}>
        <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
          <CardContent>
            <SystemAndNetworkInfoTable client={client} uptime={client.uptime} lastSeen={client.last_seen} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
