import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useAuth } from "../../auth/authcontext";
import {
  getClientSecretStatus,
  rotateClientSecret,
  revokeClientSecret,
} from "../../api";

/*
  ClientSecretAdminSection.jsx

  Superadmin-sektion til eksisterende klienters client-secret.

  Formål:
  - Se om klienten har aktiv client-secret.
  - Generér/rotér client-secret.
  - Tilbagekald client-secret.
  - Vise ny secret én gang i en dialog, så den kan kopieres til Ubuntu-klienten.

  Sikkerhed:
  - Backend returnerer kun client_secret ved rotate.
  - Listen/status viser aldrig selve secret'en.
*/

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("da-DK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusChip(status) {
  if (!status) {
    return {
      label: "Ukendt",
      color: "default",
      icon: <WarningAmberIcon fontSize="small" />,
    };
  }

  if (status.has_client_secret) {
    return {
      label: "Aktiv client-secret",
      color: "success",
      icon: <CheckCircleIcon fontSize="small" />,
    };
  }

  if (status.client_secret_revoked_at) {
    return {
      label: "Tilbagekaldt",
      color: "warning",
      icon: <BlockIcon fontSize="small" />,
    };
  }

  return {
    label: "Ingen client-secret",
    color: "default",
    icon: <WarningAmberIcon fontSize="small" />,
  };
}

export default function ClientSecretAdminSection({ clientId, clientName, showSnackbar }) {
  const { isSuperadmin } = useAuth();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [newSecret, setNewSecret] = useState(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const notify = useCallback(
    (message, severity = "success") => {
      if (typeof showSnackbar === "function") {
        showSnackbar({ message, severity });
      }
    },
    [showSnackbar]
  );

  const loadStatus = useCallback(async () => {
    if (!clientId || !isSuperadmin) return;
    setLoading(true);
    try {
      const data = await getClientSecretStatus(clientId);
      setStatus(data);
    } catch (err) {
      notify(err?.message || "Kunne ikke hente client-secret status", "error");
    } finally {
      setLoading(false);
    }
  }, [clientId, isSuperadmin, notify]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const copyText = useCallback(async (text, label = "Kopieret") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify(label, "success");
    } catch {
      notify("Kunne ikke kopiere automatisk. Markér og kopier manuelt.", "warning");
    }
  }, [notify]);

  const handleRotate = useCallback(async () => {
    if (!clientId) return;
    setWorking(true);
    try {
      const data = await rotateClientSecret(clientId);
      setStatus(data);
      setNewSecret(data);
      notify("Ny client-secret genereret", "success");
    } catch (err) {
      notify(err?.message || "Kunne ikke generere client-secret", "error");
    } finally {
      setWorking(false);
    }
  }, [clientId, notify]);

  const handleRevoke = useCallback(async () => {
    if (!clientId) return;
    setWorking(true);
    try {
      const data = await revokeClientSecret(clientId);
      setStatus(data);
      setRevokeOpen(false);
      notify("Client-secret tilbagekaldt", "success");
    } catch (err) {
      notify(err?.message || "Kunne ikke tilbagekalde client-secret", "error");
    } finally {
      setWorking(false);
    }
  }, [clientId, notify]);

  if (!isSuperadmin || !clientId) return null;

  const chip = statusChip(status);
  const hasActiveSecret = !!status?.has_client_secret;

  const installSnippet = newSecret?.client_secret
    ? `CLIENTFLOW_CLIENT_ID=${newSecret.client_id}\nCLIENTFLOW_CLIENT_SECRET=${newSecret.client_secret}`
    : "";

  return (
    <>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "stretch", md: "center" }}
            spacing={1.5}
          >
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <VpnKeyIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Client-secret
                </Typography>
                {loading && <CircularProgress size={18} />}
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Bruges til at lade Ubuntu-klienten logge ind uden admin-password.
                Secret vises kun én gang, når den genereres.
              </Typography>
            </Box>

            <Chip
              icon={chip.icon}
              label={chip.label}
              color={chip.color}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Klient
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                #{status?.client_id ?? clientId} {clientName ? `· ${clientName}` : ""}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Oprettet
              </Typography>
              <Typography variant="body2">
                {formatDateTime(status?.client_secret_created_at)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Tilbagekaldt
              </Typography>
              <Typography variant="body2">
                {formatDateTime(status?.client_secret_revoked_at)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Machine ID
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                {status?.machine_id || "-"}
              </Typography>
            </Box>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ mt: 2 }}
          >
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadStatus}
              disabled={loading || working}
            >
              Opdater status
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<AutorenewIcon />}
              onClick={handleRotate}
              disabled={loading || working}
            >
              {hasActiveSecret ? "Rotér secret" : "Generér secret"}
            </Button>

            <Tooltip title={hasActiveSecret ? "Tilbagekald client-secret" : "Der er ingen aktiv secret"}>
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<BlockIcon />}
                  onClick={() => setRevokeOpen(true)}
                  disabled={!hasActiveSecret || loading || working}
                >
                  Tilbagekald
                </Button>
              </span>
            </Tooltip>
          </Stack>

          <Alert severity="info" sx={{ mt: 2 }}>
            Nye Ubuntu-installationer bruger installationskode. Denne sektion er
            til eksisterende klienter, hvor admin-password skal fjernes fra systemd.
          </Alert>
        </CardContent>
      </Card>

      <Dialog open={!!newSecret?.client_secret} onClose={() => setNewSecret(null)} maxWidth="md" fullWidth>
        <DialogTitle>Ny client-secret genereret</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Secret vises kun her. Kopiér den nu og gem den sikkert, indtil den er
            lagt ind på Ubuntu-klienten.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Brug disse værdier i Ubuntu-klientens <code>/etc/clientflow/clientflow.env</code>:
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: "rgba(0,0,0,0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
            }}
          >
            <Typography
              component="pre"
              sx={{
                flex: 1,
                m: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
              }}
            >
              {installSnippet}
            </Typography>

            <IconButton onClick={() => copyText(installSnippet, "Client-secret kopieret")}>
              <ContentCopyIcon />
            </IconButton>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => copyText(installSnippet, "Client-secret kopieret")} startIcon={<ContentCopyIcon />}>
            Kopiér
          </Button>
          <Button variant="contained" onClick={() => setNewSecret(null)}>
            Luk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={revokeOpen} onClose={() => !working && setRevokeOpen(false)}>
        <DialogTitle>Tilbagekald client-secret?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Klienten kan ikke længere logge ind med sin nuværende client-secret.
            Gør kun dette, hvis klienten skal have en ny secret, eller hvis secret’en
            kan være kompromitteret.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeOpen(false)} disabled={working}>
            Annuller
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleRevoke}
            disabled={working}
          >
            {working ? <CircularProgress size={18} color="inherit" /> : "Tilbagekald"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
