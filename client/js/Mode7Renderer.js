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

        // Sky gradient colors
        this.skyColors = {
            top: { r: 26, g: 26, b: 46 },      // Dark blue
            horizon: { r: 135, g: 206, b: 235 } // Light blue
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

        // Fill with grass base
        const grassTiles = ['grass01', 'grass02', 'grass03', 'grass04'];

        for (let ty = 0; ty < track.height; ty++) {
            for (let tx = 0; tx < track.width; tx++) {
                const tile = track.getTile(tx, ty);
                const px = tx * this.tileSize;
                const py = ty * this.tileSize;

                if (tile === 0) {
                    // Grass - use random variation
                    const grassIndex = (tx * 7 + ty * 13) % grassTiles.length;
                    const grassImg = this.assets.get(grassTiles[grassIndex]);
                    if (grassImg) {
                        this.groundCtx.drawImage(grassImg, px, py, this.tileSize, this.tileSize);
                    } else {
                        // Fallback green
                        this.groundCtx.fillStyle = '#228B22';
                        this.groundCtx.fillRect(px, py, this.tileSize, this.tileSize);
                    }
                } else {
                    // Road tile - draw as solid gray for cleaner look
                    this.groundCtx.fillStyle = '#404040';
                    this.groundCtx.fillRect(px, py, this.tileSize, this.tileSize);
                }
            }
        }

        // Draw guardrails as colored stripes
        this.drawGuardrails(track);

        // Get the image data for fast sampling
        this.groundTexture = this.groundCtx.getImageData(0, 0, mapWidth, mapHeight);
    }

    // Draw F-Zero style guardrail stripes
    drawGuardrails(track) {
        const ctx = this.groundCtx;
        const ts = this.tileSize;

        const left = track.roadLeft;
        const right = track.roadRight;
        const top = track.roadTop;
        const bottom = track.roadBottom;
        const w = track.roadWidth;

        // Stripe width for the painted curb line
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

        // Outer guardrails (red) — stripe centered on edge
        ctx.fillStyle = '#FF0000';

        // Top outer edge (horizontal stripe centered on outerTop)
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

        // Inner guardrails (yellow) — stripe centered on edge
        ctx.fillStyle = '#FFD700';

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

        // Add white dashed center line on the road
        ctx.strokeStyle = '#FFFFFF';
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

    // Render the sky gradient
    renderSky() {
        const ctx = this.ctx;

        for (let y = 0; y < this.horizonY; y++) {
            const t = y / this.horizonY;
            const r = Math.floor(this.skyColors.top.r + (this.skyColors.horizon.r - this.skyColors.top.r) * t);
            const g = Math.floor(this.skyColors.top.g + (this.skyColors.horizon.g - this.skyColors.top.g) * t);
            const b = Math.floor(this.skyColors.top.b + (this.skyColors.horizon.b - this.skyColors.top.b) * t);

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, y, this.width, 1);
        }
    }

    // Sample a pixel from the ground texture
    sampleGround(worldX, worldY) {
        if (!this.groundTexture) {
            return { r: 34, g: 139, b: 34, a: 255 }; // Default green
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

                // Apply distance fog
                const fogFactor = Math.min(1, distance / 1200);
                const fogR = 135, fogG = 206, fogB = 235; // Match horizon color

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
