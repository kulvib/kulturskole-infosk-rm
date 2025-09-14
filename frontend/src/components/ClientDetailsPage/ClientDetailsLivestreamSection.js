import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const [manifestExists, setManifestExists] = useState(null);

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
    } else if (video && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    }
    // Autoplay og muted
    if (video) {
      video.muted = true;
      video.autoplay = true;
      video.play().catch(() => {});
    }
    return () => { if (hls) hls.destroy(); };
  }, [manifestExists, clientId]);

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
            Livestream (HLS)
          </Typography>
        </Box>
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
