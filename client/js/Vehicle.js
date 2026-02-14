// Vehicle.js - Golf cart physics and state

export class Vehicle {
    constructor(x, y, heading = 0) {
        // Position on the 2D map
        this.x = x;
        this.y = y;

        // Heading in radians (0 = facing right/east)
        this.heading = heading;

        // Speed (units per second) - can be negative for reverse
        this.speed = 0;

        // Vehicle collision dimensions
        this.COLLISION_RADIUS = 25;      // Half-width of vehicle
        this.COLLISION_FRONT = 35;       // Distance from center to front

        // Physics constants - SUPERCAR speed, golf cart handling
        // DEBUG: Cap speed at ~40 MPH for testing (set to 500 for production)
        this.MAX_SPEED = 120;           // Debug cap (~40 MPH) - change to 500 for full speed
        this.MAX_REVERSE_SPEED = 60;    // Reverse is punishment (was 80)
        this.ACCELERATION = 180;         // Slower acceleration for better control (was 280)
        this.REVERSE_ACCEL = 40;         // Reversing is painfully slow (was 60)
        this.BRAKE_FORCE = 250;          // Slightly better brakes - they'll need them
        this.FRICTION = 20;              // Slightly less friction for gradual slowdown

        // Steering constants - heavy, sluggish feel for co-op frustration
        this.TURN_RATE = 1.0;            // Base turn rate (radians/sec) - was 1.6
        this.MIN_TURN_SPEED = 0.3;       // Minimum speed ratio for turning
        this.STEER_RESPONSE = 2.5;       // Angular velocity smoothing (was 2.0, tuned for feel)

        // Angular velocity for steering inertia
        this.angularVelocity = 0;

        // Wall bounce state
        this.bounceVx = 0;
        this.bounceVy = 0;
        this.bounceDuration = 0;

        // Visual state for sprite selection
        this.steerState = 0;  // -1 left, 0 straight, 1 right

        // Collision tracking for visual effects
        this.lastCollisionForce = 0;

        // Freeze flag for delivery stops
        this.frozen = false;

        // Surface friction modifiers (updated each frame from track collision)
        this.surfaceFriction = 1.0;
        this.brakeFrictionMult = 1.0;
        this.steerFrictionMult = 1.0;
        this.currentSurface = 'asphalt';
    }

    // Get collision check points (front corners and center)
    getCollisionPoints(x, y, heading) {
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);

        // Perpendicular direction (left/right)
        const perpX = -sin;
        const perpY = cos;

