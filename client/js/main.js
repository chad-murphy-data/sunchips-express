// main.js - Game initialization and main loop

import { AssetLoader } from './AssetLoader.js';
import { InputHandler } from './InputHandler.js';
import { Vehicle } from './Vehicle.js';
import { Camera } from './Camera.js';
import { ThreeRenderer } from './ThreeRenderer.js';
import { Track } from './Track.js';
import { UI } from './UI.js';
import { DebugPanel } from './DebugPanel.js';
import { NetworkManager } from './NetworkManager.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');

        // Set canvas resolution (lower for performance, CSS scales it up)
        this.canvas.width = 640;
        this.canvas.height = 480;

        // Game state
        this.running = false;
        this.lastTime = 0;

        // Network mode: 'local', 'host', or 'guest'
        this.mode = 'local';

        // Network manager
        this.network = new NetworkManager();

        // Frame counter for state send throttling
        this.frameCount = 0;

        // Components (initialized after assets load)
        this.assets = null;
        this.input = null;
        this.vehicle = null;
        this.camera = null;
        this.threeRenderer = null;
        this.track = null;
        this.ui = null;
        this.debugPanel = null;

        // UI elements for lobby
        this.startScreen = document.getElementById('start-screen');
        this.mainMenu = document.getElementById('main-menu');
        this.joinRoomPanel = document.getElementById('join-room-panel');
        this.waitingPanel = document.getElementById('waiting-panel');
        this.connectedPanel = document.getElementById('connected-panel');
        this.disconnectedPanel = document.getElementById('disconnected-panel');

        this.roomCodeDisplay = document.getElementById('room-code-display');
        this.networkRoleDisplay = document.getElementById('network-role-display');
    }

    async init() {
        console.log('Loading assets...');

        // Load all assets
        const loader = new AssetLoader();
        this.assets = await loader.loadAll();

        // Initialize components
        this.input = new InputHandler();
        this.track = new Track().generateLevel1();

        // Create vehicle at start position
        const start = this.track.getStartPosition();
        this.vehicle = new Vehicle(start.x, start.y, start.heading);

        // Camera follows vehicle
        this.camera = new Camera();
        this.camera.follow(this.vehicle, true); // Instant snap to start

        // Three.js renderer
        this.threeRenderer = new ThreeRenderer(this.canvas);
        await this.threeRenderer.buildScene(this.track);

        // UI
        this.ui = new UI();

        // Debug tuning panel (press ` to toggle)
        this.debugPanel = new DebugPanel(this.vehicle, this.track);
        this.debugPanel.setCamera(this.camera);

        console.log('Game initialized');

        // Set up network callbacks
        this.setupNetworkCallbacks();

        // Set up lobby buttons
        this.setupLobbyUI();
    }

    setupNetworkCallbacks() {
        this.network.onRoomCreated = (code) => {
            document.getElementById('room-code-large').textContent = code;
            this.showPanel('waiting');
        };

        this.network.onRoomJoined = (role) => {
            this.mode = role === 'host' ? 'host' : 'guest';

            // Configure input handler for network mode
            this.input.setNetworkMode(true, role === 'host' ? 'steering' : 'pedals');

            // Show connected panel
            const roleText = document.getElementById('role-text');
            if (role === 'host') {
                roleText.textContent = 'You are the DRIVER (Steering with A/D)';
            } else {
                roleText.textContent = 'You are the PASSENGER (Pedals with A/D)';
            }
            this.showPanel('connected');

            // Start countdown
            this.startCountdown();
        };

        this.network.onGameState = (state) => {
            // Guest receives state from host
            if (this.mode === 'guest') {
                this.vehicle.interpolateToward(state);
            }
        };

        this.network.onGameStart = () => {
            // Guest receives game start signal
            if (this.mode === 'guest') {
                this.startGame();
            }
        };

        this.network.onRoleSwap = () => {
            // Both players swap roles
            this.input.swapRoles();
            const currentRole = this.input.networkRole;
            this.input.networkRole = currentRole === 'steering' ? 'pedals' : 'steering';
        };

        this.network.onPeerDisconnected = () => {
            this.running = false;
            this.showPanel('disconnected');
        };

        this.network.onError = (message) => {
            document.getElementById('join-error').textContent = message;
        };
    }

    setupLobbyUI() {
        // Local co-op button
        document.getElementById('local-coop-button').addEventListener('click', () => {
            this.mode = 'local';
            this.input.setNetworkMode(false);
            this.startGame();
        });

        // Create room button
        document.getElementById('create-room-button').addEventListener('click', () => {
            console.log('Create room clicked');
            this.network.connect();
            // Wait for connection, then create room
            let attempts = 0;
            const checkConnection = setInterval(() => {
                attempts++;
                if (this.network.connected) {
                    clearInterval(checkConnection);
                    console.log('Connected, creating room...');
                    this.network.createRoom();
                } else if (attempts > 50) {
                    clearInterval(checkConnection);
                    console.error('Connection timeout');
                    alert('Could not connect to server. Check console for errors.');
                }
            }, 100);
        });

        // Join room button (show input panel)
        document.getElementById('join-room-button').addEventListener('click', () => {
            this.showPanel('join');
            document.getElementById('room-code-input').focus();
        });

        // Join submit button
        document.getElementById('join-submit-button').addEventListener('click', () => {
            this.submitJoinRoom();
        });

        // Room code input - submit on Enter
        document.getElementById('room-code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitJoinRoom();
            }
        });

        // Back buttons
        document.getElementById('join-back-button').addEventListener('click', () => {
            this.showPanel('main');
        });

        document.getElementById('waiting-back-button').addEventListener('click', () => {
            this.network.disconnect();
            this.showPanel('main');
        });

        document.getElementById('disconnected-back-button').addEventListener('click', () => {
            this.network.disconnect();
            this.resetGame();
            this.showPanel('main');
        });
    }

    submitJoinRoom() {
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();
        if (code.length !== 4) {
            document.getElementById('join-error').textContent = 'Enter a 4-character code';
            return;
        }
        document.getElementById('join-error').textContent = '';

        this.network.connect();
        // Wait for connection, then join room
        let attempts = 0;
        const checkConnection = setInterval(() => {
            attempts++;
            if (this.network.connected) {
                clearInterval(checkConnection);
                console.log('Connected, joining room...');
                this.network.joinRoom(code);
            } else if (attempts > 50) {
                clearInterval(checkConnection);
                console.error('Connection timeout');
                document.getElementById('join-error').textContent = 'Could not connect to server';
            }
        }, 100);
    }

    showPanel(panel) {
        // Hide all panels
        this.mainMenu.classList.add('hidden');
        this.joinRoomPanel.classList.add('hidden');
        this.waitingPanel.classList.add('hidden');
        this.connectedPanel.classList.add('hidden');
        this.disconnectedPanel.classList.add('hidden');

        // Show requested panel
        switch (panel) {
            case 'main':
                this.mainMenu.classList.remove('hidden');
                break;
            case 'join':
                this.joinRoomPanel.classList.remove('hidden');
                document.getElementById('room-code-input').value = '';
                document.getElementById('join-error').textContent = '';
                break;
            case 'waiting':
                this.waitingPanel.classList.remove('hidden');
                break;
            case 'connected':
                this.connectedPanel.classList.remove('hidden');
                break;
            case 'disconnected':
                this.disconnectedPanel.classList.remove('hidden');
                break;
        }
    }

    startCountdown() {
        let count = 3;
        const countdownText = document.getElementById('countdown-text');
        countdownText.textContent = `Starting in ${count}...`;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownText.textContent = `Starting in ${count}...`;
            } else {
                clearInterval(interval);
                countdownText.textContent = 'GO!';

                // Host sends game start signal
                if (this.mode === 'host') {
                    this.network.sendGameStart();
                }

                // Start the game after a brief moment
                setTimeout(() => {
                    this.startGame();
                }, 500);
            }
        }, 1000);
    }

    startGame() {
        this.startScreen.style.display = 'none';
        this.ui.show();
        this.ui.startTimer();

        // Show network info in UI if networked
        if (this.mode !== 'local' && this.network.roomCode) {
            this.roomCodeDisplay.textContent = `Room: ${this.network.roomCode}`;
            this.networkRoleDisplay.textContent = this.mode === 'host'
                ? 'Host (Steering)'
                : 'Guest (Pedals)';
        }

        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    resetGame() {
        // Reset vehicle to start position
        const start = this.track.getStartPosition();
        this.vehicle.x = start.x;
        this.vehicle.y = start.y;
        this.vehicle.heading = start.heading;
        this.vehicle.speed = 0;
        this.vehicle.angularVelocity = 0;

        // Reset camera
        this.camera.follow(this.vehicle, true);

        // Reset UI
        this.ui.resetTimer();
        this.ui.hide();
        this.roomCodeDisplay.textContent = '';
        this.networkRoleDisplay.textContent = '';

        // Show start screen
        this.startScreen.style.display = 'flex';
    }

    gameLoop() {
        if (!this.running) return;

        const currentTime = performance.now();
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Cap at 50ms
        this.lastTime = currentTime;

        this.update(dt);
        this.render(dt);

        this.frameCount++;
        requestAnimationFrame(() => this.gameLoop());
    }

    update(dt) {
        if (this.mode === 'local') {
            // Local co-op: both players on same keyboard
            const steering = this.input.getSteering();
            const pedals = this.input.getPedals();
            this.vehicle.update(dt, steering, pedals, this.track);
        } else if (this.mode === 'host') {
            // Host: runs physics, combines local + remote input
            const localInput = this.input.getLocalInput();
            const remoteInput = this.network.guestInput;

            // Host controls steering, guest controls pedals (initially)
            const steering = this.input.networkRole === 'steering'
                ? localInput
                : remoteInput.steering;
            const pedals = this.input.networkRole === 'pedals'
                ? localInput
                : remoteInput.pedals;

            this.vehicle.update(dt, steering, pedals, this.track);

            // Send state to guest every other frame (~30fps)
            if (this.frameCount % 2 === 0) {
                this.network.sendGameState(this.vehicle);
            }
        } else if (this.mode === 'guest') {
            // Guest: sends input, interpolates toward received state
            const localInput = this.input.getLocalInput();

            // Guest controls pedals initially
            if (this.input.networkRole === 'steering') {
                this.network.sendInput(localInput, 0);
            } else {
                this.network.sendInput(0, localInput);
            }

            // Interpolate vehicle toward latest received state
            // The vehicle already gets updated via onGameState callback
        }

        // Update camera to follow vehicle
        this.camera.follow(this.vehicle);

        // Trigger collision effects for hard hits
        if (this.vehicle.lastCollisionForce > 30) {
            this.threeRenderer.triggerCollisionEffect(this.vehicle.x, this.vehicle.y);
            this.vehicle.lastCollisionForce = 0;
        }

        // Update UI
        const networkRole = this.mode !== 'local' ? this.input.networkRole : null;
        this.ui.update(this.vehicle, this.input.rolesSwapped, networkRole);
    }

    render(dt) {
        // Update and render Three.js scene
        this.threeRenderer.update(this.vehicle, this.camera, dt);
        this.threeRenderer.render();
    }
}

// Start the game when the page loads
window.addEventListener('load', async () => {
    const game = new Game();
    try {
        await game.init();
    } catch (error) {
        console.error('Failed to initialize game:', error);
        // Show error on screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.innerHTML = `
                <h1 style="color: #f00;">Loading Error</h1>
                <p style="color: #fff;">${error.message}</p>
                <p style="color: #aaa; font-size: 12px;">Check browser console for details</p>
            `;
        }
    }
});
