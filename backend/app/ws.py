from fastapi import WebSocket
from typing import Dict, List, Set
import json
import logging

logger = logging.getLogger("ws_manager")

class ConnectionManager:
    def __init__(self):
        # Maps channel names ("global" or "merchant_123") to a set of WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "global": set()
        }

    async def connect(self, websocket: WebSocket, channel: str = "global"):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(f"WebSocket client connected to channel: {channel}")

    def disconnect(self, websocket: WebSocket, channel: str = "global"):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if channel != "global" and not self.active_connections[channel]:
                del self.active_connections[channel]
        logger.info(f"WebSocket client disconnected from channel: {channel}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

    async def broadcast_to_channel(self, channel: str, message: dict):
        text_data = json.dumps(message)
        # Broadcast to specific channel
        if channel in self.active_connections:
            # Create a copy of the set to avoid modification during iteration
            for connection in list(self.active_connections[channel]):
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.warning(f"Error sending to WebSocket client on {channel}: {e}")
                    self.active_connections[channel].discard(connection)

        # Also broadcast to global channel (so administrative dashboard sees everything)
        if channel != "global" and "global" in self.active_connections:
            for connection in list(self.active_connections["global"]):
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.warning(f"Error sending to WebSocket global client: {e}")
                    self.active_connections["global"].discard(connection)

manager = ConnectionManager()
