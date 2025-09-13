const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let worker;
let router;
let transports = new Map(); // id -> transport
let producers = new Map();  // id -> producer
let consumers = new Map();  // id -> consumer

(async () => {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({ mediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {},
    },
  ]});
  console.log('Mediasoup worker & router started');
})();

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (err) {
      ws.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    try {
      switch(msg.action) {
        case 'ping':
          ws.send(JSON.stringify({ action: 'pong' }));
          break;
        case 'getRouterRtpCapabilities':
          ws.send(JSON.stringify({
            action: 'routerRtpCapabilities',
            data: router.rtpCapabilities
          }));
          break;
        case 'createWebRtcTransport':
          {
            const transport = await router.createWebRtcTransport({
              listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true,
            });
            transports.set(transport.id, transport);
            ws.send(JSON.stringify({
              action: 'webRtcTransportCreated',
              data: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
              }
            }));
          }
          break;
        case 'connectWebRtcTransport':
          {
            const { transportId, dtlsParameters } = msg.data;
            const transport = transports.get(transportId);
            await transport.connect({ dtlsParameters });
            ws.send(JSON.stringify({ action: 'webRtcTransportConnected', data: { transportId } }));
          }
          break;
        case 'produce':
          {
            const { transportId, kind, rtpParameters } = msg.data;
            const transport = transports.get(transportId);
            const producer = await transport.produce({ kind, rtpParameters });
            producers.set(producer.id, producer);
            ws.send(JSON.stringify({
              action: 'produced',
              data: { id: producer.id }
            }));
          }
          break;
        case 'consume':
          {
            const { transportId, producerId, rtpCapabilities } = msg.data;
            const transport = transports.get(transportId);
            if (!router.canConsume({ producerId, rtpCapabilities })) {
              ws.send(JSON.stringify({ error: 'Cannot consume' }));
              return;
            }
            const consumer = await transport.consume({
              producerId,
              rtpCapabilities,
              paused: false,
            });
            consumers.set(consumer.id, consumer);
            ws.send(JSON.stringify({
              action: 'consumed',
              data: {
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
              }
            }));
          }
          break;
        default:
          ws.send(JSON.stringify({ error: 'Unknown action' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ error: err.toString() }));
    }
  });
});

server.listen(3000, () => {
  console.log('SFU server listening on port 3000');
});
