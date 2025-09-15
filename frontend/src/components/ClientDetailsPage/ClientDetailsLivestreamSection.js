import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography, Button, CircularProgress } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import VideocamIcon from "@mui/icons-material/Videocam";

const LIVE_DELAY_THRESHOLD = 15;      // sekunder for "live"
const MIN_BUFFER_SECONDS = 5;         // sekunder der skal bufferes før visning

export default function ClientDetailsLivestreamSection({ clientId, onRestartStream }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [manifestExists, setManifestExists] = useState(null);
  const [isLive, setIsLive] = useState(true);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setManifestExists(false);
      return;
    }
    setShowVideo(false); // skjul video hvis clientId skifter
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    fetch(hlsUrl, { method: "HEAD" })
      .then(resp => setManifestExists(resp.ok))
      .catch(() => setManifestExists(false));
  }, [clientId]);

  useEffect(() => {
    if (!manifestExists) return;
    setShowVideo(false); // skjul video, start forfra
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
    // Buffer progress event
    const bufferCheck = () => {
      if (video && video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const buffer = bufferedEnd - video.currentTime;
        if (buffer >= MIN_BUFFER_SECONDS) {
          setShowVideo(true);
        }
      }
    };
    video && video.addEventListener("progress", bufferCheck);
    // For nogle streams "progress" ikke kaldes, så poll også:
    const interval = setInterval(bufferCheck, 500);
    // Clean up
    return () => {
      if (hls) hls.destroy();
      hlsRef.current = null;
      video && video.removeEventListener("progress", bufferCheck);
      clearInterval(interval);
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

  if (manifestExists === null) {
    return <Typography variant="body2">Tjekker om stream findes…</Typography>;
  }
  if (!manifestExists) {
    return (
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
            <VideocamIcon color="action" fontSize="large" />
            <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
              Ingen stream tilgængelig.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        {/* Header med "Opdatér stream" til venstre og LIVE/FORSINKET badge til højre */}
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={onRestartStream}
              sx={{ borderRadius: 2 }}
            >
              Opdatér stream
            </Button>
          </Box>
          {isLive ? (
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
          )}
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
          {/* Buffer-vent logik */}
          {!showVideo ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography variant="body2">Bufferer stream...</Typography>
            </Box>
          ) : (
            <>
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
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
