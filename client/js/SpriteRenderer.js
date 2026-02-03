// SpriteRenderer.js - Renders trackside objects and the player's golf cart

export class SpriteRenderer {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assets = assets;

        this.width = canvas.width;
        this.height = canvas.height;
        this.horizonY = Math.floor(this.height * 0.35);
    }

    // Transform world coordinates to screen coordinates
    worldToScreen(worldX, worldY, camera) {
        // Position relative to camera
        const dx = worldX - camera.x;
        const dy = worldY - camera.y;

        // Rotate to camera space
        const cos = Math.cos(-camera.angle);
        const sin = Math.sin(-camera.angle);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        // ry is now the depth (distance in front of camera)
        // rx is the horizontal offset

        if (ry <= 0) {
            // Behind camera
            return null;
        }

        // Position projection — MUST match Mode7Renderer's ground plane
        // Mode7 uses lineWidth = distance * 1.5, so effective focal length = width / 1.5
        const focalLength = this.width / 1.5;
        const screenX = this.width / 2 + rx * (focalLength / ry);

        // Y position: further objects should be closer to horizon
        // Objects at ground level appear at the scanline where Mode7 renders that distance
        const groundY = this.horizonY + (camera.height * this.height) / (ry * 2);

        // Scale for sprite sizing — independent of position focal length
        // This controls how big sprites draw, not where they are
        const sizeScale = (camera.height * this.height) / (ry * 2) / 100;

        return {
            x: screenX,
            y: groundY,
            scale: sizeScale,
            depth: ry
        };
    }

    // Render all trackside sprites
    renderSprites(sprites, camera) {
        // Transform all sprites to screen space
        const visibleSprites = [];

        for (const sprite of sprites) {
            const screen = this.worldToScreen(sprite.x, sprite.y, camera);

            if (screen && screen.depth > 10 && screen.depth < 1000) {
                visibleSprites.push({
                    ...sprite,
                    screenX: screen.x,
                    screenY: screen.y,
                    scale: screen.scale,
                    depth: screen.depth
                });
            }
        }

        // Sort by depth (far to near) for painter's algorithm
        visibleSprites.sort((a, b) => b.depth - a.depth);

        // Draw each sprite
        for (const sprite of visibleSprites) {
            const img = this.assets.get(sprite.type);
            if (!img) continue;

            // Calculate draw dimensions
            // sprite.scale is perspective scale (smaller = farther)
            // sprite.scaleX/scaleY are world-space multipliers for the object's base size
            const worldScaleX = sprite.scaleX || 1;
            const worldScaleY = sprite.scaleY || 1;

            // Base size in pixels, scaled by perspective
            const baseSize = 50; // Base reference size for sprites
            const perspectiveSize = baseSize * sprite.scale;

            const drawWidth = perspectiveSize * worldScaleX;
            const drawHeight = perspectiveSize * worldScaleY * (img.height / img.width); // Maintain aspect ratio

            // Position (centered horizontally, bottom-aligned vertically)
            const drawX = sprite.screenX - drawWidth / 2;
            const drawY = sprite.screenY - drawHeight;

            // Clip if mostly off-screen
            if (drawX + drawWidth < 0 || drawX > this.width) continue;
            if (drawY + drawHeight < 0 || drawY > this.height) continue;

            this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }
    }

    // Render the player's golf cart (fixed position at bottom center)
    renderVehicle(vehicle) {
        const spriteKey = vehicle.getSpriteKey();
        const img = this.assets.get(spriteKey);

        if (!img) return;

        // Fixed position at bottom center of screen
        const scale = 4; // Scale up the 64x64 sprite
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const drawX = (this.width - drawWidth) / 2;
        const drawY = this.height - drawHeight - 20; // 20px from bottom

        this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }
}
