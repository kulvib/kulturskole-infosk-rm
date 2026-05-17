import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { useAuth } from "../../auth/authcontext";
import {
  createEnrollmentToken,
  getEnrollmentTokens,
  revokeEnrollmentToken,
} from "../../api";

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

function isExpired(token) {
  if (!token?.expires_at) return false;
  const d = new Date(token.expires_at);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function getTokenStatus(token) {
  if (token?.revoked_at) {
    return { label: "Tilbagekaldt", color: "default", icon: <BlockIcon fontSize="small" /> };
  }
  if (token?.used_at) {
    return { label: "Brugt", color: "success", icon: <CheckCircleIcon fontSize="small" /> };
  }
  if (isExpired(token)) {
    return { label: "Udløbet", color: "warning", icon: <ScheduleIcon fontSize="small" /> };
  }
  return { label: "Aktiv", color: "primary", icon: <VpnKeyIcon fontSize="small" /> };
}

function tokenClientText(token) {
  const id = token?.used_by_client_id ?? token?.client_id ?? null;
  if (!id) return "-";
  return `Klient #${id}`;
}

export default function EnrollmentTokensPage() {
  const { user, isSuperadmin } = useAuth();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState("72");
  const [note, setNote] = useState("");

  const [newCode, setNewCode] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const showSnackbar = useCallback((message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const closeSnackbar = useCallback((_event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEnrollmentTokens();
      setTokens(Array.isArray(data) ? data : []);
    } catch (err) {
      showSnackbar(err?.message || "Kunne ikke hente installationskoder", "error");
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const activeCount = useMemo(
    () => tokens.filter((t) => !t.used_at && !t.revoked_at && !isExpired(t)).length,
    [tokens]
  );

  const usedCount = useMemo(
    () => tokens.filter((t) => !!t.used_at).length,
    [tokens]
  );

  const handleCopy = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showSnackbar("Kopieret til udklipsholder");
    } catch {
      showSnackbar("Kunne ikke kopiere automatisk. Markér og kopier manuelt.", "warning");
    }
  }, [showSnackbar]);

  const handleCreate = useCallback(async () => {
    const hours = Number.parseInt(expiresInHours, 10);
    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      showSnackbar("Udløb skal være mellem 1 og 720 timer", "warning");
      return;
    }

    setCreating(true);
    try {
      const created = await createEnrollmentToken({
        expires_in_hours: hours,
        note: note.trim() || null,
      });

      setNewCode(created);
      setCreateOpen(false);
      setExpiresInHours("72");
      setNote("");
      showSnackbar("Installationskode oprettet");
      await loadTokens();
    } catch (err) {
      showSnackbar(err?.message || "Kunne ikke oprette installationskode", "error");
    } finally {
      setCreating(false);
    }
  }, [expiresInHours, note, loadTokens, showSnackbar]);

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget?.id) return;
    setRevokingId(revokeTarget.id);
    try {
      await revokeEnrollmentToken(revokeTarget.id);
      showSnackbar("Installationskode tilbagekaldt");
      setRevokeTarget(null);
      await loadTokens();
    } catch (err) {
      showSnackbar(err?.message || "Kunne ikke tilbagekalde installationskode", "error");
    } finally {
      setRevokingId(null);
    }
  }, [revokeTarget, loadTokens, showSnackbar]);

  if (!isSuperadmin) {
    return (
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
        <Alert severity="error">
          Kun superadministratorer kan administrere installationskoder.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "center" }}
          spacing={1.5}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Installationskoder
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Opret engangskoder til nye Ubuntu-klienter. Kunden indtaster kun
              installationskoden samt eventuelt navn og lokation.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadTokens}
            disabled={loading}
          >
            Opdater
          </Button>

          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Opret kode
          </Button>
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card elevation={1} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Aktive koder
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {activeCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card elevation={1} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Brugte koder
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {usedCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card elevation={1} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Logget ind som
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {user?.full_name || user?.username || "Superadmin"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Alert severity="info">
          Installationskoden vises kun fuldt ved oprettelse. I listen kan du se
          status, udløb og hvilken klient koden eventuelt blev brugt til.
        </Alert>

        <Paper elevation={1} sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, flex: 1 }}>
              Koder
            </Typography>
            {loading && <CircularProgress size={22} />}
          </Box>

          <Divider />

          {tokens.length === 0 && !loading ? (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">
                Ingen installationskoder endnu.
              </Typography>
            </Box>
          ) : (
            <Stack divider={<Divider />}>
              {tokens.map((token) => {
                const status = getTokenStatus(token);
                const canRevoke = !token.used_at && !token.revoked_at && !isExpired(token);

                return (
                  <Box
                    key={token.id}
                    sx={{
                      p: 2,
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "110px 1fr 150px 160px 130px",
                      },
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Chip
                        size="small"
                        color={status.color}
                        icon={status.icon}
                        label={status.label}
                      />
                    </Box>

                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {token.note || "Ingen note"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Oprettet: {formatDateTime(token.created_at)}
                      </Typography>
                      {token.revoked_at && (
                        <Typography variant="body2" color="text.secondary">
                          Tilbagekaldt: {formatDateTime(token.revoked_at)}
                        </Typography>
                      )}
                      {token.used_at && (
                        <Typography variant="body2" color="text.secondary">
                          Brugt: {formatDateTime(token.used_at)}
                        </Typography>
                      )}
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Udløber
                      </Typography>
                      <Typography variant="body2">
                        {formatDateTime(token.expires_at)}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Oprettet klient
                      </Typography>
                      <Typography variant="body2">
                        {tokenClientText(token)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: { md: "flex-end" } }}>
                      <Tooltip title={canRevoke ? "Tilbagekald kode" : "Kan ikke tilbagekaldes"}>
                        <span>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<BlockIcon />}
                            disabled={!canRevoke || revokingId === token.id}
                            onClick={() => setRevokeTarget(token)}
                          >
                            Revoke
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Stack>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opret installationskode</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <DialogContentText>
              Koden kan bruges én gang af en ny Ubuntu-klient. Kunden kan
              indtaste navn og lokation under installationen, men det kan altid
              ændres bagefter i frontenden.
            </DialogContentText>

            <TextField
              label="Udløb i timer"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              type="number"
              inputProps={{ min: 1, max: 720 }}
              fullWidth
            />

            <TextField
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fx Kunde X - foyer"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Annuller
          </Button>
          <Button onClick={handleCreate} variant="contained" disabled={creating}>
            {creating ? <CircularProgress size={18} color="inherit" /> : "Opret kode"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!newCode} onClose={() => setNewCode(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Installationskode oprettet</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Koden vises kun fuldt her. Kopiér den nu og send den sikkert til kunden.
          </Alert>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: "rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography
              sx={{
                flex: 1,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontWeight: 800,
                fontSize: { xs: "1rem", md: "1.25rem" },
                wordBreak: "break-all",
              }}
            >
              {newCode?.code}
            </Typography>

            <IconButton onClick={() => handleCopy(newCode?.code)}>
              <ContentCopyIcon />
            </IconButton>
          </Paper>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Udløber: {formatDateTime(newCode?.expires_at)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleCopy(newCode?.code)} startIcon={<ContentCopyIcon />}>
            Kopiér
          </Button>
          <Button variant="contained" onClick={() => setNewCode(null)}>
            Luk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)}>
        <DialogTitle>Tilbagekald installationskode?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Koden kan ikke længere bruges til installation, når den er tilbagekaldt.
          </DialogContentText>
          {revokeTarget?.note && (
            <Typography sx={{ mt: 2, fontWeight: 700 }}>
              {revokeTarget.note}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)} disabled={!!revokingId}>
            Annuller
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleRevoke}
            disabled={!!revokingId}
          >
            Tilbagekald
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
