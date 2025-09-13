import React, { useEffect, useRef } from "react";
import * as mediasoupClient from "mediasoup-client";
import { Card, CardContent, Box, Typography } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";

export default function LivestreamMediasoupViewer() {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const deviceRef = useRef(null);
  const transportRef = useRef(null);
  const consumerRef = useRef(null);

  // Udskift evt. URL til din egen SFU-server
  const WEBSOCKET_URL = 'wss://kulturskole-infosk-rm-sfu-server.onrender.com';

  useEffect(() => {
    let running = true;

    async function runMediasoup() {
      wsRef.current = new window.WebSocket(WEBSOCKET_URL);

      wsRef.current.onclose = () => {
        running = false;
        if (transportRef.current) transportRef.current.close();
        if (deviceRef.current) deviceRef.current = null;
        if (consumerRef.current) consumerRef.current = null;
      };

      // Helper til request/response-protokol
      function request(action, data = {}) {
        return new Promise((resolve, reject) => {
          const msg = { action, data };
          wsRef.current.send(JSON.stringify(msg));
          wsRef.current.onmessage = (event) => {
            const res = JSON.parse(event.data);
            if (res.error) return reject(res.error);
            resolve(res);
          };
        });
      }

      wsRef.current.onopen = async () => {
        try {
          // 1. Hent router RTP capabilities
          const routerCaps = await request("getRouterRtpCapabilities");

          // 2. Lav device
          const device = new mediasoupClient.Device();
          await device.load({ routerRtpCapabilities: routerCaps.data });
          deviceRef.current = device;

          // 3. Opret recv transport
          const { data: transportOptions } = await request("createWebRtcTransport");
          const recvTransport = device.createRecvTransport({
            id: transportOptions.id,
            iceParameters: transportOptions.iceParameters,
            iceCandidates: transportOptions.iceCandidates,
            dtlsParameters: transportOptions.dtlsParameters,
          });
          transportRef.current = recvTransport;

          // 4. Forbind transport (DTLS handshake)
          recvTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
            try {
              await request("connectWebRtcTransport", {
                transportId: recvTransport.id,
                dtlsParameters,
              });
              callback();
            } catch (err) {
              errback(err);
            }
          });

          // 5. Hent producerId (du kan også hardcode det her)
          // Hvis din backend ikke understøtter denne action, så hardcode producerId, fx:
          // const producerId = "din-producer-id-her";
          // Ellers:
          const { data: { producerId } } = await request("getFirstProducerId");
          if (!producerId) {
            throw new Error("Ingen producer aktiv på SFU!");
          }

          // 6. Opret consumer (modtag stream fra producer)
          const { data: consumerOptions } = await request("consume", {
            transportId: recvTransport.id,
            producerId,
            rtpCapabilities: device.rtpCapabilities,
          });

          const consumer = await recvTransport.consume({
            id: consumerOptions.id,
            producerId: consumerOptions.producerId,
            kind: consumerOptions.kind,
            rtpParameters: consumerOptions.rtpParameters,
          });
          consumerRef.current = consumer;

          // 7. Sæt stream på video-tag
          const stream = new window.MediaStream();
          stream.addTrack(consumer.track);
          if (videoRef.current) videoRef.current.srcObject = stream;

          // 8. Resume consumer hvis nødvendig
          await request("resume", { consumerId: consumer.id });

        } catch (err) {
          console.error("Mediasoup FEJL:", err);
        }
      };
    }

    runMediasoup();

    return () => {
      running = false;
      if (wsRef.current) wsRef.current.close();
      if (transportRef.current) transportRef.current.close();
      if (deviceRef.current) deviceRef.current = null;
      if (consumerRef.current) consumerRef.current = null;
    };
  }, []);

  return (
    <Card elevation={2} sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
          <VideocamIcon color="action" fontSize="large" />
          <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
            Livestream (mediasoup)
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
