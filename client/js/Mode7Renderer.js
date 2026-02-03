// Mode7Renderer.js - Pseudo-3D ground plane projection (F-Zero / Super Mario Kart style)

export class Mode7Renderer {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assets = assets;

        // Rendering dimensions
        this.width = canvas.width;
        this.height = canvas.height;

        // Horizon position (where sky meets ground)
        this.horizonY = Math.floor(this.height * 0.35);

        // Ground texture (will be built from track data)
        this.groundTexture = null;
        this.groundCanvas = null;
        this.groundCtx = null;

        // Tile size in ground texture
        this.tileSize = 128;

        // Create ImageData for direct pixel manipulation
        this.imageData = this.ctx.createImageData(this.width, this.height - this.horizonY);

        // Office ceiling colors (gray drop ceiling)
        this.skyColors = {
            top: { r: 212, g: 212, b: 212 },      // Light gray ceiling
            horizon: { r: 232, g: 232, b: 224 }   // Warm white fluorescent wash
        };

        // Store track reference for guardrail rendering
        this.track = null;
    }

    // Build the ground texture from track tile data
    buildGroundTexture(track) {
        this.track = track;

        const mapWidth = track.width * this.tileSize;
        const mapHeight = track.height * this.tileSize;

        // Create an offscreen canvas for the ground texture
        this.groundCanvas = document.createElement('canvas');
        this.groundCanvas.width = mapWidth;
        this.groundCanvas.height = mapHeight;
        this.groundCtx = this.groundCanvas.getContext('2d');

        // Office floor colors
        const carpetColors = ['#5A5A6E', '#565266']; // Gray-blue corporate carpet tiles
        const linoleumColors = ['#C8B896', '#C4B490', '#CCB89A']; // Beige linoleum

        for (let ty = 0; ty < track.height; ty++) {
            for (let tx = 0; tx < track.width; tx++) {
                const tile = track.getTile(tx, ty);
                const px = tx * this.tileSize;
                const py = ty * this.tileSize;

                if (tile === 0) {
                    // Off-road: Linoleum floor (break room / kitchen area)
                    const colorIndex = (tx + ty) % linoleumColors.length;
                    this.groundCtx.fillStyle = linoleumColors[colorIndex];
                    this.groundCtx.fillRect(px, py, this.tileSize, this.tileSize);
                } else {
                    // Road: Corporate carpet tiles
                    const colorIndex = (tx + ty) % 2;
                    this.groundCtx.fillStyle = carpetColors[colorIndex];
                    this.groundCtx.fillRect(px, py, this.tileSize, this.tileSize);
                }
            }
        }

        // Draw floor markings (tape lines instead of guardrails)
        this.drawFloorMarkings(track);

        // Get the image data for fast sampling
        this.groundTexture = this.groundCtx.getImageData(0, 0, mapWidth, mapHeight);
    }

    // Draw floor tape and transition strips
    drawFloorMarkings(track) {
        const ctx = this.groundCtx;
        const ts = this.tileSize;

        const left = track.roadLeft;
        const right = track.roadRight;
        const top = track.roadTop;
        const bottom = track.roadBottom;
        const w = track.roadWidth;

        // Stripe width for floor tape
        const stripeWidth = 6;
        const halfStripe = stripeWidth / 2;

        // === Authoritative edge positions (world units) ===
        const outerTop = top * ts;
        const outerBottom = (bottom + w) * ts;
        const outerLeft = left * ts;
        const outerRight = (right + w) * ts;

        const innerTop = (top + w) * ts;
        const innerBottom = bottom * ts;
        const innerLeft = (left + w) * ts;
        const innerRight = right * ts;

        // Outer edges: Dark tan transition strip (carpet meets linoleum)
        ctx.fillStyle = '#8B7355';

        // Top outer edge
        ctx.fillRect(outerLeft - halfStripe, outerTop - halfStripe,
                     outerRight - outerLeft + stripeWidth, stripeWidth);

        // Bottom outer edge
        ctx.fillRect(outerLeft - halfStripe, outerBottom - halfStripe,
                     outerRight - outerLeft + stripeWidth, stripeWidth);

        // Left outer edge
        ctx.fillRect(outerLeft - halfStripe, outerTop - halfStripe,
                     stripeWidth, outerBottom - outerTop + stripeWidth);

        // Right outer edge
        ctx.fillRect(outerRight - halfStripe, outerTop - halfStripe,
                     stripeWidth, outerBottom - outerTop + stripeWidth);

        // Inner edges: Gray (cubicle partition base)
        ctx.fillStyle = '#A0A0A0';

        // Inner top
        ctx.fillRect(innerLeft, innerTop - halfStripe,
                     innerRight - innerLeft, stripeWidth);

        // Inner bottom
        ctx.fillRect(innerLeft, innerBottom - halfStripe,
                     innerRight - innerLeft, stripeWidth);

        // Inner left
        ctx.fillRect(innerLeft - halfStripe, innerTop,
                     stripeWidth, innerBottom - innerTop);

        // Inner right
        ctx.fillRect(innerRight - halfStripe, innerTop,
                     stripeWidth, innerBottom - innerTop);

        // Yellow floor tape center line (caution tape style)
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 20]);

        // Center line on horizontal sections
        const roadCenterY_top = (top + w / 2) * ts;
        const roadCenterY_bottom = (bottom + w / 2) * ts;

        ctx.beginPath();
        ctx.moveTo(innerLeft, roadCenterY_top);
        ctx.lineTo(innerRight, roadCenterY_top);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(innerLeft, roadCenterY_bottom);
        ctx.lineTo(innerRight, roadCenterY_bottom);
        ctx.stroke();

        // Center line on vertical sections
        const roadCenterX_left = (left + w / 2) * ts;
        const roadCenterX_right = (right + w / 2) * ts;

        ctx.beginPath();
        ctx.moveTo(roadCenterX_left, innerTop);
        ctx.lineTo(roadCenterX_left, innerBottom);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(roadCenterX_right, innerTop);
        ctx.lineTo(roadCenterX_right, innerBottom);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    // Render the office ceiling
    renderSky() {
        const ctx = this.ctx;

        // Draw ceiling gradient
        for (let y = 0; y < this.horizonY; y++) {
            const t = y / this.horizonY;
            const r = Math.floor(this.skyColors.top.r + (this.skyColors.horizon.r - this.skyColors.top.r) * t);
            const g = Math.floor(this.skyColors.top.g + (this.skyColors.horizon.g - this.skyColors.top.g) * t);
            const b = Math.floor(this.skyColors.top.b + (this.skyColors.horizon.b - this.skyColors.top.b) * t);

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, y, this.width, 1);
        }

        // Draw subtle ceiling tile grid lines near horizon
        ctx.strokeStyle = 'rgba(180, 180, 180, 0.3)';
        ctx.lineWidth = 1;
        const gridLines = [0.6, 0.7, 0.8, 0.9];
        for (const t of gridLines) {
            const y = Math.floor(this.horizonY * t);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Fluorescent light strip at horizon
        ctx.fillStyle = 'rgba(255, 255, 238, 0.6)';
        ctx.fillRect(0, this.horizonY - 3, this.width, 3);
    }

    // Sample a pixel from the ground texture
    sampleGround(worldX, worldY) {
        if (!this.groundTexture) {
            return { r: 90, g: 90, b: 110, a: 255 }; // Default carpet gray
        }

        // Wrap coordinates
        const texWidth = this.groundTexture.width;
        const texHeight = this.groundTexture.height;

        let tx = Math.floor(worldX) % texWidth;
        let ty = Math.floor(worldY) % texHeight;

        if (tx < 0) tx += texWidth;
        if (ty < 0) ty += texHeight;

        const idx = (ty * texWidth + tx) * 4;
        return {
            r: this.groundTexture.data[idx],
            g: this.groundTexture.data[idx + 1],
            b: this.groundTexture.data[idx + 2],
            a: 255
        };
    }

    // Render the ground plane using Mode 7 projection
    renderGround(camera) {
        const data = this.imageData.data;
        const cos = Math.cos(camera.angle);
        const sin = Math.sin(camera.angle);

        // Scaling factor for perspective
        const scaleY = camera.height;

        // Fog color matches ceiling gray
        const fogR = 212, fogG = 212, fogB = 212;

        for (let screenY = 0; screenY < this.height - this.horizonY; screenY++) {
            // Distance from camera to this scanline
            const realY = screenY + 1; // Avoid division by zero
            const distance = (scaleY * this.height) / (realY * 2);

            // Calculate world position for the center of this scanline
            const worldCenterX = camera.x + cos * distance;
            const worldCenterY = camera.y + sin * distance;

            // Width of this scanline in world units
            const lineWidth = distance * 1.5;

            for (let screenX = 0; screenX < this.width; screenX++) {
                // Normalized screen X (-1 to 1)
                const nx = (screenX / this.width) * 2 - 1;

                // World position for this pixel
                const worldX = worldCenterX - sin * nx * lineWidth;
                const worldY = worldCenterY + cos * nx * lineWidth;

                // Sample the ground texture
                const color = this.sampleGround(worldX, worldY);

                // Apply distance fog (fades to ceiling gray)
                const fogFactor = Math.min(1, distance / 1200);

                const pixelIdx = (screenY * this.width + screenX) * 4;
                data[pixelIdx] = Math.floor(color.r * (1 - fogFactor) + fogR * fogFactor);
                data[pixelIdx + 1] = Math.floor(color.g * (1 - fogFactor) + fogG * fogFactor);
                data[pixelIdx + 2] = Math.floor(color.b * (1 - fogFactor) + fogB * fogFactor);
                data[pixelIdx + 3] = 255;
            }
        }

        // Draw the ground
        this.ctx.putImageData(this.imageData, 0, this.horizonY);
    }

    // Full render pass
    render(camera) {
        this.renderSky();
        this.renderGround(camera);
    }
}
