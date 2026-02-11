// Track.js - Track/map data and collision detection
// "Floor 3" — irregular office floor plan with varying corridor widths

export class Track {
    constructor() {
        // Map dimensions in tiles
        this.width = 40;
        this.height = 28;

        // Tile size in world units
        this.tileSize = 128;

        // Tile constants
        this.TILE_OFFROAD = 0;
        this.TILE_ROAD = 1;

        // Tile map (0 = offroad, 1 = road)
        this.tiles = [];

        // Trackside obstacles (barriers + decorative)
        this.obstacles = [];

        // Road region definitions (tile coordinates, inclusive)
        this.roadRegions = [
            { x1: 1, y1: 22, x2: 38, y2: 25, name: 'Grand Hallway' },
            { x1: 16, y1: 12, x2: 19, y2: 25, name: 'Left Vertical Connector' },
            { x1: 1, y1: 12, x2: 17, y2: 13, name: 'West Corridor' },
            { x1: 1, y1: 2, x2: 2, y2: 13, name: 'Left Vertical North' },
            { x1: 1, y1: 2, x2: 25, y2: 3, name: 'Executive Skyway' },
            { x1: 24, y1: 2, x2: 25, y2: 7, name: 'East Turn Down' },
            { x1: 24, y1: 6, x2: 37, y2: 7, name: 'East Wing' },
            { x1: 35, y1: 6, x2: 38, y2: 19, name: 'Right Vertical Descent' },
            { x1: 16, y1: 18, x2: 38, y2: 19, name: 'Bottom-Right Corridor' },
        ];

        // Bounding box for ThreeRenderer ceiling/light compat
        this.roadLeft = 1;
        this.roadRight = 38;
        this.roadTop = 2;
        this.roadBottom = 25;
        this.roadWidth = 0;

        // Guardrail collision width (in world units) — sub-tile edge detection threshold
        // Must match wallOffset (-15) in ThreeRenderer.getWallRuns() so collision
        // lines up with the visible wall meshes
        this.guardrailWidth = 15;

        // Precomputed wall normals for collision detection
        this.wallNormals = null;
    }

    // Generate the "Floor 3" track layout
    generateLevel1() {
        // Initialize all tiles as offroad
        this.tiles = new Array(this.width * this.height).fill(this.TILE_OFFROAD);

        // Fill road tiles from regions
        for (const region of this.roadRegions) {
            for (let y = region.y1; y <= region.y2; y++) {
                for (let x = region.x1; x <= region.x2; x++) {
                    this.setTile(x, y, this.TILE_ROAD);
                }
            }
        }

        // Precompute wall normals for fast collision detection
        this._precomputeWallNormals();

        // Verify track connectivity
        this._verifyConnectivity();

        const ts = this.tileSize;

        // 3 snack stations for 3 role swaps per lap
        this.snackStations = [
            { x: 8 * ts, y: 12.5 * ts, radius: 150, delivered: false, id: 1 },
            { x: 12 * ts, y: 2.5 * ts, radius: 150, delivered: false, id: 2 },
            { x: 36.5 * ts, y: 14 * ts, radius: 150, delivered: false, id: 3 },
        ];

        // Start/finish zone
        const startPos = this.getStartPosition();
        this.startFinishZone = {
            x: startPos.x,
            y: startPos.y,
            radius: 200
        };

        // Generate decorative obstacles
        this._generateObstacles();

        return this;
    }

    // Precompute wall normals for every offroad tile adjacent to road
    _precomputeWallNormals() {
        const size = this.width * this.height;
        this.wallNormals = new Array(size).fill(null);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getTile(x, y) !== this.TILE_OFFROAD) continue;

                // Check 4 orthogonal neighbors for road
                let nx = 0, ny = 0;
                if (this._isRoad(x - 1, y)) nx -= 1;
                if (this._isRoad(x + 1, y)) nx += 1;
                if (this._isRoad(x, y - 1)) ny -= 1;
                if (this._isRoad(x, y + 1)) ny += 1;

