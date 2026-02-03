// DebugPanel.js - Togglable slider panel for real-time physics tuning
// Press backtick (`) to show/hide the panel

export class DebugPanel {
    constructor(vehicle, track) {
        this.vehicle = vehicle;
        this.track = track;
        this.visible = false;
        this.panel = null;
        this.sliders = {};

        this.createPanel();
        this.setupToggle();
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'debug-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 320px;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            color: #0f0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 10px;
            overflow-y: auto;
            z-index: 9999;
            display: none;
            pointer-events: auto;
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-size: 14px; color: #ff0; margin-bottom: 8px; border-bottom: 1px solid #ff0; padding-bottom: 4px;';
        title.textContent = 'TUNING PANEL (` to toggle)';
        this.panel.appendChild(title);

        // === SPEED GROUP ===
        this.addGroupHeader('SPEED');
        this.addSlider('MAX_SPEED', 100, 800, this.vehicle.MAX_SPEED, 10,
            v => this.vehicle.MAX_SPEED = v);
        this.addSlider('ACCELERATION', 50, 500, this.vehicle.ACCELERATION, 10,
            v => this.vehicle.ACCELERATION = v);
        this.addSlider('BRAKE_FORCE', 50, 500, this.vehicle.BRAKE_FORCE, 10,
            v => this.vehicle.BRAKE_FORCE = v);
        this.addSlider('FRICTION', 5, 100, this.vehicle.FRICTION, 5,
            v => this.vehicle.FRICTION = v);
        this.addSlider('MAX_REVERSE', 20, 200, this.vehicle.MAX_REVERSE_SPEED, 10,
            v => this.vehicle.MAX_REVERSE_SPEED = v);
        this.addSlider('REVERSE_ACCEL', 10, 150, this.vehicle.REVERSE_ACCEL, 5,
            v => this.vehicle.REVERSE_ACCEL = v);

        // === STEERING GROUP ===
        this.addGroupHeader('STEERING');
        this.addSlider('TURN_RATE', 0.3, 3.0, this.vehicle.TURN_RATE, 0.1,
            v => this.vehicle.TURN_RATE = v);
        this.addSlider('STEER_RESPONSE', 0.5, 8.0, this.vehicle.STEER_RESPONSE, 0.25,
            v => this.vehicle.STEER_RESPONSE = v);
        this.addSlider('SPEED_TURN_REDUCE', 0.1, 0.9, 0.7, 0.05,
            v => this.vehicle._speedTurnReduce = v, 'How much turning is reduced at max speed');

        // Store the speed turn reduction factor so update() can read it
        this.vehicle._speedTurnReduce = 0.7;

        // === BOUNCE GROUP ===
        this.addGroupHeader('WALL BOUNCE');
        if (this.vehicle.bounceDuration !== undefined) {
            this.addSlider('BOUNCE_FRAC', 0.1, 1.0, 0.4, 0.05,
                v => this.vehicle._bounceFraction = v, 'Fraction of impact speed returned as bounce');
            this.addSlider('BOUNCE_CAP', 30, 300, 120, 10,
                v => this.vehicle._bounceCap = v, 'Max bounce speed');
            this.addSlider('BOUNCE_TIME', 0.1, 1.5, 0.4, 0.05,
                v => this.vehicle._bounceTime = v, 'How long bounce disables controls (sec)');
            this.addSlider('BOUNCE_FRICTION', 0.80, 0.99, 0.92, 0.01,
                v => this.vehicle._bounceFriction = v, 'Bounce velocity decay per frame');

            // Set defaults
            this.vehicle._bounceFraction = 0.4;
            this.vehicle._bounceCap = 120;
            this.vehicle._bounceTime = 0.4;
            this.vehicle._bounceFriction = 0.92;
        } else {
            // Fallback if bounce system isn't implemented yet
            this.addSlider('WALL_SPEED_KEEP', 0.0, 1.0, 0.0, 0.05,
                v => this.vehicle._wallSpeedKeep = v, 'Speed retained after wall hit (0=full stop, 1=no penalty)');
            this.addSlider('WALL_NUDGE', 1, 20, 3, 1,
                v => this.vehicle._wallNudge = v, 'Push-back distance from wall');

            this.vehicle._wallSpeedKeep = 0.0;
            this.vehicle._wallNudge = 3;
        }

        // === COLLISION ZONE GROUP ===
        this.addGroupHeader('COLLISION');
        this.addSlider('GUARDRAIL_W', 10, 100, this.track.guardrailWidth, 5,
            v => this.track.guardrailWidth = v, 'Collision zone width (world units)');

        // === CAMERA GROUP ===
        this.addGroupHeader('CAMERA');
        // We'll need a reference to the camera - store it later via setCamera()
        this.addSlider('CAM_HEIGHT', 50, 400, 150, 10,
            v => { if (this._camera) this._camera.height = v; }, 'Camera height above ground');
        this.addSlider('CAM_SMOOTHING', 0.02, 0.5, 0.1, 0.01,
            v => { if (this._camera) this._camera.smoothing = v; }, 'Camera follow smoothness');

        // === PRESET BUTTONS ===
        this.addGroupHeader('PRESETS');
        this.addPresetButton('Golf Cart', () => this.applyPreset({
            MAX_SPEED: 300, ACCELERATION: 150, BRAKE_FORCE: 200, FRICTION: 30,
            TURN_RATE: 1.0, STEER_RESPONSE: 3.0
        }));
        this.addPresetButton('Rocket Cart', () => this.applyPreset({
            MAX_SPEED: 600, ACCELERATION: 350, BRAKE_FORCE: 250, FRICTION: 20,
            TURN_RATE: 0.8, STEER_RESPONSE: 2.0
        }));
        this.addPresetButton('Semi Truck', () => this.applyPreset({
            MAX_SPEED: 400, ACCELERATION: 100, BRAKE_FORCE: 150, FRICTION: 15,
            TURN_RATE: 0.6, STEER_RESPONSE: 1.5
        }));
        this.addPresetButton('Supercar + Bad Steering', () => this.applyPreset({
            MAX_SPEED: 500, ACCELERATION: 280, BRAKE_FORCE: 250, FRICTION: 25,
            TURN_RATE: 1.0, STEER_RESPONSE: 2.0
        }));

        // === EXPORT BUTTON ===
        this.addGroupHeader('');
        this.addExportButton();

        document.body.appendChild(this.panel);
    }

