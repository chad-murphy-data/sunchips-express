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

        // Delivery state machine
        this.gameState = 'driving'; // driving | approaching | delivering | walk_back | swap_announce | countdown
        this.deliveryProgress = 0;
        this.stateTimer = 0;
        this.currentStation = null;
        this.currentStationIndex = -1;

        // Delivery tuning
        this.FILL_PER_MASH = 3;
        this.DECAY_PER_SECOND = 8;

        // Delivery UI elements
        this.deliveryPrompt = document.getElementById('delivery-prompt');
        this.deliveryBarContainer = document.getElementById('delivery-bar-container');
        this.deliveryBarFill = document.getElementById('delivery-bar-fill');
        this.swapAnnounce = document.getElementById('swap-announce');
        this.swapDetail = document.getElementById('swap-detail');
        this.deliveryCountdown = document.getElementById('delivery-countdown');
        this.deliveryCountdownNumber = document.getElementById('delivery-countdown-number');
        this.lapComplete = document.getElementById('lap-complete');
        this.lapTime = document.getElementById('lap-time');

        // Track if player has left start zone (prevent immediate lap complete)
        this.hasLeftStartZone = false;
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

        // Set up touch controls for mobile
        if (this.input.isMobile) {
            this.input.setupTouchControls();
            this.touchControls = document.getElementById('touch-controls');
        }

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
            const inputHint = this.input.isMobile ? 'touch buttons' : 'A/D';
            if (role === 'host') {
                roleText.textContent = 'You are the DRIVER (Steering with ' + inputHint + ')';
            } else {
                roleText.textContent = 'You are the PASSENGER (Pedals with ' + inputHint + ')';
            }

            // Update touch button labels for role
            this.input.updateTouchLabels(role === 'host' ? 'steering' : 'pedals');

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
            // Enable on-screen solo controls for desktop testing
            this.input.setupDesktopSoloControls();
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

        // Hide keyboard hint on mobile (touch controls replace it)
        if (this.input.isMobile) {
            document.getElementById('controls-hint').style.display = 'none';
        }

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
        // === Vehicle physics (only during driving/approaching states) ===
        if (this.gameState === 'driving' || this.gameState === 'approaching') {
            if (this.mode === 'local') {
                const steering = this.input.getSteering();
                const pedals = this.input.getPedals();
                this.vehicle.update(dt, steering, pedals, this.track);
            } else if (this.mode === 'host') {
                const localInput = this.input.getLocalInput();
                const remoteInput = this.network.guestInput;
                const steering = this.input.networkRole === 'steering'
                    ? localInput : remoteInput.steering;
                const pedals = this.input.networkRole === 'pedals'
                    ? localInput : remoteInput.pedals;
                this.vehicle.update(dt, steering, pedals, this.track);
                if (this.frameCount % 2 === 0) {
                    this.network.sendGameState(this.vehicle);
                }
            } else if (this.mode === 'guest') {
                const localInput = this.input.getLocalInput();
                if (this.input.networkRole === 'steering') {
                    this.network.sendInput(localInput, 0);
                } else {
                    this.network.sendInput(0, localInput);
                }
            }

            // Check station proximity
            this.checkStationProximity();

            // Check lap completion
            this.checkLapCompletion();
        }

        // === Delivery mashing ===
        if (this.gameState === 'delivering') {
            this.updateDelivery(dt);
        }

        // === Walk-back: wait for characters to return to cart ===
        if (this.gameState === 'walk_back') {
            const animator = this.threeRenderer.deliveryAnimator;
            if (!animator.active) {
                // Characters are back in the cart, proceed to swap announce
                this.doSwapAnnounce();
            }
        }

        // === Timed state transitions ===
        if (this.gameState === 'swap_announce' || this.gameState === 'countdown') {
            this.updateStateTimer(dt);
        }

        // === Always update camera, collision effects, UI ===
        this.camera.follow(this.vehicle);

        if (this.vehicle.lastCollisionForce > 30) {
            this.threeRenderer.triggerCollisionEffect(this.vehicle.x, this.vehicle.y);
            this.vehicle.lastCollisionForce = 0;
        }

        // Water splash effect when driving through creek
        if (this.vehicle.currentSurface === 'water' && Math.abs(this.vehicle.speed) > 10) {
            this.threeRenderer.triggerSplashEffect(this.vehicle.x, this.vehicle.y);
        }

        const networkRole = this.mode !== 'local' ? this.input.networkRole : null;
        this.ui.update(this.vehicle, this.input.rolesSwapped, networkRole);
    }

    // === Delivery State Machine Methods ===

    distToStation(station) {
        const dx = this.vehicle.x - station.x;
        const dy = this.vehicle.y - station.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    checkStationProximity() {
        if (!this.track.snackStations) return;

        if (this.gameState === 'driving') {
            // Look for a station to approach
            for (let si = 0; si < this.track.snackStations.length; si++) {
                const station = this.track.snackStations[si];
                if (station.delivered) continue;

                const dist = this.distToStation(station);
                const speed = Math.abs(this.vehicle.speed);

                if (dist < station.radius && speed < 15) {
                    this.gameState = 'approaching';
                    this.currentStation = station;
                    this.currentStationIndex = si;
                    this.deliveryPrompt.classList.remove('hidden');
                    if (this.touchControls) this.touchControls.classList.add('mash-active');
                    break;
                }
            }
        } else if (this.gameState === 'approaching' && this.currentStation) {
            // Only check against the current station
            const dist = this.distToStation(this.currentStation);
            const speed = Math.abs(this.vehicle.speed);

            if (dist > this.currentStation.radius || speed > 30) {
                // Drove away — reset bag fill if any progress was made
                if (this.currentStationIndex >= 0) {
                    this.threeRenderer.resetStationFill(this.currentStationIndex);
                }
                this.gameState = 'driving';
                this.currentStation = null;
                this.currentStationIndex = -1;
                this.deliveryPrompt.classList.add('hidden');
                if (this.touchControls) this.touchControls.classList.remove('mash-active');
            } else {
                // Check if a mash key was pressed to start delivery
                const mashes = this.input.consumeMashes();
                if (mashes.player1 > 0 || mashes.player2 > 0) {
                    this.enterDelivering();
                }
            }
        }

        // Track if player has left start zone (for lap completion)
        if (!this.hasLeftStartZone && this.track.startFinishZone) {
            const sfz = this.track.startFinishZone;
            const dx = this.vehicle.x - sfz.x;
            const dy = this.vehicle.y - sfz.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > sfz.radius * 1.5) {
                this.hasLeftStartZone = true;
            }
        }
    }

    enterDelivering() {
        this.gameState = 'delivering';
        this.deliveryProgress = 0;
        this.vehicle.frozen = true;
        this.vehicle.speed = 0;
        this.deliveryPrompt.classList.add('hidden');
        this.deliveryBarContainer.classList.remove('hidden');
        this.deliveryBarFill.style.width = '0%';

        // Start the character delivery animation
        if (this.currentStation && this.threeRenderer.deliveryAnimator.loaded) {
            this.threeRenderer.deliveryAnimator.startDelivery(
                { x: this.vehicle.x, y: this.vehicle.y },
                this.vehicle.heading,
                { x: this.currentStation.x, y: this.currentStation.y }
            );
        }
    }

    updateDelivery(dt) {
        const mashes = this.input.consumeMashes();
        const totalMashes = mashes.player1 + mashes.player2;

        this.deliveryProgress += totalMashes * this.FILL_PER_MASH;

        // Decay if nobody mashed
        if (totalMashes === 0) {
            this.deliveryProgress -= this.DECAY_PER_SECOND * dt;
        }

        this.deliveryProgress = Math.max(0, Math.min(100, this.deliveryProgress));
        this.deliveryBarFill.style.width = this.deliveryProgress + '%';

        // Update chip bag fill on the vending machine
        if (this.currentStationIndex >= 0) {
            this.threeRenderer.updateStationFill(this.currentStationIndex, this.deliveryProgress);
        }

        if (this.deliveryProgress >= 100) {
            this.enterSwapAnnounce();
        }
    }

    enterSwapAnnounce() {
        // Signal to the animator that stocking is done
        const animator = this.threeRenderer.deliveryAnimator;
        if (animator.active) {
            animator.onStockingComplete();
            // Go to walk_back state — wait for characters to return to cart
            this.gameState = 'walk_back';
            this.deliveryBarContainer.classList.add('hidden');
            return;
        }

        // If no animation is active, proceed immediately
        this.doSwapAnnounce();
    }

    doSwapAnnounce() {
        this.gameState = 'swap_announce';
        this.stateTimer = 0;
        this.deliveryBarContainer.classList.add('hidden');

        // Swap roles
        this.input.swapRoles();

        // Show announcement
        if (this.input.rolesSwapped) {
            this.swapDetail.innerHTML = 'P1 (A/D): NOW ON PEDALS<br>P2 (J/L): NOW STEERING';
        } else {
            this.swapDetail.innerHTML = 'P1 (A/D): STEERING<br>P2 (J/L): PEDALS';
        }
        this.swapAnnounce.classList.remove('hidden');
    }

    updateStateTimer(dt) {
        this.stateTimer += dt;

        if (this.gameState === 'swap_announce') {
            if (this.stateTimer >= 2.0) {
                this.swapAnnounce.classList.add('hidden');
                this.gameState = 'countdown';
                this.stateTimer = 0;
                this.deliveryCountdown.classList.remove('hidden');
                this.deliveryCountdownNumber.textContent = '3';
                this.deliveryCountdownNumber.style.color = '#fff';
            }
        } else if (this.gameState === 'countdown') {
            const remaining = 3 - Math.floor(this.stateTimer);
            if (remaining > 0) {
                this.deliveryCountdownNumber.textContent = remaining.toString();
                this.deliveryCountdownNumber.style.color = '#fff';
            } else if (this.stateTimer < 4.0) {
                this.deliveryCountdownNumber.textContent = 'GO!';
                this.deliveryCountdownNumber.style.color = '#0f0';
            }

            if (this.stateTimer >= 4.0) {
                this.deliveryCountdown.classList.add('hidden');
                this.finishDelivery();
            }
        }
    }

    finishDelivery() {
        this.gameState = 'driving';
        this.vehicle.frozen = false;
        this.deliveryProgress = 0;
        if (this.currentStation) {
            this.currentStation.delivered = true;
        }
        this.currentStation = null;
        this.currentStationIndex = -1;
        if (this.touchControls) this.touchControls.classList.remove('mash-active');

        // Ensure delivery animation is cleaned up
        if (this.threeRenderer.deliveryAnimator.active) {
            this.threeRenderer.deliveryAnimator.abort();
        }
    }

    checkLapCompletion() {
        if (!this.track.startFinishZone || !this.hasLeftStartZone) return;

        // Check if all stations delivered
        const allDelivered = this.track.snackStations &&
            this.track.snackStations.every(s => s.delivered);
        if (!allDelivered) return;

        // Check if in start/finish zone
        const sfz = this.track.startFinishZone;
        const dx = this.vehicle.x - sfz.x;
        const dy = this.vehicle.y - sfz.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < sfz.radius) {
            this.completeLap();
        }
    }

    completeLap() {
        this.ui.stopTimer();
        const elapsed = this.ui.getElapsedTime();
        this.lapTime.textContent = this.ui.formatTime(elapsed);
        this.lapComplete.classList.remove('hidden');

        // Reset stations for next lap after a delay
        setTimeout(() => {
            this.lapComplete.classList.add('hidden');
            for (let si = 0; si < this.track.snackStations.length; si++) {
                this.track.snackStations[si].delivered = false;
                this.threeRenderer.resetStationFill(si);
            }
            this.hasLeftStartZone = false;
            this.ui.startTimer();
        }, 4000);
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
    window._game = game; // Debug: expose game for testing
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