        return [
            // Front left corner
            {
                x: x + cos * this.COLLISION_FRONT + perpX * this.COLLISION_RADIUS,
                y: y + sin * this.COLLISION_FRONT + perpY * this.COLLISION_RADIUS
            },
            // Front right corner
            {
                x: x + cos * this.COLLISION_FRONT - perpX * this.COLLISION_RADIUS,
                y: y + sin * this.COLLISION_FRONT - perpY * this.COLLISION_RADIUS
            },
            // Front center
            {
                x: x + cos * this.COLLISION_FRONT,
                y: y + sin * this.COLLISION_FRONT
            },
            // Rear left (for reversing)
            {
                x: x - cos * this.COLLISION_FRONT + perpX * this.COLLISION_RADIUS,
                y: y - sin * this.COLLISION_FRONT + perpY * this.COLLISION_RADIUS
            },
            // Rear right (for reversing)
            {
                x: x - cos * this.COLLISION_FRONT - perpX * this.COLLISION_RADIUS,
                y: y - sin * this.COLLISION_FRONT - perpY * this.COLLISION_RADIUS
            }
        ];
    }

    update(dt, steerInput, pedalInput, track) {
        // ===== FROZEN (parked for delivery) =====
        if (this.frozen) {
            this.speed = 0;
            this.angularVelocity = 0;
            this.steerState = 0;
            return;
        }

        // ===== WALL BOUNCE (overrides normal movement while active) =====
        if (this.bounceDuration > 0) {
            this.bounceDuration -= dt;

            // Apply bounce velocity directly to position
            this.x += this.bounceVx * dt;
            this.y += this.bounceVy * dt;

            // Decay bounce velocity (friction) - use tunable value or default
            const bounceFriction = this._bounceFriction || 0.92;
            this.bounceVx *= bounceFriction;
            this.bounceVy *= bounceFriction;

            // During bounce, player can still steer (slowly) to recover angle
            // but pedal input is ignored — you're just drifting
            if (steerInput !== 0) {
                this.heading += steerInput * 0.5 * dt;  // Very slow correction during bounce
            }

            // Store steer state for sprite rendering
            this.steerState = steerInput;

            // Check if bounce puts us into another wall (prevent bouncing through walls)
            // Only check after first frame to let the initial nudge clear us from the wall
            const bounceTime = this._bounceTime || 0.4;
            if (track && this.bounceDuration < bounceTime - 0.05) {
                const bounceCollision = track.checkCollision(this.x, this.y);
                if (bounceCollision.type === 'wall') {
                    // Stop the bounce if we'd go into another wall
                    this.bounceVx = 0;
                    this.bounceVy = 0;
                    this.bounceDuration = 0;
                    // Nudge away from this wall too
                    this.x += bounceCollision.normalX * 10;
                    this.y += bounceCollision.normalY * 10;
                }
            }

            // If bounce is done or velocity is tiny, clear it
            if (this.bounceDuration <= 0 ||
                Math.abs(this.bounceVx) + Math.abs(this.bounceVy) < 5) {
                this.bounceVx = 0;
                this.bounceVy = 0;
                this.bounceDuration = 0;
            }

            return;  // Skip normal physics during bounce
        }

        // ===== SPEED UPDATE (with reverse support) =====
        if (pedalInput > 0) {
            if (this.speed < 0) {
                // Pressing gas while reversing = brake first
                this.speed += this.BRAKE_FORCE * this.brakeFrictionMult * dt;
            } else {
                // Normal forward acceleration
                this.speed += this.ACCELERATION * dt;
            }
        } else if (pedalInput < 0) {
            if (this.speed > 0) {
                // Pressing brake while moving forward = brake
                this.speed -= this.BRAKE_FORCE * this.brakeFrictionMult * dt;
            } else {
                // Already stopped or reversing = reverse acceleration
                this.speed -= this.REVERSE_ACCEL * dt;
            }
        }

        // Apply friction (toward zero in either direction)
        if (this.speed > 0) {
            this.speed -= this.FRICTION * dt;
            if (this.speed < 0) this.speed = 0;
        } else if (this.speed < 0) {
            this.speed += this.FRICTION * dt;
            if (this.speed > 0) this.speed = 0;
        }

        // Clamp speed to range
        this.speed = Math.max(-this.MAX_REVERSE_SPEED, Math.min(this.speed, this.MAX_SPEED));

        // ===== STEERING UPDATE (with inertia) =====
        const absSpeed = Math.abs(this.speed);

        if (absSpeed > this.MAX_SPEED * this.MIN_TURN_SPEED) {
            // Speed-dependent turning - much harder to turn when fast
            const speedTurnReduce = this._speedTurnReduce || 0.7;
            const speedFactor = 1 - (absSpeed / this.MAX_SPEED) * speedTurnReduce;
            const direction = this.speed >= 0 ? 1 : -1;  // Invert steering when reversing

            // Target angular velocity based on input (surface affects grip)
            const targetTurnRate = steerInput * this.TURN_RATE * speedFactor * direction * this.steerFrictionMult;

            // Smooth toward target (steering inertia)
            this.angularVelocity += (targetTurnRate - this.angularVelocity) * this.STEER_RESPONSE * dt;
        } else if (absSpeed > 0) {
            // Slow speed turning
            const direction = this.speed >= 0 ? 1 : -1;
            const targetTurnRate = steerInput * this.TURN_RATE * 0.5 * direction;
            this.angularVelocity += (targetTurnRate - this.angularVelocity) * this.STEER_RESPONSE * dt;
        }

        // Dampen angular velocity when not steering (slower damping = more drift)
        if (steerInput === 0) {
            this.angularVelocity *= (1 - 2.0 * dt);
        }

        // Apply angular velocity to heading
        this.heading += this.angularVelocity * dt;

        // Store steer state for sprite rendering
        this.steerState = steerInput;

        // ===== POSITION UPDATE =====
        const newX = this.x + Math.cos(this.heading) * this.speed * dt;
        const newY = this.y + Math.sin(this.heading) * this.speed * dt;

        // ===== COLLISION HANDLING =====
        if (track) {
            // Check collision at multiple points around the vehicle
            const collisionPoints = this.getCollisionPoints(newX, newY, this.heading);

            // Check front points when moving forward, rear points when reversing
            const checkPoints = this.speed >= 0
                ? collisionPoints.slice(0, 3)  // Front left, front right, front center
                : collisionPoints.slice(3, 5); // Rear left, rear right

            let wallCollision = null;

            for (const point of checkPoints) {
                const collision = track.checkCollision(point.x, point.y);
                if (collision.type === 'wall') {
                    wallCollision = collision;
                    break;
                }
            }

            if (wallCollision) {
                // BACKWARD BOUNCE — wall shoves you back along its normal.
                // No sliding, no sticking. Just a firm "nope."
                const vx = Math.cos(this.heading) * this.speed;
                const vy = Math.sin(this.heading) * this.speed;
                const normalDot = vx * wallCollision.normalX + vy * wallCollision.normalY;

                // Track collision force for visual effects
                this.lastCollisionForce = Math.abs(this.speed);

                // Always bounce if we're in the wall, regardless of approach angle
                // Use total speed for bounce calculation, not just into-wall component
                // This prevents glancing blows from being ignored
                const impactSpeed = Math.abs(this.speed);
                const bounceFraction = this._bounceFraction || 0.4;
                const bounceCap = this._bounceCap || 120;
                const bounceSpeed = Math.min(impactSpeed * bounceFraction, bounceCap);

                // Set velocity to bounce direction (along wall normal, away from wall)
                this.speed = 0;  // Kill forward/backward speed
                this.angularVelocity = 0;  // Kill rotation

                // Apply bounce as direct position velocity
                // The cart will drift backward along the wall normal
                this.bounceVx = wallCollision.normalX * bounceSpeed;
                this.bounceVy = wallCollision.normalY * bounceSpeed;
                this.bounceDuration = this._bounceTime || 0.4;  // Bounce lasts ~0.4 seconds

                // Do NOT change heading — nose stays pointed at the wall

                // Nudge out of collision zone
                this.x = newX + wallCollision.normalX * 20;
                this.y = newY + wallCollision.normalY * 20;

            } else {
                // Move to new position
                this.x = newX;
                this.y = newY;
            }

            // Query surface at current position for friction modifiers
            const surfaceCheck = track.checkCollision(this.x, this.y);
            if (surfaceCheck) {
                this.surfaceFriction = surfaceCheck.friction || 1.0;
                this.brakeFrictionMult = surfaceCheck.brakeMult || 1.0;
                this.steerFrictionMult = surfaceCheck.steerMult || 1.0;
                this.currentSurface = surfaceCheck.surface || 'asphalt';

                // Speed reduction on low-friction surfaces
                if (this.surfaceFriction < 1.0 && Math.abs(this.speed) > 0) {
                    const drag = (1 - this.surfaceFriction) * 0.3 * dt;
                    this.speed *= (1 - drag);
                }
            }
        } else {
            // No track collision checking
            this.x = newX;
            this.y = newY;
        }
    }

    // Get the appropriate sprite name based on steering
    getSpriteKey() {
        if (this.steerState < 0) return 'cart_left';
        if (this.steerState > 0) return 'cart_right';
        return 'cart_straight';
    }

    // Get speed as a percentage (0-100)
    getSpeedPercent() {
        return Math.round((Math.abs(this.speed) / this.MAX_SPEED) * 100);
    }

    // Get speed in "MPH" (arbitrary units for display)
    getSpeedMPH() {
        return Math.round(Math.abs(this.speed) / 3);
    }

    // Check if currently reversing
    isReversing() {
        return this.speed < -1;
    }

    // Interpolate toward a target state (used by guest in network mode)
    // This provides smooth rendering even when state updates arrive at ~30fps
    interpolateToward(targetState, lerpFactor = 0.3) {
        if (!targetState) return;

        // Lerp position
        this.x += (targetState.x - this.x) * lerpFactor;
        this.y += (targetState.y - this.y) * lerpFactor;

        // Lerp heading (handling angle wrap-around)
        let headingDiff = targetState.heading - this.heading;
        // Normalize to [-PI, PI]
        while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
        while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
        this.heading += headingDiff * lerpFactor;

        // Lerp speed
        this.speed += (targetState.speed - this.speed) * lerpFactor;

        // Directly copy steer state for sprite selection
        this.steerState = targetState.steerState;
    }
}