                const len = Math.sqrt(nx * nx + ny * ny);
                if (len > 0) {
                    this.wallNormals[y * this.width + x] = {
                        nx: nx / len,
                        ny: ny / len
                    };
                }
            }
        }
    }

    _isRoad(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.getTile(x, y) !== this.TILE_OFFROAD;
    }

    // Verify the track forms a connected loop via flood fill
    _verifyConnectivity() {
        const startTileX = 20;
        const startTileY = 23;

        const visited = new Set();
        const stack = [[startTileX, startTileY]];
        visited.add(`${startTileX},${startTileY}`);

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
            for (const [nx, ny] of neighbors) {
                const key = `${nx},${ny}`;
                if (!visited.has(key) && this._isRoad(nx, ny)) {
                    visited.add(key);
                    stack.push([nx, ny]);
                }
            }
        }

        // Count total road tiles
        let totalRoad = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getTile(x, y) !== this.TILE_OFFROAD) totalRoad++;
            }
        }

        if (visited.size !== totalRoad) {
            console.warn(`Track connectivity issue: ${visited.size} reachable of ${totalRoad} road tiles`);
        } else {
            console.log(`Track verified: ${totalRoad} connected road tiles`);
        }
    }

    // Generate decorative obstacles in offroad areas
    _generateObstacles() {
        this.obstacles = [];
        const ts = this.tileSize;

        // Seeded pseudo-random for determinism
        const seededRandom = (x, y, salt) => {
            const n = Math.sin(x * 127.1 + y * 311.7 + salt * 73.3) * 43758.5453;
            return n - Math.floor(n);
        };

        const nearTypes = ['office_chair', 'water_cooler', 'printer', 'recycling_bin', 'potted_ficus',
            'coffee_table', 'standing_person', 'potted_ficus', 'office_chair', 'standing_person'];
        const interiorTypes = ['desk_with_monitor', 'office_chair', 'conference_table',
            'potted_ficus', 'whiteboard', 'printer', 'arcade_machine', 'coffee_table',
            'standing_person', 'standing_person', 'office_chair'];

        // Near-track furniture: offroad tiles adjacent to road
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getTile(x, y) !== this.TILE_OFFROAD) continue;

                const adjRoad = this._isRoad(x-1, y) || this._isRoad(x+1, y) ||
                    this._isRoad(x, y-1) || this._isRoad(x, y+1);
                if (!adjRoad) continue;

                if (seededRandom(x, y, 1) < 0.22) {
                    const typeIdx = Math.floor(seededRandom(x, y, 2) * nearTypes.length);
                    const type = nearTypes[typeIdx];
                    this.obstacles.push({
                        x: (x + 0.5) * ts,
                        y: (y + 0.5) * ts,
                        type: type,
                        scaleX: 1.3, scaleY: 1.3,
                        knockable: true,
                        collisionRadius: this._getObstacleRadius(type)
                    });
                }
            }
        }

        // Interior office spaces: fill large offroad areas with furniture
        for (let y = 2; y < this.height - 2; y += 3) {
            for (let x = 2; x < this.width - 2; x += 3) {
                if (this.getTile(x, y) !== this.TILE_OFFROAD) continue;

                const adjRoad = this._isRoad(x-1, y) || this._isRoad(x+1, y) ||
                    this._isRoad(x, y-1) || this._isRoad(x, y+1);
                if (adjRoad) continue;

                const typeIdx = Math.floor(seededRandom(x, y, 3) * interiorTypes.length);
                const type = interiorTypes[typeIdx];
                this.obstacles.push({
                    x: (x + seededRandom(x, y, 4)) * ts,
                    y: (y + seededRandom(x, y, 5)) * ts,
                    type: type,
                    scaleX: 1.5 + seededRandom(x, y, 6) * 0.5,
                    scaleY: 1.5 + seededRandom(x, y, 6) * 0.5,
                    knockable: true,
                    collisionRadius: this._getObstacleRadius(type)
                });
            }
        }

        // Caution signs at specific locations
        const signPositions = [
            [5, 11], [14, 3], [30, 7], [37, 16], [10, 24], [25, 24], [18, 14], [33, 19]
        ];
        for (const [sx, sy] of signPositions) {
            this.obstacles.push({
                x: (sx + 0.5) * ts,
                y: (sy + 0.5) * ts,
                type: 'caution_sign',
                scaleX: 2, scaleY: 2,
                knockable: true,
                collisionRadius: 10
            });
        }
    }

    _getObstacleRadius(type) {
        const radii = {
            office_chair: 12,
            water_cooler: 10,
            printer: 15,
            recycling_bin: 8,
            potted_ficus: 10,
            coffee_table: 18,
            standing_person: 10,
            desk_with_monitor: 25,
            conference_table: 30,
            whiteboard: 20,
            vending_machine: 18,
            arcade_machine: 16,
            caution_sign: 10,
        };
        return radii[type] || 12;
    }

    // Scan tile map and return wall edge segments for the renderer.
    // Returns merged colinear edge runs in world units.
    getWallEdges() {
        const ts = this.tileSize;
        const edges = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getTile(x, y) === this.TILE_OFFROAD) continue;

                // Road tile — check 4 neighbors for offroad/out-of-bounds
                if (!this._isRoad(x, y - 1)) {
                    edges.push({
                        x1: x * ts, y1: y * ts,
                        x2: (x + 1) * ts, y2: y * ts,
                        normalX: 0, normalY: -1,
                        orientation: 'h', fixedCoord: y * ts
                    });
                }
                if (!this._isRoad(x, y + 1)) {
                    edges.push({
                        x1: x * ts, y1: (y + 1) * ts,
                        x2: (x + 1) * ts, y2: (y + 1) * ts,
                        normalX: 0, normalY: 1,
                        orientation: 'h', fixedCoord: (y + 1) * ts
                    });
                }
                if (!this._isRoad(x - 1, y)) {
                    edges.push({
                        x1: x * ts, y1: y * ts,
                        x2: x * ts, y2: (y + 1) * ts,
                        normalX: -1, normalY: 0,
                        orientation: 'v', fixedCoord: x * ts
                    });
                }
                if (!this._isRoad(x + 1, y)) {
                    edges.push({
                        x1: (x + 1) * ts, y1: y * ts,
                        x2: (x + 1) * ts, y2: (y + 1) * ts,
                        normalX: 1, normalY: 0,
                        orientation: 'v', fixedCoord: (x + 1) * ts
                    });
                }
            }
        }

        return this._mergeEdges(edges);
    }

    _mergeEdges(edges) {
        const groups = {};

        for (const e of edges) {
            const key = `${e.orientation}_${e.fixedCoord}_${e.normalX}_${e.normalY}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        }

        const runs = [];

        for (const segs of Object.values(groups)) {
            const isHoriz = segs[0].orientation === 'h';

            if (isHoriz) {
                segs.sort((a, b) => a.x1 - b.x1);
            } else {
                segs.sort((a, b) => a.y1 - b.y1);
            }

            let current = { ...segs[0] };
            for (let i = 1; i < segs.length; i++) {
                const next = segs[i];
                if (isHoriz && next.x1 === current.x2) {
                    current.x2 = next.x2;
                } else if (!isHoriz && next.y1 === current.y2) {
                    current.y2 = next.y2;
                } else {
                    runs.push({ x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2,
                        normalX: current.normalX, normalY: current.normalY });
                    current = { ...next };
                }
            }
            runs.push({ x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2,
                normalX: current.normalX, normalY: current.normalY });
        }

        console.log(`Track wall edges: ${edges.length} raw -> ${runs.length} merged runs`);
        return runs;
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
        return this.TILE_OFFROAD;
    }

    // Check collision at world position
    checkCollision(worldX, worldY) {
        const tileX = Math.floor(worldX / this.tileSize);
        const tileY = Math.floor(worldY / this.tileSize);

        // Out of bounds = wall
        if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
            let nx = 0, ny = 0;
            if (tileX < 0) nx = 1;
            else if (tileX >= this.width) nx = -1;
            if (tileY < 0) ny = 1;
            else if (tileY >= this.height) ny = -1;
            const len = Math.sqrt(nx * nx + ny * ny) || 1;
            return { type: 'wall', normalX: nx / len, normalY: ny / len, side: 'boundary' };
        }

        const tile = this.getTile(tileX, tileY);

        // Offroad tile = wall
        if (tile === this.TILE_OFFROAD) {
            const idx = tileY * this.width + tileX;
            const wallNormal = this.wallNormals ? this.wallNormals[idx] : null;

            if (wallNormal) {
                return { type: 'wall', normalX: wallNormal.nx, normalY: wallNormal.ny, side: 'wall' };
            }

            // Deep offroad — scan for nearest road tile
            let bestNx = 0, bestNy = 0, bestDist = Infinity;
            for (let dy = -5; dy <= 5; dy++) {
                for (let dx = -5; dx <= 5; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (this._isRoad(tileX + dx, tileY + dy)) {
                        const dist = dx * dx + dy * dy;
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestNx = dx;
                            bestNy = dy;
                        }
                    }
                }
            }

            if (bestDist < Infinity) {
                const len = Math.sqrt(bestNx * bestNx + bestNy * bestNy);
                return { type: 'wall', normalX: bestNx / len, normalY: bestNy / len, side: 'wall' };
            }

            return { type: 'grass', friction: 0.95 };
        }

        // Road tile — check sub-tile proximity to offroad edges (guardrail zone)
        const fracX = (worldX / this.tileSize) - tileX;
        const fracY = (worldY / this.tileSize) - tileY;
        const threshold = this.guardrailWidth / this.tileSize;

        // Check which neighboring tiles are offroad
        const wallLeft = !this._isRoad(tileX - 1, tileY);
        const wallRight = !this._isRoad(tileX + 1, tileY);
        const wallUp = !this._isRoad(tileX, tileY - 1);
        const wallDown = !this._isRoad(tileX, tileY + 1);

        const nearLeft = wallLeft && fracX < threshold;
        const nearRight = wallRight && fracX > (1 - threshold);
        const nearUp = wallUp && fracY < threshold;
        const nearDown = wallDown && fracY > (1 - threshold);

        // Corner case: near two perpendicular walls — use diagonal distance
        // so the collision zone is rounded instead of L-shaped
        if ((nearLeft || nearRight) && (nearUp || nearDown)) {
            const cornerX = nearLeft ? threshold : (1 - threshold);
            const cornerY = nearUp ? threshold : (1 - threshold);
            const dx = fracX - cornerX;
            const dy = fracY - cornerY;
            if (dx * dx + dy * dy < threshold * threshold) {
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                return { type: 'wall', normalX: dx / len, normalY: dy / len, side: 'wall' };
            }
            // Inside the rounded corner cutout — not a collision
            return { type: 'road', friction: 1.0 };
        }

        // Straight wall edges
        if (nearLeft) return { type: 'wall', normalX: 1, normalY: 0, side: 'wall' };
        if (nearRight) return { type: 'wall', normalX: -1, normalY: 0, side: 'wall' };
        if (nearUp) return { type: 'wall', normalX: 0, normalY: 1, side: 'wall' };
        if (nearDown) return { type: 'wall', normalX: 0, normalY: -1, side: 'wall' };

        // On road, no wall nearby
        return { type: 'road', friction: 1.0 };
    }

    // Get start position — middle of Grand Hallway, facing west
    getStartPosition() {
        return {
            x: 20 * this.tileSize,
            y: 23.5 * this.tileSize,
            heading: Math.PI
        };
    }
}