    addGroupHeader(text) {
        const header = document.createElement('div');
        header.style.cssText = 'color: #ff0; margin-top: 10px; margin-bottom: 4px; font-size: 12px; font-weight: bold;';
        header.textContent = text;
        this.panel.appendChild(header);
    }

    addSlider(name, min, max, initial, step, callback, tooltip) {
        const row = document.createElement('div');
        row.style.cssText = 'margin: 3px 0; display: flex; align-items: center; gap: 6px;';

        const label = document.createElement('span');
        label.style.cssText = 'width: 120px; flex-shrink: 0; color: #aaa;';
        label.textContent = name;
        if (tooltip) label.title = tooltip;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = initial;
        slider.style.cssText = 'flex: 1; height: 14px; cursor: pointer; accent-color: #0f0;';

        const valueDisplay = document.createElement('span');
        valueDisplay.style.cssText = 'width: 45px; text-align: right; flex-shrink: 0; color: #0f0;';
        valueDisplay.textContent = Number(initial).toFixed(step < 1 ? 2 : 0);

        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            valueDisplay.textContent = val.toFixed(step < 1 ? 2 : 0);
            callback(val);
        });

        // Prevent game from receiving key events while interacting with sliders
        slider.addEventListener('keydown', e => e.stopPropagation());
        slider.addEventListener('keyup', e => e.stopPropagation());

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisplay);
        this.panel.appendChild(row);

        this.sliders[name] = { slider, valueDisplay, callback };
    }

    addPresetButton(name, callback) {
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.style.cssText = `
            background: #333; color: #0f0; border: 1px solid #0f0;
            padding: 4px 10px; margin: 2px 4px 2px 0; cursor: pointer;
            font-family: 'Courier New', monospace; font-size: 11px;
        `;
        btn.addEventListener('click', callback);
        btn.addEventListener('keydown', e => e.stopPropagation());
        this.panel.appendChild(btn);
    }

    addExportButton() {
        const btn = document.createElement('button');
        btn.textContent = 'Copy Current Values';
        btn.style.cssText = `
            background: #333; color: #ff0; border: 1px solid #ff0;
            padding: 6px 14px; margin: 10px 0; cursor: pointer; width: 100%;
            font-family: 'Courier New', monospace; font-size: 12px;
        `;
        btn.addEventListener('click', () => {
            const values = this.exportValues();
            navigator.clipboard.writeText(values).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy Current Values', 1500);
            });
        });
        btn.addEventListener('keydown', e => e.stopPropagation());
        this.panel.appendChild(btn);
    }

    applyPreset(values) {
        for (const [key, val] of Object.entries(values)) {
            if (this.sliders[key]) {
                this.sliders[key].slider.value = val;
                this.sliders[key].valueDisplay.textContent = val.toFixed(
                    parseFloat(this.sliders[key].slider.step) < 1 ? 2 : 0
                );
                this.sliders[key].callback(val);
            }
            // Also set directly on vehicle
            if (key in this.vehicle) {
                this.vehicle[key] = val;
            }
        }
    }

    exportValues() {
        const v = this.vehicle;
        const lines = [
            '// Tuned physics values — paste into Vehicle.js constructor',
            `this.MAX_SPEED = ${v.MAX_SPEED};`,
            `this.MAX_REVERSE_SPEED = ${v.MAX_REVERSE_SPEED};`,
            `this.ACCELERATION = ${v.ACCELERATION};`,
            `this.REVERSE_ACCEL = ${v.REVERSE_ACCEL};`,
            `this.BRAKE_FORCE = ${v.BRAKE_FORCE};`,
            `this.FRICTION = ${v.FRICTION};`,
            `this.TURN_RATE = ${v.TURN_RATE};`,
            `this.STEER_RESPONSE = ${v.STEER_RESPONSE};`,
            '',
            `// Guardrail width: ${this.track.guardrailWidth}`,
        ];

        if (v._bounceFraction !== undefined) {
            lines.push('');
            lines.push('// Bounce values');
            lines.push(`// bounceFraction: ${v._bounceFraction}`);
            lines.push(`// bounceCap: ${v._bounceCap}`);
            lines.push(`// bounceTime: ${v._bounceTime}`);
            lines.push(`// bounceFriction: ${v._bounceFriction}`);
        }

        if (this._camera) {
            lines.push('');
            lines.push(`// Camera height: ${this._camera.height}`);
            lines.push(`// Camera smoothing: ${this._camera.smoothing}`);
        }

        return lines.join('\n');
    }

    setCamera(camera) {
        this._camera = camera;
        // Update the camera slider initial values
        if (this.sliders['CAM_HEIGHT']) {
            this.sliders['CAM_HEIGHT'].slider.value = camera.height;
            this.sliders['CAM_HEIGHT'].valueDisplay.textContent = camera.height.toFixed(0);
        }
        if (this.sliders['CAM_SMOOTHING']) {
            this.sliders['CAM_SMOOTHING'].slider.value = camera.smoothing;
            this.sliders['CAM_SMOOTHING'].valueDisplay.textContent = camera.smoothing.toFixed(2);
        }
    }

    setupToggle() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || e.key === '~') {
                this.visible = !this.visible;
                this.panel.style.display = this.visible ? 'block' : 'none';
                e.preventDefault();
            }
        });
    }
}
