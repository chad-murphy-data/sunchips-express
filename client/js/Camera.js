// Camera.js - Camera that follows the vehicle

export class Camera {
    constructor() {
        // Camera position on 2D map
        this.x = 0;
        this.y = 0;

        // Camera angle (matches vehicle heading)
        this.angle = 0;

        // Camera height above ground plane
        this.height = 200;

        // Field of view parameters
        this.fov = 90;  // degrees
        this.nearPlane = 1;
        this.farPlane = 1000;

        // Smoothing for camera movement
        this.smoothing = 0.1;
    }

    follow(vehicle, instant = false) {
        // Target position is slightly behind the vehicle
        const followDistance = 50;
        const targetX = vehicle.x - Math.cos(vehicle.heading) * followDistance;
        const targetY = vehicle.y - Math.sin(vehicle.heading) * followDistance;
        const targetAngle = vehicle.heading;

        if (instant) {
            this.x = targetX;
            this.y = targetY;
            this.angle = targetAngle;
        } else {
            // Smooth interpolation
            this.x += (targetX - this.x) * this.smoothing;
            this.y += (targetY - this.y) * this.smoothing;

            // Angle interpolation (handle wraparound)
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * this.smoothing;
        }
    }

    // Set position directly (for debugging/free camera mode)
    setPosition(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
    }
}
