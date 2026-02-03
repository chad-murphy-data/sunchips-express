// UI.js - HUD rendering (speedometer, timer, etc.)

export class UI {
    constructor() {
        this.speedElement = document.getElementById('speed-value');
        this.timerElement = document.getElementById('timer');
        this.overlay = document.getElementById('ui-overlay');
        this.controlsHint = document.getElementById('controls-hint');

        // Timer state
        this.startTime = 0;
        this.elapsedTime = 0;
        this.running = false;
    }

    show() {
        this.overlay.style.display = 'block';
    }

    hide() {
        this.overlay.style.display = 'none';
    }

    startTimer() {
        this.startTime = performance.now();
        this.running = true;
    }

    stopTimer() {
        this.running = false;
    }

    resetTimer() {
        this.elapsedTime = 0;
        this.running = false;
        this.updateTimerDisplay();
    }

    update(vehicle, rolesSwapped = false, networkRole = null) {
        // Update speedometer
        const speed = vehicle.getSpeedMPH();
        const isReversing = vehicle.isReversing();

        // Show R prefix when reversing
        this.speedElement.textContent = isReversing ? `R ${speed}` : speed;

        // Color based on speed (blue when reversing)
        if (isReversing) {
            this.speedElement.style.color = '#4af';
        } else if (speed > 80) {
            this.speedElement.style.color = '#f00';
        } else if (speed > 50) {
            this.speedElement.style.color = '#ff0';
        } else {
            this.speedElement.style.color = '#0f0';
        }

        // Update timer
        if (this.running) {
            this.elapsedTime = performance.now() - this.startTime;
            this.updateTimerDisplay();
        }

        // Update controls hint for role swap
        this.updateControlsHint(rolesSwapped, networkRole);
    }

    updateTimerDisplay() {
        const totalMs = Math.floor(this.elapsedTime);
        const minutes = Math.floor(totalMs / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const ms = totalMs % 1000;

        this.timerElement.textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    updateControlsHint(rolesSwapped, networkRole = null) {
        if (networkRole) {
            // Network mode: only show this player's controls
            if (networkRole === 'steering') {
                this.controlsHint.innerHTML = `
                    <div class="player-controls">
                        <span class="player-label">You (Steering):</span> A/D
                    </div>
                `;
            } else {
                this.controlsHint.innerHTML = `
                    <div class="player-controls">
                        <span class="player-label">You (Pedals):</span> A/D
                    </div>
                    <div style="font-size: 10px; color: #888; margin-top: 4px;">A = brake, D = gas</div>
                `;
            }
        } else if (rolesSwapped) {
            this.controlsHint.innerHTML = `
                <div class="player-controls">
                    <span class="player-label">P1 (Pedals):</span> A/D
                </div>
                <div class="player-controls">
                    <span class="player-label">P2 (Steering):</span> J/L
                </div>
                <div style="color: #f80; margin-top: 5px;">ROLES SWAPPED!</div>
            `;
        } else {
            this.controlsHint.innerHTML = `
                <div class="player-controls">
                    <span class="player-label">P1 (Steering):</span> A/D
                </div>
                <div class="player-controls">
                    <span class="player-label">P2 (Pedals):</span> J/L
                </div>
            `;
        }
    }

    getElapsedTime() {
        return this.elapsedTime;
    }

    formatTime(ms) {
        const totalMs = Math.floor(ms);
        const minutes = Math.floor(totalMs / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const milliseconds = totalMs % 1000;

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
}
