import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";

/**
 * Props:
 *   clientId: string (kræves)
 */
export default function ClientDetailsLivestreamSection({ clientId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!clientId) return;
    const video = videoRef.current;
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;

    let hls;
    if (Hls.isSupported()) {
      hls = new Hls({
        liveSyncDurationCount: 6, // Hold spilleren 6 segmenter bagud for robusthed
        maxLiveSyncPlaybackRate: 1, // Afspil aldrig hurtigere end realtime
        lowLatencyMode: false
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [clientId]);

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
            controls
            style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
