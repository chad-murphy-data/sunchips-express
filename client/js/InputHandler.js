// InputHandler.js - Handles keyboard input for both players

export class InputHandler {
    constructor() {
        // Player 1: Steering (A/D)
        // Player 2: Pedals (J/L)
        this.keys = {
            // Player 1 - Steering
            a: false,
            d: false,

            // Player 2 - Pedals
            j: false,
            l: false,
        };

        // Role swap support (for local co-op)
        this.rolesSwapped = false;

        // Mash counting for delivery mechanic
        this.mashCounts = { player1: 0, player2: 0 };

        // Network mode settings
        this.networkMode = false;
        this.networkRole = null;  // 'steering' or 'pedals'

        // Mobile detection
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
                e.preventDefault();
            }

            // Mash counting — dedicated mash keys + driving keys
            if (key === 'f') {
                this.mashCounts.player1++;
                e.preventDefault();
            }
            if (key === ' ') {
                this.mashCounts.player2++;
                e.preventDefault();
            }
            // Also count driving keys as mashes
            if (this.rolesSwapped) {
                if (key === 'j' || key === 'l') this.mashCounts.player2++;
                if (key === 'a' || key === 'd') this.mashCounts.player1++;
            } else {
                if (key === 'a' || key === 'd') this.mashCounts.player1++;
                if (key === 'j' || key === 'l') this.mashCounts.player2++;
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = false;
                e.preventDefault();
            }
        });
    }

    // Configure for network play
    setNetworkMode(enabled, role = null) {
        this.networkMode = enabled;
        this.networkRole = role;
    }

    swapRoles() {
        this.rolesSwapped = !this.rolesSwapped;
    }

    consumeMashes() {
        const counts = { player1: this.mashCounts.player1, player2: this.mashCounts.player2 };
        this.mashCounts.player1 = 0;
        this.mashCounts.player2 = 0;
        return counts;
    }

    // Get steering input (-1 = left, 0 = straight, 1 = right)
    // Used in local co-op mode
    getSteering() {
        let left, right;

        if (this.rolesSwapped) {
            // After swap: J/L controls steering
            left = this.keys.j;
            right = this.keys.l;
        } else {
            // Normal: A/D controls steering
            left = this.keys.a;
            right = this.keys.d;
        }

        if (left && !right) return -1;
        if (right && !left) return 1;
        return 0;
    }

    // Get pedal input (-1 = brake, 0 = coast, 1 = accelerate)
    // Used in local co-op mode
    getPedals() {
        let accel, brake;

        if (this.rolesSwapped) {
            // After swap: A/D controls pedals
            accel = this.keys.d;
            brake = this.keys.a;
        } else {
            // Normal: J/L controls pedals (L = accel, J = brake)
            accel = this.keys.l;
            brake = this.keys.j;
        }

        if (accel && !brake) return 1;
        if (brake && !accel) return -1;
        return 0;
    }

    // Get local input for network mode
    // In network mode, both players use A/D
    // The role determines what A/D does
    getLocalInput() {
        const left = this.keys.a;
        const right = this.keys.d;

        if (this.networkRole === 'steering') {
            // A = left, D = right
            if (left && !right) return -1;
            if (right && !left) return 1;
            return 0;
        } else {
            // A = brake, D = accelerate
            if (right && !left) return 1;
            if (left && !right) return -1;
            return 0;
        }
    }

    // Check if any action key is pressed (for mashing during delivery)
    getPlayer1Mash() {
        if (this.rolesSwapped) {
            return this.keys.j || this.keys.l;
        }
        return this.keys.a || this.keys.d;
    }

    getPlayer2Mash() {
        if (this.rolesSwapped) {
            return this.keys.a || this.keys.d;
        }
        return this.keys.j || this.keys.l;
    }

    // === Touch Controls (Mobile) ===

    setupTouchControls() {
        if (!this.isMobile) return;

        const container = document.getElementById('game-container');
        container.classList.add('touch-active');

        const btnLeft = document.getElementById('touch-left');
        const btnRight = document.getElementById('touch-right');
        const btnMash = document.getElementById('touch-mash');

        // Helper: bind touch button to a key
        const bindTouch = (btn, key) => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[key] = true;
                btn.classList.add('pressed');
                // Also count as mash
                if (this.rolesSwapped) {
                    if (key === 'j' || key === 'l') this.mashCounts.player2++;
                    if (key === 'a' || key === 'd') this.mashCounts.player1++;
                } else {
                    if (key === 'a' || key === 'd') this.mashCounts.player1++;
                    if (key === 'j' || key === 'l') this.mashCounts.player2++;
                }
            }, { passive: false });

            const release = (e) => {
                e.preventDefault();
                this.keys[key] = false;
                btn.classList.remove('pressed');
            };
            btn.addEventListener('touchend', release, { passive: false });
            btn.addEventListener('touchcancel', release, { passive: false });
        };

        // Left/right buttons map to A/D by default
        bindTouch(btnLeft, 'a');
        bindTouch(btnRight, 'd');

        // Mash button — counts for both players so it works regardless of role
        btnMash.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.mashCounts.player1++;
            this.mashCounts.player2++;
            btnMash.classList.add('pressed');
        }, { passive: false });

        btnMash.addEventListener('touchend', (e) => {
            e.preventDefault();
            btnMash.classList.remove('pressed');
        }, { passive: false });

        btnMash.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            btnMash.classList.remove('pressed');
        }, { passive: false });

        // Prevent default touch behavior on the game canvas
        const canvas = document.getElementById('game-canvas');
        canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }

    updateTouchLabels(role) {
        if (!this.isMobile) return;

        const btnLeft = document.getElementById('touch-left');
        const btnRight = document.getElementById('touch-right');

        if (role === 'pedals') {
            btnLeft.textContent = 'BRK';
            btnRight.textContent = 'GAS';
        } else {
            btnLeft.textContent = '\u25C0';
            btnRight.textContent = '\u25B6';
        }
    }
}
