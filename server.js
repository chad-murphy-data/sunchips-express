// server.js - WebSocket relay server for Sun Chips Express co-op

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from client/
app.use(express.static(path.join(__dirname, 'client')));

// Room storage: code -> { host: ws, guest: ws }
const rooms = new Map();

// Map WebSocket connections to their room codes
const clientRooms = new Map();

// Generate 4-character room code (no I or O to avoid ambiguity)
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code;
    let attempts = 0;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        attempts++;
    } while (rooms.has(code) && attempts < 100);
    return code;
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            console.error('Invalid JSON:', data);
            return;
        }

        switch (msg.type) {
            case 'create_room': {
                const code = generateCode();
                rooms.set(code, { host: ws, guest: null });
                clientRooms.set(ws, { code, role: 'host' });
                ws.send(JSON.stringify({ type: 'room_created', code }));
                console.log(`Room ${code} created`);
                break;
            }

            case 'join_room': {
                const code = msg.code?.toUpperCase();
                const room = rooms.get(code);

                if (!room) {
                    ws.send(JSON.stringify({ type: 'room_error', message: 'Room not found' }));
                    return;
                }

                if (room.guest) {
                    ws.send(JSON.stringify({ type: 'room_error', message: 'Room is full' }));
                    return;
                }

                room.guest = ws;
                clientRooms.set(ws, { code, role: 'guest' });

                // Notify both clients that the room is now full
                room.host.send(JSON.stringify({ type: 'room_joined', role: 'host' }));
                room.guest.send(JSON.stringify({ type: 'room_joined', role: 'guest' }));
                console.log(`Guest joined room ${code}`);
                break;
            }

            // Forward gameplay messages to the other player in the room
            case 'guest_input':
            case 'game_state':
            case 'game_start':
            case 'role_swap': {
                const clientInfo = clientRooms.get(ws);
                if (!clientInfo) return;

                const room = rooms.get(clientInfo.code);
                if (!room) return;

                // Forward to the other player
                const target = clientInfo.role === 'host' ? room.guest : room.host;
                if (target && target.readyState === 1) {
                    target.send(JSON.stringify(msg));
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        const clientInfo = clientRooms.get(ws);
        if (clientInfo) {
            const room = rooms.get(clientInfo.code);
            if (room) {
                // Notify the other player
                const other = clientInfo.role === 'host' ? room.guest : room.host;
                if (other && other.readyState === 1) {
                    other.send(JSON.stringify({ type: 'peer_disconnected' }));
                }
                // Clean up their room mapping too
                if (other) {
                    clientRooms.delete(other);
                }
                // Destroy the room
                rooms.delete(clientInfo.code);
                console.log(`Room ${clientInfo.code} destroyed`);
            }
            clientRooms.delete(ws);
        }
        console.log('Client disconnected');
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sun Chips Express server running on port ${PORT}`);
});
