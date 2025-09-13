const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let worker;

(async () => {
  worker = await mediasoup.createWorker();
  console.log('Mediasoup worker started');
})();

// Simple in-memory store for rooms/peers (for demo)
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      // Eksempel på handling: ping-pong test
      if (msg.action === 'ping') {
        ws.send(JSON.stringify({ action: 'pong' }));
      }
      // Her kan du udvide med: join room, create transport, produce, consume, etc.
    } catch (err) {
      ws.send(JSON.stringify({ error: err.toString() }));
    }
  });
});

server.listen(3000, () => {
  console.log('SFU server listening on port 3000');
});
