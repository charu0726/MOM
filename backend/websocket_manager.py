import json
from typing import Dict, List, Set, Optional
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # meeting_code -> list of active live WebSockets (hosts + listeners)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # meeting_code -> list of participant info
        self.meeting_participants: Dict[str, List[Dict]] = {}

    async def connect(self, websocket: WebSocket, meeting_code: str, display_name: str = "User", role: str = "LISTENER"):
        await websocket.accept()
        if meeting_code not in self.active_connections:
            self.active_connections[meeting_code] = set()
            self.meeting_participants[meeting_code] = []

        self.active_connections[meeting_code].add(websocket)
        
        # Add participant record if not present
        existing = [p for p in self.meeting_participants[meeting_code] if p.get("name") == display_name]
        if not existing:
            self.meeting_participants[meeting_code].append({
                "name": display_name,
                "role": role
            })

        # Broadcast participant list update
        await self.broadcast(meeting_code, {
            "type": "participant_joined",
            "participant": {"name": display_name, "role": role},
            "participants": self.meeting_participants[meeting_code],
            "total_attendees": len(self.active_connections[meeting_code])
        })

    def disconnect(self, websocket: WebSocket, meeting_code: str, display_name: Optional[str] = None):
        if meeting_code in self.active_connections:
            self.active_connections[meeting_code].discard(websocket)
            if not self.active_connections[meeting_code]:
                del self.active_connections[meeting_code]

        if display_name and meeting_code in self.meeting_participants:
            self.meeting_participants[meeting_code] = [
                p for p in self.meeting_participants[meeting_code] if p.get("name") != display_name
            ]

    async def broadcast(self, meeting_code: str, message: dict):
        if meeting_code not in self.active_connections:
            return
        
        payload = json.dumps(message)
        dead_connections = set()
        
        for connection in list(self.active_connections[meeting_code]):
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.add(connection)
                
        for dead in dead_connections:
            self.active_connections[meeting_code].discard(dead)

    async def broadcast_transcript(self, meeting_code: str, segment_data: dict):
        await self.broadcast(meeting_code, {
            "type": "transcript_segment",
            "segment": segment_data
        })

    async def broadcast_active_speaker(self, meeting_code: str, speaker_name: str):
        await self.broadcast(meeting_code, {
            "type": "active_speaker",
            "speaker_name": speaker_name
        })

    async def broadcast_status(self, meeting_code: str, status: str):
        await self.broadcast(meeting_code, {
            "type": "meeting_status",
            "status": status
        })

manager = ConnectionManager()
