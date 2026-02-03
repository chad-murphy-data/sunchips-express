// main.js - Game initialization and main loop

import { AssetLoader } from './AssetLoader.js';
import { InputHandler } from './InputHandler.js';
import { Vehicle } from './Vehicle.js';
import { Camera } from './Camera.js';
import { Mode7Renderer } from './Mode7Renderer.js';
import { SpriteRenderer } from './SpriteRenderer.js';
import { Track } from './Track.js';
import { UI } from './UI.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas resolution (lower for performance, CSS scales it up)
        this.canvas.width = 640;
        this.canvas.height = 480;

        // Game state
        this.running = false;
        this.lastTime = 0;

        // Components (initialized after assets load)
        this.assets = null;
        this.input = null;
        this.vehicle = null;
        this.camera = null;
        this.mode7 = null;
        this.sprites = null;
        this.track = null;
        this.ui = null;
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

        // Renderers
        this.mode7 = new Mode7Renderer(this.canvas, loader);
        this.mode7.buildGroundTexture(this.track);

        this.sprites = new SpriteRenderer(this.canvas, loader);

        // UI
        this.ui = new UI();

        console.log('Game initialized');

        // Set up start button
        const startButton = document.getElementById('start-button');
        const startScreen = document.getElementById('start-screen');

        startButton.addEventListener('click', () => {
            startScreen.style.display = 'none';
            this.ui.show();
            this.ui.startTimer();
            this.running = true;
            this.lastTime = performance.now();
            this.gameLoop();
        });
    }

    gameLoop() {
        if (!this.running) return;

        const currentTime = performance.now();
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Cap at 50ms
        this.lastTime = currentTime;

        this.update(dt);
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    update(dt) {
        // Get input
        const steering = this.input.getSteering();
        const pedals = this.input.getPedals();

        // Update vehicle
        this.vehicle.update(dt, steering, pedals, this.track);

        // Update camera to follow vehicle
        this.camera.follow(this.vehicle);

        // Update UI
        this.ui.update(this.vehicle, this.input.rolesSwapped);
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render Mode 7 ground plane
        this.mode7.render(this.camera);

        // Render trackside sprites
        this.sprites.renderSprites(this.track.obstacles, this.camera);

        // Render player's golf cart (always on top)
        this.sprites.renderVehicle(this.vehicle);
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
