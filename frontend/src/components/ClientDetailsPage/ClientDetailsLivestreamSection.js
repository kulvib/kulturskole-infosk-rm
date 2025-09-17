import React, { useEffect, useState, useRef } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography, Button, Snackbar, Alert, CircularProgress, Stack } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import VideocamIcon from "@mui/icons-material/Videocam";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

/**
 * Polls for manifest existence, returns true once manifest is found (HEAD request ok), false otherwise.
 * Polls every 500ms up to 7 seconds.
 */
function useManifestPolling(clientId, resetKey) {
  const [manifestExists, setManifestExists] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const poll = async () => {
      const url = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8?t=${resetKey}`;
      for (let i = 0; i < 14; ++i) {
        try {
          const resp = await fetch(url, { method: "HEAD" });
          if (resp.ok) {
            setManifestExists(true);
            return;
          }
        } catch {}
        await new Promise(res => setTimeout(res, 500));
        if (cancelled) return;
      }
      setManifestExists(false);
    };
    setManifestExists(false); // reset while polling
    poll();
    return () => { cancelled = true; };
  }, [clientId, resetKey]);

  return manifestExists;
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const [pending, setPending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [resetKey, setResetKey] = useState(Date.now());
  const manifestExists = useManifestPolling(clientId, resetKey);
  const [streamRunning, setStreamRunning] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const getToken = () => localStorage.getItem("token");

  useEffect(() => {
    setStreamRunning(manifestExists);
  }, [manifestExists]);

  // video/HLS.js setup when manifest is found and streamRunning
  useEffect(() => {
    if (!manifestExists || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8?t=${resetKey}`;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS.js error:", data);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    }

    video.muted = true;
    video.autoplay = true;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [manifestExists, clientId, resetKey]);

  const cleanupVideo = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  };

  // -- HER ER DELAYET MELLEM RESET OG START --
  const handleStart = async () => {
    setPending(true);
    try {
      // 1. Reset HLS (slet gamle filer)
      await fetch(
        `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/reset-hls`,
        { method: "POST", headers: { "Authorization": "Bearer " + getToken() } }
      );
      // 2. Vent 400 ms (beskyt mod race condition)
      await new Promise(res => setTimeout(res, 400));

      // 3. Start agent livestream
      await fetch(
        `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/chrome-command`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken(),
          },
          body: JSON.stringify({ action: "livestream_start" }),
        }
      );
      cleanupVideo();
      setResetKey(Date.now());
      setSnackbar({ open: true, message: "Stream startet!", severity: "success" });
      setTimeout(() => setPending(false), 1500);
    } catch (err) {
      setSnackbar({ open: true, message: "Fejl ved start: " + err.message, severity: "error" });
      setPending(false);
    }
  };

  const handleStop = async () => {
    setPending(true);
    try {
      // 1. Stop agent
      await fetch(
        `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/chrome-command`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken(),
          },
          body: JSON.stringify({ action: "livestream_stop" }),
        }
      );
      // 2. Reset HLS (delete manifest/segments)
      await fetch(
        `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/reset-hls`,
        { method: "POST", headers: { "Authorization": "Bearer " + getToken() } }
      );
      cleanupVideo();
      setResetKey(Date.now());
      setSnackbar({ open: true, message: "Stream stoppet og filer slettet!", severity: "success" });
      setPending(false);
    } catch (err) {
      setSnackbar({ open: true, message: "Fejl ved stop: " + err.message, severity: "error" });
      setPending(false);
    }
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box maxWidth={600} mx="auto" mt={3}>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" mb={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleStart}
              disabled={pending}
              startIcon={<FiberManualRecordIcon />}
            >
              Start stream
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleStop}
              disabled={pending || !streamRunning}
              startIcon={<VideocamIcon />}
            >
              Stop stream
            </Button>
            {pending && <CircularProgress size={24} />}
            <Typography variant="caption" sx={{ ml: 2, color: streamRunning ? "green" : "red", fontWeight: "bold" }}>
              {streamRunning ? "LIVE" : "IKKE AKTIV"}
            </Typography>
          </Stack>
          <Box
            sx={{
              p: 2,
              border: "1px solid #eee",
              borderRadius: 2,
              background: "#fafafa",
              textAlign: "center",
              minHeight: "160px",
            }}
          >
            {streamRunning ? (
              <>
                <video
                  ref={videoRef}
                  id="livestream-video"
                  controls
                  autoPlay
                  playsInline
                  muted
                  style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
                  tabIndex={-1}
                  key={resetKey}
                />
                <Box sx={{ mt: 1, display: "flex", justifyContent: "center" }}>
                  <Button
                    onClick={() => {
                      const vid = videoRef.current;
                      if (!vid) return;
                      if (vid.requestFullscreen) vid.requestFullscreen();
                    }}
                    variant="outlined"
                    startIcon={<FullscreenIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    Fuld skærm
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 2 }}>
                <VideocamIcon color="action" fontSize="large" />
                <Typography variant="body2" sx={{ fontWeight: 700, ml: 1, mb: 1 }}>
                  Ingen aktiv stream.
                </Typography>
                {pending ? (
                  <CircularProgress size={24} sx={{ mt: 2 }} />
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    {manifestExists
                      ? "Stream klar til start."
                      : "Venter på at stream starter ..."}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          <Snackbar
            open={snackbar.open}
            autoHideDuration={3500}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </CardContent>
      </Card>
    </Box>
  );
}
