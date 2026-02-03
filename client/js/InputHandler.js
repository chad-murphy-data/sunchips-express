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

        // Role swap support
        this.rolesSwapped = false;

        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
                e.preventDefault();
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

    swapRoles() {
        this.rolesSwapped = !this.rolesSwapped;
    }

    // Get steering input (-1 = left, 0 = straight, 1 = right)
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
}
