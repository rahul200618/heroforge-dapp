"""WebSocket hub: keeps the connected browsers and pushes events to them."""
from fastapi import WebSocket


class WsHub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket, hello: dict) -> None:
        await ws.accept()
        self.clients.add(ws)
        await ws.send_json(hello)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, message: dict) -> None:
        for ws in list(self.clients):
            try:
                await ws.send_json(message)
            except Exception:
                self.clients.discard(ws)
