import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from "@mui/material";

function LiveIndicator() {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 1 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          bgcolor: "#2ecc40",
          boxShadow: "0 0 6px 2px #2ecc40",
          mr: 1,
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: "bold", color: "#2ecc40" }}>
        LIVE
      </Typography>
    </Box>
  );
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestReady, setManifestReady] = useState(false);
  const [error, setError] = useState("");
  const [lastLive, setLastLive] = useState(null);

  // STOP STREAM & RYD OP VED UNLOAD
  useEffect(() => {
    if (!clientId) return;

    function cleanupStream() {
      navigator.sendBeacon(
        `/api/clients/${clientId}/stop-hls`
      );
    }

    window.addEventListener("beforeunload", cleanupStream);
    return () => {
      window.removeEventListener("beforeunload", cleanupStream);
      cleanupStream(); // også ved unmount
    };
  }, [clientId]);

  // Polls for manifest, and handles auto-reconnect
  useEffect(() => {
    if (!clientId) return;
    const video = videoRef.current;
    // ----------- HER ER RETTELSEN: brug absolut URL med backend-domænet -----------
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;

    let hls;
    let manifestChecked = false;
    let stopPolling = false;
    let pollInterval;

    // Helper: start HLS playback
    const startPlayback = () => {
      setError("");
      setManifestReady(true);
      setLastLive(new Date());
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
      } else if (Hls.isSupported()) {
        hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setError("Streamen blev afbrudt. Prøver igen ...");
            setManifestReady(false);
            cleanup();
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
    };

    // Helper: cleanup HLS/video
    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };

    // Poll for manifest
    const poll = async () => {
      try {
        const resp = await fetch(hlsUrl, { method: "HEAD" });
        if (resp.ok) {
          if (!manifestChecked) {
            manifestChecked = true;
            setError("");
            setManifestReady(true);
            startPlayback();
          }
        } else {
          throw new Error("404");
        }
      } catch (e) {
        if (manifestChecked) {
          setError("Streamen blev afbrudt eller forsvandt. Prøver igen ...");
          setManifestReady(false);
          cleanup();
        } else {
          setError("Kan ikke finde livestream endnu.");
        }
        manifestChecked = false;
      }
    };

    poll();
    pollInterval = setInterval(() => {
      if (stopPolling) return;
      poll();
    }, manifestReady ? 5000 : 1000);

    return () => {
      stopPolling = true;
      clearInterval(pollInterval);
      cleanup();
    };
  }, [clientId]);

  // Opdater Sidst set live hvert 5. sekund så længe streamen er live
  useEffect(() => {
    let interval;
    if (manifestReady) {
      setLastLive(new Date());
      interval = setInterval(() => {
        setLastLive(new Date());
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [manifestReady]);

  return (
    <Box maxWidth={600} mx="auto" mt={3}>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">
              Livestream
            </Typography>
            {manifestReady && <LiveIndicator />}
          </Box>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {!manifestReady && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                {error ? "Prøver igen ..." : "Venter på livestream ..."}
              </Typography>
            </Box>
          )}
          <video
            ref={videoRef}
            id="livestream-video"
            controls
            autoPlay
            playsInline
            muted
            style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, display: manifestReady ? "block" : "none" }}
            tabIndex={-1}
          />
          {lastLive && (
            <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 2 }}>
              Sidst set live: {lastLive.toLocaleTimeString()}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
