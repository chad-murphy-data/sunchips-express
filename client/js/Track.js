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
        this.guardrailWidth = 20;

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

    // Generate a simple oval track for Level 1
    generateLevel1() {
        // Initialize with grass
        this.tiles = new Array(this.width * this.height).fill(0);

        const left = this.roadLeft;
        const right = this.roadRight;
        const top = this.roadTop;
        const bottom = this.roadBottom;
        const w = this.roadWidth;
        const ts = this.tileSize;

        // Fill the road - horizontal sections (top and bottom)
        for (let x = left; x <= right; x++) {
            for (let i = 0; i < w; i++) {
                this.setTile(x, top + i, 2);      // Top horizontal
                this.setTile(x, bottom - i, 2);  // Bottom horizontal
            }
        }

        // Fill the road - vertical sections (left and right)
        for (let y = top; y <= bottom; y++) {
            for (let i = 0; i < w; i++) {
                this.setTile(left + i, y, 1);     // Left vertical
                this.setTile(right - i, y, 1);   // Right vertical
            }
        }

        // Initialize obstacles array
        this.obstacles = [];

        // Barrier spacing in world units (wider gaps for cleaner look)
        const barrierSpacing = 120;

        // ===== OUTER GUARDRAILS (red/white striped posts) =====

        // Outer top edge
        const outerTopY = (top - 0.1) * ts;
        for (let x = left * ts; x <= (right + w) * ts; x += barrierSpacing) {
            this.obstacles.push({
                x: x,
                y: outerTopY,
                type: (Math.floor(x / barrierSpacing) % 2 === 0) ? 'guardrail_red' : 'guardrail_white',
                scaleX: 1.2,
                scaleY: 1.2
            });
        }

        // Outer bottom edge
        const outerBottomY = (bottom + w + 0.1) * ts;
        for (let x = left * ts; x <= (right + w) * ts; x += barrierSpacing) {
            this.obstacles.push({
                x: x,
                y: outerBottomY,
                type: (Math.floor(x / barrierSpacing) % 2 === 0) ? 'guardrail_red' : 'guardrail_white',
                scaleX: 1.2,
                scaleY: 1.2
            });
        }

        // Outer left edge
        const outerLeftX = (left - 0.1) * ts;
        for (let y = top * ts; y <= (bottom + w) * ts; y += barrierSpacing) {
            this.obstacles.push({
                x: outerLeftX,
                y: y,
                type: (Math.floor(y / barrierSpacing) % 2 === 0) ? 'guardrail_red' : 'guardrail_white',
                scaleX: 1.2,
                scaleY: 1.2
            });
        }

        // Outer right edge
        const outerRightX = (right + w + 0.1) * ts;
        for (let y = top * ts; y <= (bottom + w) * ts; y += barrierSpacing) {
            this.obstacles.push({
                x: outerRightX,
                y: y,
                type: (Math.floor(y / barrierSpacing) % 2 === 0) ? 'guardrail_red' : 'guardrail_white',
                scaleX: 1.2,
                scaleY: 1.2
            });
        }

        // ===== INNER GUARDRAILS (yellow bollards) =====

        const innerLeft = left + w;
        const innerRight = right;
        const innerTop = top + w;
        const innerBottom = bottom;
        const innerSpacing = 140;

        // Inner top edge
        const innerTopY = (innerTop + 0.1) * ts;
        for (let x = innerLeft * ts; x <= innerRight * ts; x += innerSpacing) {
            this.obstacles.push({
                x: x,
                y: innerTopY,
                type: 'guardrail_yellow',
                scaleX: 1.0,
                scaleY: 1.0
            });
        }

        // Inner bottom edge
        const innerBottomY = (innerBottom + 0.1) * ts;
        for (let x = innerLeft * ts; x <= innerRight * ts; x += innerSpacing) {
            this.obstacles.push({
                x: x,
                y: innerBottomY,
                type: 'guardrail_yellow',
                scaleX: 1.0,
                scaleY: 1.0
            });
        }

        // Inner left edge
        const innerLeftX = (innerLeft + 0.1) * ts;
        for (let y = innerTop * ts; y <= innerBottom * ts; y += innerSpacing) {
            this.obstacles.push({
                x: innerLeftX,
                y: y,
                type: 'guardrail_yellow',
                scaleX: 1.0,
                scaleY: 1.0
            });
        }

        // Inner right edge
        const innerRightX = (innerRight + 0.1) * ts;
        for (let y = innerTop * ts; y <= innerBottom * ts; y += innerSpacing) {
            this.obstacles.push({
                x: innerRightX,
                y: y,
                type: 'guardrail_yellow',
                scaleX: 1.0,
                scaleY: 1.0
            });
        }

        // ===== DECORATIVE TREES (far from track) =====
        for (let i = 0; i < 20; i++) {
            const tx = Math.random() * this.width;
            const ty = Math.random() * this.height;

            // Only place far from the track
            if (tx < left - 3 || tx > right + w + 3 ||
                ty < top - 3 || ty > bottom + w + 3) {
                this.obstacles.push({
                    x: tx * ts,
                    y: ty * ts,
                    type: Math.random() > 0.5 ? 'tree_large' : 'tree_small',
                    scaleX: 4,
                    scaleY: 4
                });
            }
        }

        return this;
    }

    // Check if a world position is on a guardrail - returns wall normal for collision response
    isOnGuardrail(worldX, worldY) {
        const tileX = worldX / this.tileSize;
        const tileY = worldY / this.tileSize;

        const left = this.roadLeft;
        const right = this.roadRight;
        const top = this.roadTop;
        const bottom = this.roadBottom;
        const w = this.roadWidth;

        // Guardrail width in tiles
        const gw = this.guardrailWidth / this.tileSize;

        // Check outer guardrails - return normal pointing INTO the track
        // Top outer (normal points down, into track)
        if (tileY >= top - gw && tileY < top && tileX >= left - gw && tileX <= right + w + gw) {
            return { side: 'outer', normalX: 0, normalY: 1 };
        }
        // Bottom outer (normal points up, into track)
        if (tileY > bottom + w && tileY <= bottom + w + gw && tileX >= left - gw && tileX <= right + w + gw) {
            return { side: 'outer', normalX: 0, normalY: -1 };
        }
        // Left outer (normal points right, into track)
        if (tileX >= left - gw && tileX < left && tileY >= top - gw && tileY <= bottom + w + gw) {
            return { side: 'outer', normalX: 1, normalY: 0 };
        }
        // Right outer (normal points left, into track)
        if (tileX > right + w && tileX <= right + w + gw && tileY >= top - gw && tileY <= bottom + w + gw) {
            return { side: 'outer', normalX: -1, normalY: 0 };
        }

        // Check inner guardrails - normal points OUTWARD from center (into the track)
        const innerLeft = left + w;
        const innerRight = right;
        const innerTop = top + w;
        const innerBottom = bottom;

        // Inner top (normal points up, away from center)
        if (tileY > innerTop - gw && tileY <= innerTop && tileX >= innerLeft && tileX <= innerRight) {
            return { side: 'inner', normalX: 0, normalY: -1 };
        }
        // Inner bottom (normal points down, away from center)
        if (tileY >= innerBottom && tileY < innerBottom + gw && tileX >= innerLeft && tileX <= innerRight) {
            return { side: 'inner', normalX: 0, normalY: 1 };
        }
        // Inner left (normal points left, away from center)
        if (tileX > innerLeft - gw && tileX <= innerLeft && tileY >= innerTop && tileY <= innerBottom) {
            return { side: 'inner', normalX: -1, normalY: 0 };
        }
        // Inner right (normal points right, away from center)
        if (tileX >= innerRight && tileX < innerRight + gw && tileY >= innerTop && tileY <= innerBottom) {
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
        const startX = (this.roadRight - 1) * this.tileSize;
        const startY = (this.roadBottom + 1.5) * this.tileSize;
        const startHeading = Math.PI;  // Facing left (west)

        return { x: startX, y: startY, heading: startHeading };
    }
}
