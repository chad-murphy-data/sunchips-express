// NetworkManager.js - WebSocket client for multiplayer co-op

export class NetworkManager {
    constructor() {
        this.ws = null;
        this.role = null;        // 'host' or 'guest'
        this.roomCode = null;
        this.connected = false;
        this.peerConnected = false;

        // Callbacks (set by main.js)
        this.onRoomCreated = null;   // (code) => {}
        this.onRoomJoined = null;    // (role) => {}
        this.onGuestInput = null;    // ({ steering, pedals }) => {}
        this.onGameState = null;     // ({ x, y, heading, speed, steerState }) => {}
        this.onGameStart = null;     // () => {}
        this.onRoleSwap = null;      // () => {}
        this.onPeerDisconnected = null;
        this.onError = null;

        // Guest's latest input (used by host)
        this.guestInput = { steering: 0, pedals: 0 };

        // Latest game state (used by guest)
        this.latestState = null;
    }

    connect() {
        // Connect to WebSocket server
        // Use wss:// in production, ws:// for localhost
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}`;

        console.log('Connecting to WebSocket:', url);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.connected = true;
            console.log('WebSocket connected');
        };

        this.ws.onclose = (event) => {
            this.connected = false;
            this.peerConnected = false;
            console.log('WebSocket disconnected:', event.code, event.reason);
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
            this.connected = false;
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
        };
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'room_created':
                this.roomCode = msg.code;
                if (this.onRoomCreated) this.onRoomCreated(msg.code);
                break;

            case 'room_joined':
                this.role = msg.role;
                this.peerConnected = true;
                if (this.onRoomJoined) this.onRoomJoined(msg.role);
                break;

            case 'guest_input':
                this.guestInput = { steering: msg.steering, pedals: msg.pedals };
                if (this.onGuestInput) this.onGuestInput(this.guestInput);
                break;

            case 'game_state':
                this.latestState = {
                    x: msg.x,
                    y: msg.y,
                    heading: msg.heading,
                    speed: msg.speed,
                    steerState: msg.steerState
                };
                if (this.onGameState) this.onGameState(this.latestState);
                break;

            case 'game_start':
                if (this.onGameStart) this.onGameStart();
                break;

            case 'role_swap':
                if (this.onRoleSwap) this.onRoleSwap();
                break;

            case 'peer_disconnected':
                this.peerConnected = false;
                if (this.onPeerDisconnected) this.onPeerDisconnected();
                break;

            case 'room_error':
                if (this.onError) this.onError(msg.message);
                break;
        }
    }

    createRoom() {
        this.send({ type: 'create_room' });
    }

    joinRoom(code) {
        this.send({ type: 'join_room', code: code.toUpperCase() });
    }

    // Guest sends their input to host (called every frame)
    sendInput(steering, pedals) {
        this.send({ type: 'guest_input', steering, pedals });
    }

    // Host sends game state to guest
    sendGameState(vehicle) {
        this.send({
            type: 'game_state',
            x: vehicle.x,
            y: vehicle.y,
            heading: vehicle.heading,
            speed: vehicle.speed,
            steerState: vehicle.steerState
        });
    }

    // Host signals game start
    sendGameStart() {
        this.send({ type: 'game_start' });
    }

    // Host signals role swap
    sendRoleSwap() {
        this.send({ type: 'role_swap' });
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    isHost() {
        return this.role === 'host';
    }

    isGuest() {
        return this.role === 'guest';
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.peerConnected = false;
        this.role = null;
        this.roomCode = null;
    }
}
