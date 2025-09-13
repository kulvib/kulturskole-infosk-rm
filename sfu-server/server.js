const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Simple in-memory store for rooms/peers (for demo)
const rooms = new Map();

let worker;
(async () => {
  worker = await mediasoup.createWorker();
  console.log('Mediasoup worker started');
})();

// --- WebSocket signaling ---
wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    // Expect JSON messages: {action, roomId, peerId, ...}
    try {
      const msg = JSON.parse(message);
      // Her skal du håndtere "join room", "create transport", "produce", "consume" osv.
      // Dette er kun stub for at vise strukturen
      if (msg.action === 'ping') {
        ws.send(JSON.stringify({action: 'pong'}));
      }
      // ... implementér flere signaler her
    } catch (err) {
      ws.send(JSON.stringify({error: err.toString()}));
    }
  });
});

server.listen(3000, () => {
  console.log('SFU server listening on port 3000');
});
