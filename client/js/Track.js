// Track.js - Track/map data and collision detection

export class Track {
    constructor() {
        // Map dimensions in tiles
        this.width = 32;
        this.height = 32;

        // Tile size in world units
        this.tileSize = 128;

        // Tile map (0 = grass, 1+ = road variants)
        this.tiles = [];

        // Trackside obstacles (barriers + decorative)
        this.obstacles = [];

        // Track boundaries - defines the racing surface
        this.roadLeft = 10;
        this.roadRight = 22;
        this.roadTop = 10;
        this.roadBottom = 22;
        this.roadWidth = 3; // tiles wide

        // Guardrail collision width (in world units)
        this.guardrailWidth = 50;

        // Tile type to asset mapping
        this.tileAssets = {
            1: 'road_straight_v',    // Vertical road
            2: 'road_straight_h',    // Horizontal road
            3: 'road_curve_ne',      // Curve NE
            4: 'road_curve_nw',      // Curve NW
            5: 'road_curve_se',      // Curve SE
            6: 'road_curve_sw',      // Curve SW
            7: 'road_marked_v',      // Vertical with markings
            8: 'road_marked_h',      // Horizontal with markings
        };
    }

    // Generate a simple oval track for Level 1 - OFFICE INTERIOR THEME
    generateLevel1() {
        // Initialize with grass (linoleum floor)
        this.tiles = new Array(this.width * this.height).fill(0);

        const left = this.roadLeft;
        const right = this.roadRight;
        const top = this.roadTop;
        const bottom = this.roadBottom;
        const w = this.roadWidth;
        const ts = this.tileSize;

        // Fill the road - horizontal sections (top and bottom)
        // Top road: tiles top, top+1, top+2 (going down)
        // Bottom road: tiles bottom, bottom+1, bottom+2 (going down)
        for (let x = left; x <= right + w; x++) {
            for (let i = 0; i < w; i++) {
                this.setTile(x, top + i, 2);      // Top horizontal
                this.setTile(x, bottom + i, 2);  // Bottom horizontal
            }
        }

        // Fill the road - vertical sections (left and right)
        // Left road: tiles left, left+1, left+2 (going right)
        // Right road: tiles right, right+1, right+2 (going right)
        for (let y = top; y <= bottom + w; y++) {
            for (let i = 0; i < w; i++) {
                this.setTile(left + i, y, 1);     // Left vertical
                this.setTile(right + i, y, 1);   // Right vertical
            }
        }

        // Initialize obstacles array
        this.obstacles = [];

        // === Authoritative edge positions (world units) ===
        const outerTop = top * ts;
        const outerBottom = (bottom + w) * ts;
        const outerLeft = left * ts;
        const outerRight = (right + w) * ts;

        const innerTopEdge = (top + w) * ts;
        const innerBottomEdge = bottom * ts;
        const innerLeftEdge = (left + w) * ts;
        const innerRightEdge = right * ts;

        // Barrier spacing in world units
        const barrierSpacing = 120;

        // ===== OUTER BARRIERS (cubicle walls and filing cabinets) =====
        const outerTypes = ['cubicle_wall', 'cubicle_wall_tall', 'filing_cabinet'];

        // Outer top edge
        for (let x = outerLeft; x <= outerRight; x += barrierSpacing) {
            const typeIndex = Math.floor(x / barrierSpacing) % outerTypes.length;
            this.obstacles.push({
                x: x, y: outerTop,
                type: outerTypes[typeIndex],
                scaleX: 1.2, scaleY: 1.2
            });
        }

        // Outer bottom edge
        for (let x = outerLeft; x <= outerRight; x += barrierSpacing) {
            const typeIndex = Math.floor(x / barrierSpacing) % outerTypes.length;
            this.obstacles.push({
                x: x, y: outerBottom,
                type: outerTypes[typeIndex],
                scaleX: 1.2, scaleY: 1.2
            });
        }

        // Outer left edge
        for (let y = outerTop; y <= outerBottom; y += barrierSpacing) {
            const typeIndex = Math.floor(y / barrierSpacing) % outerTypes.length;
            this.obstacles.push({
                x: outerLeft, y: y,
                type: outerTypes[typeIndex],
                scaleX: 1.2, scaleY: 1.2
            });
        }

        // Outer right edge
        for (let y = outerTop; y <= outerBottom; y += barrierSpacing) {
            const typeIndex = Math.floor(y / barrierSpacing) % outerTypes.length;
            this.obstacles.push({
                x: outerRight, y: y,
                type: outerTypes[typeIndex],
                scaleX: 1.2, scaleY: 1.2
            });
        }

        // ===== INNER BARRIERS (filing cabinets - center of office) =====
        const innerTypes = ['filing_cabinet', 'filing_cabinet_short'];
        const innerSpacing = 140;

        // Inner top edge
        for (let x = innerLeftEdge; x <= innerRightEdge; x += innerSpacing) {
            const typeIndex = Math.floor(x / innerSpacing) % innerTypes.length;
            this.obstacles.push({
                x: x, y: innerTopEdge,
                type: innerTypes[typeIndex],
                scaleX: 1.0, scaleY: 1.0
            });
        }

        // Inner bottom edge
        for (let x = innerLeftEdge; x <= innerRightEdge; x += innerSpacing) {
            const typeIndex = Math.floor(x / innerSpacing) % innerTypes.length;
            this.obstacles.push({
                x: x, y: innerBottomEdge,
                type: innerTypes[typeIndex],
                scaleX: 1.0, scaleY: 1.0
            });
        }

        // Inner left edge
        for (let y = innerTopEdge; y <= innerBottomEdge; y += innerSpacing) {
            const typeIndex = Math.floor(y / innerSpacing) % innerTypes.length;
            this.obstacles.push({
                x: innerLeftEdge, y: y,
                type: innerTypes[typeIndex],
                scaleX: 1.0, scaleY: 1.0
            });
        }

        // Inner right edge
        for (let y = innerTopEdge; y <= innerBottomEdge; y += innerSpacing) {
            const typeIndex = Math.floor(y / innerSpacing) % innerTypes.length;
            this.obstacles.push({
                x: innerRightEdge, y: y,
                type: innerTypes[typeIndex],
                scaleX: 1.0, scaleY: 1.0
            });
        }

        // ===== NEAR-TRACK DECORATION (scattered between barriers) =====
        const nearTrackTypes = ['office_chair', 'water_cooler', 'printer', 'recycling_bin', 'potted_ficus'];
        const nearSpacing = 350;
        const nearOffset = 60; // Push slightly away from track

        // Scattered along outer edges (offset outward)
        for (let x = outerLeft + 100; x <= outerRight - 100; x += nearSpacing) {
            // Top side (above track)
            this.obstacles.push({
                x: x + (Math.random() - 0.5) * 80,
                y: outerTop - nearOffset - Math.random() * 40,
                type: nearTrackTypes[Math.floor(Math.random() * nearTrackTypes.length)],
                scaleX: 1.3, scaleY: 1.3
            });
            // Bottom side (below track)
            this.obstacles.push({
                x: x + (Math.random() - 0.5) * 80,
                y: outerBottom + nearOffset + Math.random() * 40,
                type: nearTrackTypes[Math.floor(Math.random() * nearTrackTypes.length)],
                scaleX: 1.3, scaleY: 1.3
            });
        }

        // Scattered along outer left/right
        for (let y = outerTop + 100; y <= outerBottom - 100; y += nearSpacing) {
            // Left side
            this.obstacles.push({
                x: outerLeft - nearOffset - Math.random() * 40,
                y: y + (Math.random() - 0.5) * 80,
                type: nearTrackTypes[Math.floor(Math.random() * nearTrackTypes.length)],
                scaleX: 1.3, scaleY: 1.3
            });
            // Right side
            this.obstacles.push({
                x: outerRight + nearOffset + Math.random() * 40,
                y: y + (Math.random() - 0.5) * 80,
                type: nearTrackTypes[Math.floor(Math.random() * nearTrackTypes.length)],
                scaleX: 1.3, scaleY: 1.3
            });
        }

        // ===== FAR DECORATION (office furniture in the distance) =====
        const farTypes = ['desk_with_monitor', 'whiteboard', 'vending_machine', 'conference_table', 'caution_sign', 'arcade_machine'];

        for (let i = 0; i < 25; i++) {
            const tx = Math.random() * this.width;
            const ty = Math.random() * this.height;

            // Only place far from the track
            if (tx < left - 3 || tx > right + w + 3 ||
                ty < top - 3 || ty > bottom + w + 3) {
                const type = farTypes[Math.floor(Math.random() * farTypes.length)];
                // Scale based on object type
                let scale = 3;
                if (type === 'vending_machine') scale = 4;
                if (type === 'conference_table') scale = 3.5;
                if (type === 'caution_sign') scale = 2.5;
                if (type === 'arcade_machine') scale = 3.5;

                this.obstacles.push({
                    x: tx * ts,
                    y: ty * ts,
                    type: type,
                    scaleX: scale,
                    scaleY: scale
                });
            }
        }

        // ===== CENTER ISLAND (inside the track loop - visible office space) =====
        const centerTypes = ['desk_with_monitor', 'office_chair', 'potted_ficus', 'printer', 'water_cooler', 'conference_table'];
        const centerSpacing = 200;

        // Fill the center island with office furniture
        for (let x = innerLeftEdge + 100; x < innerRightEdge - 100; x += centerSpacing) {
            for (let y = innerTopEdge + 100; y < innerBottomEdge - 100; y += centerSpacing) {
                const type = centerTypes[Math.floor(Math.random() * centerTypes.length)];
                this.obstacles.push({
                    x: x + (Math.random() - 0.5) * 80,
                    y: y + (Math.random() - 0.5) * 80,
                    type: type,
                    scaleX: 1.5, scaleY: 1.5
                });
            }
        }

        // Add some scattered caution signs near the track (fun office chaos)
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const radius = 200 + Math.random() * 100;
            const cx = (left + right + w) / 2 * ts;
            const cy = (top + bottom + w) / 2 * ts;

            // Place in the center area (inside the track)
            this.obstacles.push({
                x: cx + Math.cos(angle) * radius * 2,
                y: cy + Math.sin(angle) * radius * 2,
                type: 'caution_sign',
                scaleX: 2,
                scaleY: 2
            });
        }

