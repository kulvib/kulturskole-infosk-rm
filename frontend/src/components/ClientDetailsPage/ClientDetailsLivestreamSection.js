import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography, Button, Snackbar, Alert } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import VideocamIcon from "@mui/icons-material/Videocam";

const LIVE_DELAY_THRESHOLD = 23; // sekunder

export default function ClientDetailsLivestreamSection({
  clientId,
  onRestartStream,
  onStartLivestream,
  onStopLivestream,
  loadingStart,
  loadingStop,
  pendingLivestream // boolean
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestExists, setManifestExists] = useState(null);
  const [isLive, setIsLive] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (!clientId) {
      setManifestExists(false);
      return;
    }
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    fetch(hlsUrl, { method: "HEAD" })
      .then(resp => setManifestExists(resp.ok))
      .catch(() => setManifestExists(false));
  }, [clientId, pendingLivestream]); // opdater når pendingLivestream ændrer sig

  useEffect(() => {
    if (!manifestExists) return;
    let hls;
    const video = videoRef.current;
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    if (Hls.isSupported()) {
      hls = new Hls({
        liveSyncDurationCount: 6,
        maxLiveSyncPlaybackRate: 1,
        lowLatencyMode: false
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    }
    if (video) {
      video.muted = true;
      video.autoplay = true;
      video.play().catch(() => {});
    }
    return () => {
      if (hls) hls.destroy();
      hlsRef.current = null;
    };
  }, [manifestExists, clientId]);

  const checkLive = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (hls && video && hls.liveSyncPosition) {
      const diff = Math.abs(hls.liveSyncPosition - video.currentTime);
      setIsLive(diff < LIVE_DELAY_THRESHOLD);
    } else if (video && video.seekable && video.seekable.length > 0) {
      const liveEdge = video.seekable.end(video.seekable.length - 1);
      const diff = Math.abs(liveEdge - video.currentTime);
      setIsLive(diff < LIVE_DELAY_THRESHOLD);
    } else {
      setIsLive(true);
    }
  }, []);

  useEffect(() => {
    if (!manifestExists) return;
    const interval = setInterval(checkLive, 1000);
    return () => clearInterval(interval);
  }, [manifestExists, checkLive]);

  useEffect(() => {
    if (!manifestExists) return;
    const handler = () => {
      setTimeout(checkLive, 100);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [manifestExists, checkLive]);

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen();
    } else if (video.msRequestFullscreen) {
      video.msRequestFullscreen();
    }
  };

  // Snackbar-håndtering
  const openError = (msg) =>
    setSnackbar({ open: true, message: msg, severity: "error" });
  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({ ...snackbar, open: false });
  };

  // Knapper til Start/Stop stream: fejl vises som snackbar
  const handleStartLivestream = async () => {
    try {
      await onStartLivestream();
    } catch (err) {
      openError(
        (err?.response?.data?.detail) ||
        err?.message ||
        "Fejl: Kunne ikke starte livestream"
      );
    }
  };
  const handleStopLivestream = async () => {
    try {
      await onStopLivestream();
    } catch (err) {
      openError(
        (err?.response?.data?.detail) ||
        err?.message ||
        "Fejl: Kunne ikke stoppe livestream"
      );
    }
  };

  // Hvis vi stadig checker for manifest
  if (manifestExists === null) {
    return <Typography variant="body2">Tjekker om stream findes…</Typography>;
  }

  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        {/* Knappanel med Start, Stop og Opdatér */}
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleStartLivestream}
              disabled={loadingStart || pendingLivestream}
            >
              {manifestExists ? "Genstart livestream" : "Start livestream"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleStopLivestream}
              disabled={loadingStop || !manifestExists || pendingLivestream}
            >
              Stop livestream
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={onRestartStream}
              sx={{ borderRadius: 2 }}
            >
              Opdatér stream
            </Button>
          </Box>
          {manifestExists && (isLive ? (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <FiberManualRecordIcon sx={{ color: "green", fontSize: 16, mr: 0.5 }} />
              <Typography variant="caption" sx={{ color: "green", fontWeight: "bold", letterSpacing: 1 }}>
                LIVE
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <FiberManualRecordIcon sx={{ color: "red", fontSize: 16, mr: 0.5 }} />
              <Typography variant="caption" sx={{ color: "red", fontWeight: "bold", letterSpacing: 1 }}>
                FORSINKET
              </Typography>
            </Box>
          ))}
        </Box>
        {manifestExists ? (
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
              tabIndex={-1}
            />
            <Box sx={{ mt: 1, display: "flex", justifyContent: "center" }}>
              <Button
                onClick={handleFullscreen}
                variant="outlined"
                startIcon={<FullscreenIcon />}
                sx={{ borderRadius: 2 }}
              >
                Fuld skærm
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <VideocamIcon color="action" fontSize="large" />
            <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
              Ingen stream tilgængelig.
            </Typography>
          </Box>
        )}
        {/* Pending-besked */}
        {pendingLivestream && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Livestream-kommando er sendt, afventer agent...
          </Alert>
        )}
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
  );
}
