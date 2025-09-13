import React, { useEffect, useRef } from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";

// Helper to generate a unique viewer_id per session
function generateViewerId() {
  return String(Date.now()) + "_" + Math.floor(Math.random() * 100000);
}

export default function ClientDetailsLivestreamSection({ clientId }) {
  const WEBSOCKET_URL = `wss://kulturskole-infosk-rm.onrender.com/ws/livestream/${clientId}`;
  const videoRef = useRef(null);
  const ws = useRef(null);
  const peerRef = useRef(null);
  const viewerIdRef = useRef(generateViewerId());

  useEffect(() => {
    if (!clientId) {
      console.error("Ingen clientId i LivestreamSection!", clientId);
      return;
    }
    viewerIdRef.current = generateViewerId();
    ws.current = new window.WebSocket(WEBSOCKET_URL);

    ws.current.onopen = () => {
      console.log("WebSocket åbnet, sender newViewer", viewerIdRef.current);
      ws.current.send(
        JSON.stringify({
          type: "newViewer",
          viewer_id: viewerIdRef.current,
        })
      );
    };

    ws.current.onerror = (e) => {
      console.error("WebSocket error", e);
    };
    ws.current.onclose = (e) => {
      console.log("WebSocket lukket", e);
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    };

    ws.current.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      console.log("Modtog WebSocket-besked:", msg);

      if (!peerRef.current) {
        // Brug både STUN og TURN, samt tillad direkte forbindelser
        peerRef.current = new window.RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            {
              urls: "turn:openrelay.metered.ca:80",
              username: "openrelayproject",
              credential: "openrelayproject"
            }
          ],
          iceTransportPolicy: "all"
        });
        peerRef.current.ontrack = (e) => {
          console.log("Har modtaget stream!", e.streams[0]);
          if (videoRef.current) {
            videoRef.current.srcObject = e.streams[0];
            // Ekstra log:
            setTimeout(() => {
              console.log("video.srcObject er nu sat til:", videoRef.current.srcObject);
            }, 1000);
          }
        };
        peerRef.current.onicecandidate = (e) => {
          console.log("ICE-candidate fra browser:", e.candidate);
          if (e.candidate) {
            ws.current.send(
              JSON.stringify({
                type: "ice-candidate",
                candidate: e.candidate,
                viewer_id: viewerIdRef.current,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex,
              })
            );
          }
        };
        peerRef.current.oniceconnectionstatechange = () => {
          console.log("ICE state:", peerRef.current.iceConnectionState);
        };
        peerRef.current.onconnectionstatechange = () => {
          console.log("Peer connection state:", peerRef.current.connectionState);
        };
      }
      if (msg.type === "offer") {
        console.log("Modtog offer:", msg.offer);
        await peerRef.current.setRemoteDescription(
          new window.RTCSessionDescription({ type: "offer", sdp: msg.offer })
        );
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        ws.current.send(
          JSON.stringify({
            type: "answer",
            answer: { sdp: answer.sdp, type: answer.type },
            viewer_id: viewerIdRef.current,
          })
        );
        console.log("Sendte answer til backend");
      }
      if (msg.type === "ice-candidate" && msg.candidate) {
        try {
          console.log("Tilføjer ice-candidate fra backend", msg.candidate);
          await peerRef.current.addIceCandidate(
            new window.RTCIceCandidate(msg.candidate)
          );
        } catch (err) {
          console.error("Fejl ved addIceCandidate", err);
        }
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      if (peerRef.current) peerRef.current.close();
    };
    // eslint-disable-next-line
  }, [clientId]);

  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
          <VideocamIcon color="action" fontSize="large" />
          <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
            Livestream for klient {clientId}
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
