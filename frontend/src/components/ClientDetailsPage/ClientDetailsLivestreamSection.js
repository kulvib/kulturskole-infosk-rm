import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import { Box, Card, CardContent, Typography, CircularProgress, Button } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

/**
 * Viser en HLS-stream automatisk når komponenten loades.
 * Starter video-afspilning så snart manifestet findes.
 * Ingen knapper, ingen polling, ingen start/stop.
 */
export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (!clientId) return;
    const video = videoRef.current;
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;

    let hls;
    let manifestChecked = false;
    let interval;

    // Simpel polling indtil manifest findes, derefter start afspilning
    const checkManifestAndStart = async () => {
      try {
        const resp = await fetch(hlsUrl, { method: "HEAD" });
        if (resp.ok) {
          manifestChecked = true;
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = hlsUrl;
          } else if (Hls.isSupported()) {
            hls = new Hls();
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
          video.playsInline = true;
          clearInterval(interval);
        }
      } catch (e) {
        // ignore
      }
    };

    interval = setInterval(() => {
      if (!manifestChecked) checkManifestAndStart();
    }, 1000);

    return () => {
      clearInterval(interval);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, [clientId]);

  return (
    <Box maxWidth={600} mx="auto" mt={3}>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Livestream
          </Typography>
          <video
            ref={videoRef}
            id="livestream-video"
            controls
            autoPlay
            playsInline
            muted
            style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
            tabIndex={-1}
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
        </CardContent>
      </Card>
    </Box>
  );
}
