import React, { useEffect, useRef } from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";

export default function ClientDetailsLivestreamSection({ clientId }) {
  const WEBSOCKET_URL = `wss://kulturskole-infosk-rm.onrender.com/ws/livestream/${clientId}`;
  const videoRef = useRef(null);
  const ws = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    if (!clientId) return;
    ws.current = new window.WebSocket(WEBSOCKET_URL);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: "viewer" }));
    };

    ws.current.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (!peerRef.current) {
        peerRef.current = new window.RTCPeerConnection();
        peerRef.current.ontrack = (e) => {
          if (videoRef.current) {
            videoRef.current.srcObject = e.streams[0];
          }
        };
        peerRef.current.onicecandidate = (e) => {
          if (e.candidate) {
            ws.current.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate }));
          }
        };
      }
      if (msg.type === "offer") {
        await peerRef.current.setRemoteDescription(new window.RTCSessionDescription({type: "offer", sdp: msg.offer}));
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: "answer", answer: { sdp: answer.sdp, type: answer.type } }));
      }
      if (msg.type === "ice-candidate" && msg.candidate) {
        try {
          await peerRef.current.addIceCandidate(new window.RTCIceCandidate(msg.candidate));
        } catch (err) {}
      }
    };

    ws.current.onclose = () => {
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      if (peerRef.current) peerRef.current.close();
    };
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
        <Box sx={{
          p: 2,
          border: "1px solid #eee",
          borderRadius: 2,
          background: "#fafafa",
          textAlign: "center",
          minHeight: "160px",
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
