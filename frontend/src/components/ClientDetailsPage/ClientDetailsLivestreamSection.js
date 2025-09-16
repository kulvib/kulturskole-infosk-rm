import React, { useEffect, useState, useCallback, useRef } from "react";
import Hls from "hls.js";
import { Card, CardContent, Box, Typography, Button, Snackbar, Alert } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import VideocamIcon from "@mui/icons-material/Videocam";

function ClientDetailsLivestreamStatus({ isOnline, lastSeenAgo, livestreamStatus, livestreamLastSegment, livestreamLastError }) {
  return (
    <Box sx={{ mb: 2, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="caption">
        Agent: <span style={{
          display: "inline-block", width: 10, height: 10, borderRadius: "50%",
          background: isOnline ? "green" : "red", marginRight: 4
        }} /> {isOnline ? "Online" : `Offline (${lastSeenAgo})`}
      </Typography>
      <Typography variant="caption">
        Livestream: <b>{livestreamStatus}</b>
      </Typography>
      <Typography variant="caption">
        Sidste segment: {livestreamLastSegment
          ? new Date(livestreamLastSegment).toLocaleTimeString()
          : "ukendt"}
      </Typography>
      {livestreamLastError && <Alert severity="error">{livestreamLastError}</Alert>}
    </Box>
  );
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const [client, setClient] = useState(null);
  const [manifestExists, setManifestExists] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [pendingLivestream, setPendingLivestream] = useState(false);

  // HLS player refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Helper to get the token from localStorage
  const getToken = () => localStorage.getItem("token");

  const fetchClient = useCallback(async () => {
    const token = getToken();
    const resp = await fetch(
      `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/`,
      {
        headers: {
          "Authorization": "Bearer " + token
        }
      }
    );
    if (!resp.ok) throw new Error("Kunne ikke hente klient");
    const data = await resp.json();
    setClient(data);
  }, [clientId]);

  useEffect(() => {
    fetchClient();
    const interval = setInterval(fetchClient, 4000);
    return () => clearInterval(interval);
  }, [fetchClient]);

  // Manifest check (GET, ikke HEAD)
  useEffect(() => {
    if (!clientId) {
      setManifestExists(false);
      return;
    }
    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    fetch(hlsUrl)
      .then(resp => setManifestExists(resp.ok))
      .catch(() => setManifestExists(false));
  }, [clientId, client?.livestream_status]);

  // Robust HLS.js attach/detach, kun 1 instance, ingen remount, ingen play() race!
  useEffect(() => {
    if (!manifestExists) return;
    const video = videoRef.current;
    if (!video) return;

    // Ryd op hvis gammel HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const hlsUrl = `https://kulturskole-infosk-rm.onrender.com/hls/${clientId}/index.m3u8`;
    let hls;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, debug: false });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS.js error:", data);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.error("video.play error", e));
      });
      hlsRef.current = hls;
    }
    video.muted = true;
    video.autoplay = true;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [manifestExists, clientId]);

  const openError = (msg) => setSnackbar({ open: true, message: msg, severity: "error" });
  const handleCloseSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({ ...snackbar, open: false });
  };

  const handleStartLivestream = async () => {
    setPendingLivestream(true);
    try {
      const token = getToken();
      const resp = await fetch(
        `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/chrome-command`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify({ action: "livestream_start" })
        }
      );
      if (!resp.ok) throw new Error((await resp.json()).detail || "Fejl: Kunne ikke starte livestream");
      setSnackbar({ open: true, message: "Livestream start-kommando sendt!", severity: "success" });
      setTimeout(fetchClient, 2000);
    } catch (err) {
      openError(err.message);
    }
    setTimeout(() => setPendingLivestream(false), 3000);
  };

  const handleStopLivestream = async () => {
    setPendingLivestream(true);
    try {
      const token = getToken();
      const resp = await fetch(
        `https://kulturskole-infosk-rm.onrender.com/api/clients/${clientId}/chrome-command`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify({ action: "livestream_stop" })
        }
      );
      if (!resp.ok) throw new Error((await resp.json()).detail || "Fejl: Kunne ikke stoppe livestream");
      setSnackbar({ open: true, message: "Livestream stop-kommando sendt!", severity: "success" });
      setTimeout(fetchClient, 2000);
    } catch (err) {
      openError(err.message);
    }
    setTimeout(() => setPendingLivestream(false), 3000);
  };

  if (!client) return <Typography>Indlæser klient...</Typography>;

  const isOnline = client.isOnline;
  const lastSeenAgo = client.last_seen ? Math.floor((Date.now() - new Date(client.last_seen).getTime()) / 1000) + " sek siden" : "ukendt";

  return (
    <Box maxWidth={600} mx="auto" mt={3}>
      <ClientDetailsLivestreamStatus
        isOnline={isOnline}
        lastSeenAgo={lastSeenAgo}
        livestreamStatus={client.livestream_status}
        livestreamLastSegment={client.livestream_last_segment}
        livestreamLastError={client.livestream_last_error}
      />
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2, justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartLivestream}
                disabled={pendingLivestream}
              >
                {manifestExists ? "Genstart livestream" : "Start livestream"}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleStopLivestream}
                disabled={pendingLivestream || !manifestExists}
              >
                Stop livestream
              </Button>
            </Box>
            {manifestExists ? (
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
                  INGEN STREAM
                </Typography>
              </Box>
            )}
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
            </Box>
          ) : (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <VideocamIcon color="action" fontSize="large" />
              <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
                Ingen stream tilgængelig.
              </Typography>
            </Box>
          )}
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
    </Box>
  );
}
