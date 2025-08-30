import asyncio
import websockets

PORT = 8080
clients = set()

async def handler(websocket, path):
    clients.add(websocket)
    try:
        async for message in websocket:
            # Broadcast til alle connected clients
            await asyncio.gather(
                *[client.send(message) for client in clients if client != websocket]
            )
    finally:
        clients.remove(websocket)

async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT):
        print(f"WebSocket server running on port {PORT}")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
