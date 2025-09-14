import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // To retain Hls instance
  const [manifestExists, setManifestExists] = useState(null);
  const [isLive, setIsLive] = useState(true);

  // Check if manifest exists
  useEffect(() => {
    if (!clientId) {
      setManifestExists(false);
      return;
    }
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    fetch(hlsUrl, { method: "HEAD" })
      .then(resp => setManifestExists(resp.ok))
      .catch(() => setManifestExists(false));
  }, [clientId]);

  // Setup HLS and video
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
    // Autoplay and muted
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

  // LIVE edge detection - now uses <5 seconds as "LIVE"
  useEffect(() => {
    if (!manifestExists) return;
    let interval;
    const checkLive = () => {
      const video = videoRef.current;
      const hls = hlsRef.current;
      if (hls && video && hls.liveSyncPosition) {
        // Difference between live edge and current time
        const diff = Math.abs(hls.liveSyncPosition - video.currentTime);
        setIsLive(diff < 5); // Show LIVE if within 5 seconds of live edge
      } else if (video && video.seekable && video.seekable.length > 0) {
        // Fallback for native HLS (iOS/Safari)
        const liveEdge = video.seekable.end(video.seekable.length - 1);
        const diff = Math.abs(liveEdge - video.currentTime);
        setIsLive(diff < 5);
      } else {
        setIsLive(true); // Default to LIVE if uncertain
      }
    };
    interval = setInterval(checkLive, 1000);
    return () => clearInterval(interval);
  }, [manifestExists]);

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

  if (manifestExists === null) {
    return <Typography variant="body2">Tjekker om livestream findes…</Typography>;
  }
  if (!manifestExists) {
    return (
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
            <VideocamIcon color="action" fontSize="large" />
            <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
              Livestream
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Ingen live stream tilgængelig.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
          <VideocamIcon color="action" fontSize="large" />
          <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
            Livestream
          </Typography>
        </Box>
        {/* LIVE-badge only if at live edge */}
        {isLive && (
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <FiberManualRecordIcon sx={{ color: "red", fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption" sx={{ color: "red", fontWeight: "bold", letterSpacing: 1 }}>
              LIVE
            </Typography>
          </Box>
        )}
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
      </CardContent>
    </Card>
  );
}