        // Snack station on the far side of track from spawn
        // Spawn is at bottom-right heading west; station goes on top straightaway
        this.snackStations = [{
            x: (left + 4) * ts,
            y: (top + w / 2) * ts,
            radius: 150,
            delivered: false,
            id: 1
        }];

        // Start/finish zone — same area as spawn
        const startPos = this.getStartPosition();
        this.startFinishZone = {
            x: startPos.x,
            y: startPos.y,
            radius: 200
        };

        return this;
    }

    // Check if a world position is on a guardrail - returns wall normal for collision response
    // Asymmetric collision zone: 70% extends into road, 30% extends outward
    isOnGuardrail(worldX, worldY) {
        const tileX = worldX / this.tileSize;
        const tileY = worldY / this.tileSize;

        const left = this.roadLeft;
        const right = this.roadRight;
        const top = this.roadTop;
        const bottom = this.roadBottom;
        const w = this.roadWidth;

        // Asymmetric collision zone in tiles
        const fullWidth = this.guardrailWidth / this.tileSize;
        const inward = fullWidth * 0.7;   // 70% extends into road
        const outward = fullWidth * 0.3;  // 30% extends outside

        // Check outer guardrails — asymmetric zone biased into road
        // Top outer (edge at tileY = top) - inward = +Y (down into road), outward = -Y
        if (tileY >= top - outward && tileY <= top + inward && tileX >= left - outward && tileX <= right + w + outward) {
            return { side: 'outer', normalX: 0, normalY: 1 };
        }
        // Bottom outer (edge at tileY = bottom + w) - inward = -Y (up into road), outward = +Y
        if (tileY >= bottom + w - inward && tileY <= bottom + w + outward && tileX >= left - outward && tileX <= right + w + outward) {
            return { side: 'outer', normalX: 0, normalY: -1 };
        }
        // Left outer (edge at tileX = left) - inward = +X (right into road), outward = -X
        if (tileX >= left - outward && tileX <= left + inward && tileY >= top - outward && tileY <= bottom + w + outward) {
            return { side: 'outer', normalX: 1, normalY: 0 };
        }
        // Right outer (edge at tileX = right + w) - inward = -X (left into road), outward = +X
        if (tileX >= right + w - inward && tileX <= right + w + outward && tileY >= top - outward && tileY <= bottom + w + outward) {
            return { side: 'outer', normalX: -1, normalY: 0 };
        }

        // Check inner guardrails
        const innerLeft = left + w;
        const innerRight = right;
        const innerTop = top + w;
        const innerBottom = bottom;

        // Inner top (edge at tileY = innerTop) - inward = -Y (up into road), outward = +Y
        if (tileY >= innerTop - inward && tileY <= innerTop + outward && tileX >= innerLeft - outward && tileX <= innerRight + outward) {
            return { side: 'inner', normalX: 0, normalY: -1 };
        }
        // Inner bottom (edge at tileY = innerBottom) - inward = +Y (down into road), outward = -Y
        if (tileY >= innerBottom - outward && tileY <= innerBottom + inward && tileX >= innerLeft - outward && tileX <= innerRight + outward) {
            return { side: 'inner', normalX: 0, normalY: 1 };
        }
        // Inner left (edge at tileX = innerLeft) - inward = -X (left into road), outward = +X
        if (tileX >= innerLeft - inward && tileX <= innerLeft + outward && tileY >= innerTop - outward && tileY <= innerBottom + outward) {
            return { side: 'inner', normalX: -1, normalY: 0 };
        }
        // Inner right (edge at tileX = innerRight) - inward = +X (right into road), outward = -X
        if (tileX >= innerRight - outward && tileX <= innerRight + inward && tileY >= innerTop - outward && tileY <= innerBottom + outward) {
            return { side: 'inner', normalX: 1, normalY: 0 };
        }

        return null;
    }

    setTile(x, y, value) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.tiles[y * this.width + x] = value;
        }
    }

    getTile(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.tiles[y * this.width + x];
        }
        return 0; // Grass outside bounds
    }

    getTileAsset(tileValue) {
        return this.tileAssets[tileValue] || 'grass01';
    }

    // Check collision at world position
    checkCollision(worldX, worldY) {
        const tileX = Math.floor(worldX / this.tileSize);
        const tileY = Math.floor(worldY / this.tileSize);

        const tile = this.getTile(tileX, tileY);

        // Check if on guardrail (wall collision) - now returns normal
        const guardrail = this.isOnGuardrail(worldX, worldY);
        if (guardrail) {
            return {
                type: 'wall',
                normalX: guardrail.normalX,
                normalY: guardrail.normalY,
                side: guardrail.side
            };
        }

        if (tile === 0) {
            // On grass - slow down
            return { type: 'grass', friction: 0.95 };
        }

        // On road
        return { type: 'road', friction: 1.0 };
    }

    // Get start position
    getStartPosition() {
        // Start on the bottom straightaway, facing left (west) to go counter-clockwise
        // Bottom road spans from tile bottom to (bottom + roadWidth - 1)
        // So tiles 22, 23, 24 for bottom=22, width=3
        // Center of road is at tile (bottom + roadWidth/2) = 23.5
        const startX = (this.roadRight) * this.tileSize; // Middle of right side
        const startY = (this.roadBottom + this.roadWidth / 2) * this.tileSize; // Center of bottom road
        const startHeading = Math.PI;  // Facing left (west)

        return { x: startX, y: startY, heading: startHeading };
    }
}
