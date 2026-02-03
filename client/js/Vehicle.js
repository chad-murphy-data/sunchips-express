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

        // Physics constants - tuned for golf cart feel
        this.MAX_SPEED = 300;           // Max forward speed
        this.MAX_REVERSE_SPEED = 80;    // Much slower reverse
        this.ACCELERATION = 150;         // Forward acceleration rate
        this.REVERSE_ACCEL = 60;         // Slow reverse acceleration
        this.BRAKE_FORCE = 200;          // Braking rate
        this.FRICTION = 30;              // Natural slowdown

        // Steering constants - reduced for heavier feel
        this.TURN_RATE = 1.6;            // Base turn rate (radians/sec) - was 2.5
        this.MIN_TURN_SPEED = 0.3;       // Minimum speed ratio for turning
        this.STEER_RESPONSE = 4.0;       // Angular velocity smoothing (higher = snappier)

        // Angular velocity for steering inertia
        this.angularVelocity = 0;

        // Visual state for sprite selection
        this.steerState = 0;  // -1 left, 0 straight, 1 right
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
        // ===== SPEED UPDATE (with reverse support) =====
        if (pedalInput > 0) {
            if (this.speed < 0) {
                // Pressing gas while reversing = brake first
                this.speed += this.BRAKE_FORCE * dt;
            } else {
                // Normal forward acceleration
                this.speed += this.ACCELERATION * dt;
            }
        } else if (pedalInput < 0) {
            if (this.speed > 0) {
                // Pressing brake while moving forward = brake
                this.speed -= this.BRAKE_FORCE * dt;
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
            // Speed-dependent turning - harder to turn when fast
            const speedFactor = 1 - (absSpeed / this.MAX_SPEED) * 0.5;
            const direction = this.speed >= 0 ? 1 : -1;  // Invert steering when reversing

            // Target angular velocity based on input
            const targetTurnRate = steerInput * this.TURN_RATE * speedFactor * direction;

            // Smooth toward target (steering inertia)
            this.angularVelocity += (targetTurnRate - this.angularVelocity) * this.STEER_RESPONSE * dt;
        } else if (absSpeed > 0) {
            // Slow speed turning
            const direction = this.speed >= 0 ? 1 : -1;
            const targetTurnRate = steerInput * this.TURN_RATE * 0.5 * direction;
            this.angularVelocity += (targetTurnRate - this.angularVelocity) * this.STEER_RESPONSE * dt;
        }

        // Dampen angular velocity when not steering
        if (steerInput === 0) {
            this.angularVelocity *= (1 - 3.0 * dt);
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
                // Wall-slide collision response
                const vx = Math.cos(this.heading) * this.speed;
                const vy = Math.sin(this.heading) * this.speed;

                // Dot product with wall normal = component going into wall
                const normalDot = vx * wallCollision.normalX + vy * wallCollision.normalY;

                // Only respond if we're moving INTO the wall (dot < 0 means approaching)
                if (normalDot < 0) {
                    // Remove the into-wall component, keep the along-wall component
                    const slideVx = vx - normalDot * wallCollision.normalX;
                    const slideVy = vy - normalDot * wallCollision.normalY;

                    // Reconstruct speed and heading from slide vector
                    const newSpeed = Math.sqrt(slideVx * slideVx + slideVy * slideVy);
                    if (newSpeed > 1) {
                        this.heading = Math.atan2(slideVy, slideVx);
                        this.speed = newSpeed;
                    } else {
                        this.speed = 0;
                    }

                    // Scrape penalty - lose some extra speed on impact
                    this.speed *= 0.7;
                }

                // Minimal nudge away from wall (1 unit - use reverse if stuck)
                this.x = newX + wallCollision.normalX * 1;
                this.y = newY + wallCollision.normalY * 1;

            } else {
                // Check for grass (slowdown) at center position
                const centerCollision = track.checkCollision(newX, newY);

                if (centerCollision.type === 'grass') {
                    // Soft collision - slow down on grass
                    this.speed *= 0.98;
                }

                // Move to new position
                this.x = newX;
                this.y = newY;
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
}
