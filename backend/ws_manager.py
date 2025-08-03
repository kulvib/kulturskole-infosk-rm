@router.websocket("/ws/clients")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    if len(connected_websockets) >= MAX_WEBSOCKETS:
        await websocket.close(code=1001, reason="Server overloaded")
        return
    connected_websockets.add(websocket)
    try:
        while True:
            try:
                msg = await websocket.receive_text()
                if msg == "ping":
                    await websocket.send_text("pong")
                # evt. håndter andre beskeder
            except Exception:
                await websocket.close()
                break
    except Exception:
        pass
    finally:
        connected_websockets.discard(websocket)
