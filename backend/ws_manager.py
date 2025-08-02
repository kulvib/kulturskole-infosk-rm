from fastapi import WebSocket

connected_websockets = []

async def notify_clients_updated():
    for ws in connected_websockets:
        try:
            await ws.send_text("update")
        except Exception:
            pass  # evt. fjern døde connections senere
