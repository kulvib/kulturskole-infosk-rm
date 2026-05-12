import { useState } from "react";
import { useAuth } from "./auth/authcontext";
import { useNavigate } from "react-router-dom";
import { login, apiUrl } from "./api";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  IconButton,
  InputAdornment,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

// ─── Opmuntrende beskeder mens server vågner ──────────────────────────────────
const SERVER_MESSAGES = [
  { after:  0, msg: "Venter på server..." },
  { after:  7, msg: "Venter stadig...serveren starter op 🔄" },
  { after: 14, msg: "Det tager lidt tid...serveren vågner langsomt ☕" },
  { after: 21, msg: "Næsten der...serveren er ved at komme sig 💤" },
  { after: 28, msg: "Serveren strækker sig og gaber... 🥱" },
  { after: 35, msg: "Den er ved at vågne ⏳" },
  { after: 42, msg: "Hænger lidt i bremsen...hav tålmodighed 😃" },
  { after: 49, msg: "Stadig i gang...du er tålmodig, vi er taknemmelige 🙏" },
  { after: 56, msg: "Det tager lidt længere end normalt... 💪" },
  { after: 63, msg: "Vi er stadig på sagen...giv ikke op! 🚀" },
  { after: 70, msg: "Snart...vi lover! ⚡" },
  { after: 77, msg: "Sidste stræk! Serveren er næsten klar 🏁" },
  { after: 84, msg: "Øjeblik endnu...du er næsten i mål! 🎯" },
];

const TIMEOUT_MS = 90_000; // 90 sekunder total
const RETRY_MS   =  3_000; // pause mellem database-forsøg


// ─── Vent på et endpoint med retry indtil timeout ─────────────────────────────
// Bruges til /health/db som kan svare 503 mens databasen vågner.

async function waitForOk(url, timeoutMs, retryMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const remaining = deadline - Date.now();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(10_000, remaining)),
      });
      if (res.ok) return true;
      // 503/502/504 → prøv igen efter pause
    } catch {
      // timeout eller netværksfejl → prøv igen
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(retryMs, remaining)));
  }

  return false;
}


// ─── LoginPage ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { loginUser } = useAuth();
  const navigate      = useNavigate();

  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const [statusMsg,    setStatusMsg]    = useState("");
  const [loading,      setLoading]      = useState(false);

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatusMsg("");
    setLoading(true);

    const startedAt = Date.now();

    // ── Beskeder skifter via interval — uafhængigt af fetch ──────────────────
    const msgInterval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const current = [...SERVER_MESSAGES]
        .reverse()
        .find((m) => m.after <= elapsed);
      if (current) setStatusMsg(current.msg);
    }, 1000);

    try {
      // ── Trin 1: Vent på server — ét kald med 60 sek timeout ─────────────
      setStatusMsg("Venter på server...");

      const serverRes = await fetch(`${apiUrl}/health`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!serverRes.ok) {
        throw new Error("Serveren svarer ikke — prøv at genindlæse siden.");
      }

      // ── Trin 2: Vent på database — retry ved 503 indtil 60 sek ──────────
      clearInterval(msgInterval);
      setStatusMsg("Venter på database...");

      const dbOk = await waitForOk(
        `${apiUrl}/health/db`,
        TIMEOUT_MS - (Date.now() - startedAt),
        RETRY_MS,
      );

      if (!dbOk) {
        throw new Error("Databasen svarer ikke — prøv at genindlæse siden.");
      }

      // ── Trin 3: Alt klar — send login ────────────────────────────────────
      setStatusMsg("Forbinder...");

      const data = await login(username, password);

      if (data && data.user) {
        setStatusMsg("Login gennemført. Omdirigerer...");
        // Send BÅDE user og access_token — token gemmes i localStorage (Safari-fix)
        loginUser(data.user, data.access_token);
        navigate("/", { replace: true });
      } else if (data && data.access_token) {
        // Baglæns kompatibilitet
        loginUser(data.user || { username }, data.access_token);
        navigate("/", { replace: true });
      } else {
        throw new Error("Uventet svar fra serveren.");
      }
    } catch (err) {
      if (err?.name === "TimeoutError") {
        setError("Serveren svarer ikke — prøv at genindlæse siden.");
      } else if (err?.message?.toLowerCase().includes("failed to fetch")) {
        setError("Kunne ikke oprette forbindelse til serveren. Prøv igen senere.");
      } else if (
        err?.message?.toLowerCase().includes("locked") ||
        err?.message?.toLowerCase().includes("spærret")
      ) {
        setError("Din konto er spærret. Kontakt administrator.");
      } else {
        setError(err?.message || "Ukendt fejl.");
      }
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
      setStatusMsg("");
    }
  };

  const canSubmit = username.trim() !== "" && password !== "";

  return (
    <Box
      sx={{
        minHeight:  "100vh",
        background: "linear-gradient(135deg, #b2fefa 0%, #0ed2f7 100%)",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 1, sm: 0 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p:            { xs: 2, sm: 4 },
          width:        "100%",
          minWidth:     { xs: "unset", sm: 350 },
          maxWidth:     380,
          textAlign:    "center",
          borderRadius: { xs: 2, sm: 3 },
          boxShadow:    { xs: 2, sm: 6 },
        }}
      >
        <Typography
          variant="h5"
          sx={{
            mb:           4,
            fontWeight:   700,
            fontSize:     { xs: "1.23rem", sm: "1.5rem" },
            letterSpacing: 0.08,
          }}
        >
          Infoskærm administration
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
        >
          <TextField
            label="Brugernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            variant="outlined"
            fullWidth
            size={isMobile ? "small" : "medium"}
            inputProps={{ autoComplete: "username" }}
          />
          <TextField
            label="Kodeord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            required
            variant="outlined"
            fullWidth
            size={isMobile ? "small" : "medium"}
            inputProps={{ autoComplete: "current-password" }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((s) => !s)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading || !canSubmit}
            sx={{
              mt:        1,
              fontWeight: 600,
              fontSize:  { xs: "1.05rem", sm: "1.15rem" },
              minHeight: { xs: 38, sm: 44 },
            }}
            fullWidth
            size={isMobile ? "medium" : "large"}
          >
            {loading ? (
              <>
                <CircularProgress size={22} sx={{ mr: 1, verticalAlign: "middle" }} color="inherit" />
                Logger ind...
              </>
            ) : (
              "Log ind"
            )}
          </Button>

          {/* ── Statusbesked mens vi venter ──────────────────────────────── */}
          {statusMsg && !error && (
            <Alert
              severity="info"
              icon={<CircularProgress size={16} />}
              sx={{ mt: 1, textAlign: "left" }}
            >
              {statusMsg}
            </Alert>
          )}

          {/* ── Fejlbesked ───────────────────────────────────────────────── */}
          {error && (
            <Alert severity="error" sx={{ mt: 1, textAlign: "left" }}>
              {error}
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
