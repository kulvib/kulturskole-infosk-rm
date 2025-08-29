import React, { useState, useEffect } from "react";
import {
  Card, CardContent, Box, Typography, Table, TableBody, TableCell, TableContainer, TableRow,
  Button, TextField, Tooltip, CircularProgress
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { updateClient, pushKioskUrl } from "../../api";
import ClientStatusIcon from "./ClientStatusIcon";
import ChromeStatusIcon from "./ChromeStatusIcon";
import CopyIconButton from "./CopyIconButton";

export default function ClientDetailsHeader({
  client,
  refreshing,
  handleRefresh,
  showSnackbar,
}) {
  const [locality, setLocality] = useState(client.locality || "");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState(client.kiosk_url || "");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [liveChromeStatus, setLiveChromeStatus] = useState(client.chrome_status || "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client.chrome_color || null);

  const navigate = useNavigate();

  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
      setLiveChromeStatus(client.chrome_status || "unknown");
      setLiveChromeColor(client.chrome_color || null);
    }
    // eslint-disable-next-line
  }, [client]);

  const inputStyle = {
    width: 300,
    height: 32,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "32px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "32px" },
  };
  const kioskInputStyle = {
    width: 550,
    height: 32,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "32px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "32px" },
  };

  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      await updateClient(client.id, { locality });
      setLocalityDirty(false);
      showSnackbar("Lokation gemt!", "success");
    } catch (err) {
      showSnackbar("Kunne ikke gemme lokation: " + err.message, "error");
    }
    setSavingLocality(false);
  };

  const handleKioskUrlChange = (e) => {
    setKioskUrl(e.target.value);
    setKioskUrlDirty(true);
  };
  const handleKioskUrlSave = async () => {
    setSavingKioskUrl(true);
    try {
      await pushKioskUrl(client.id, kioskUrl);
      setKioskUrlDirty(false);
      showSnackbar("Kiosk webadresse opdateret!", "success");
    } catch (err) {
      showSnackbar("Kunne ikke opdatere kiosk webadresse: " + err.message, "error");
    }
    setSavingKioskUrl(false);
  };

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/clients")}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              minWidth: 0,
              px: 2,
            }}
          >
            Tilbage til klientoversigt
          </Button>
          <Tooltip title="Opdater klient">
            <span>
              <Button
                startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshIcon fontSize="medium" />}
                disabled={refreshing}
                color="primary"
                onClick={handleRefresh}
                sx={{ fontWeight: 500, textTransform: "none", minWidth: 0, mr: 1, px: 2 }}
              >
                {refreshing ? "Opdaterer..." : "Opdater"}
              </Button>
            </span>
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: 0.5,
              fontSize: { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
            }}
          >
            {client.name}
          </Typography>
          <Box sx={{ ml: 2 }}>
            <ClientStatusIcon isOnline={client.isOnline} />
          </Box>
        </Box>
        <Box mt={2}>
          <TableContainer>
            <Table size="small" aria-label="client-details">
              <TableBody>
                <TableRow sx={{ height: 40 }}>
                  <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    Klient ID:
                  </TableCell>
                  <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    <Box sx={{ display: "flex", alignItems: "center", lineHeight: "40px" }}>
                      <Typography 
                        variant="body2" 
                        sx={{ color: "text.primary", fontWeight: 700, fontSize: "0.9rem", display: "inline" }}
                      >
                        {client.id}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ height: 40 }}>
                  <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    Lokation:
                  </TableCell>
                  <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    <Box sx={{
                      display: "flex",
                      alignItems: "center",
                      lineHeight: "40px",
                      gap: "8px"
                    }}>
                      <TextField
                        size="small"
                        value={locality}
                        onChange={handleLocalityChange}
                        sx={inputStyle}
                        disabled={savingLocality}
                      />
                      <CopyIconButton value={locality} disabled={!locality} iconSize={15} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleLocalitySave}
                        disabled={savingLocality}
                        sx={{ minWidth: 44, maxWidth: 44 }}
                      >
                        {savingLocality ? <CircularProgress size={16} /> : "Gem"}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ height: 40 }}>
                  <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    Kiosk URL:
                  </TableCell>
                  <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    <Box sx={{
                      display: "flex",
                      alignItems: "center",
                      lineHeight: "40px",
                      gap: "8px"
                    }}>
                      <TextField
                        size="small"
                        value={kioskUrl}
                        onChange={handleKioskUrlChange}
                        sx={kioskInputStyle}
                        disabled={savingKioskUrl}
                      />
                      <CopyIconButton value={kioskUrl} disabled={!kioskUrl} iconSize={15} />
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={handleKioskUrlSave}
                        disabled={savingKioskUrl}
                        sx={{ minWidth: 44, maxWidth: 44 }}
                      >
                        {savingKioskUrl ? <CircularProgress size={16} /> : "Gem"}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ height: 40 }}>
                  <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    Kiosk browser status:
                  </TableCell>
                  <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", lineHeight: "40px" }}>
                      <ChromeStatusIcon status={liveChromeStatus} color={liveChromeColor} />
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
