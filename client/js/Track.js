// Track.js - Spline-based ranch track with variable width and surface types
// "The Ranch" — Sun Chips delivery training course

export class Track {
    constructor() {
        // Tile size kept for backward compat (camera code references it)
        this.tileSize = 128;

        // Surface type definitions with friction properties
        this.SURFACES = {
            asphalt: { friction: 1.0,  brakeMult: 1.0,  steerMult: 1.0,  color: 0x555555 },
            dirt:    { friction: 0.85, brakeMult: 0.85, steerMult: 0.9,  color: 0x8B6914 },
            gravel:  { friction: 0.7,  brakeMult: 0.7,  steerMult: 0.75, color: 0xA0937D },
            mud:     { friction: 0.55, brakeMult: 0.5,  steerMult: 0.6,  color: 0x4A3520 },
            water:   { friction: 0.4,  brakeMult: 0.3,  steerMult: 0.45, color: 0x3388BB },
        };

        // Spline data (populated by generateLevel1)
        this.controlPoints = [];
        this.splinePoints = [];   // Sampled points along the spline
        this.totalTrackLength = 0;

        // Spatial grid for fast closest-point lookup
        this.spatialGrid = {};
        this.GRID_CELL_SIZE = 200;

        // Trackside obstacles
        this.obstacles = [];

        // Snack stations (populated by generateLevel1)
        this.snackStations = [];

        // Start/finish zone
        this.startFinishZone = null;
    }

    // Generate the ranch track layout
    generateLevel1() {
        // Define control points forming a closed counter-clockwise loop
        // Each point: { x, y, width, surface }
        // width = road half-width (full road = 2 * width)
        this.controlPoints = [
            // === SECTION 1: Start/Finish — Wide open paddock ===
            { x: 2000, y: 3500, width: 200, surface: 'asphalt' },  // CP 0: Start/finish line
            { x: 1500, y: 3500, width: 200, surface: 'asphalt' },  // CP 1: Leaving start zone
            { x: 1000, y: 3400, width: 180, surface: 'dirt' },     // CP 2: Transition to dirt

            // === SECTION 2: Sweeping S-curve through pasture ===
            { x: 500,  y: 3000, width: 180, surface: 'dirt' },     // CP 3: First bend south-west
            { x: 300,  y: 2500, width: 160, surface: 'dirt' },     // CP 4: Heading north
            { x: 500,  y: 2000, width: 160, surface: 'dirt' },     // CP 5: S-curve midpoint
            { x: 300,  y: 1500, width: 140, surface: 'dirt' },     // CP 6: Narrowing...

            // === STATION 1 — Road narrows, role swap in a pinch ===
            { x: 400,  y: 1200, width: 120, surface: 'dirt' },     // CP 7: STATION 1 zone (narrow!)

            // === SECTION 3: Fence-lined corridor ===
            { x: 600,  y: 900,  width: 120, surface: 'gravel' },   // CP 8: Tight gravel section
            { x: 900,  y: 600,  width: 130, surface: 'gravel' },   // CP 9: Curving east
            { x: 1300, y: 400,  width: 140, surface: 'gravel' },   // CP 10: Opening slightly

            // === SECTION 4: Barn chicane ===
            { x: 1700, y: 350,  width: 110, surface: 'dirt' },     // CP 11: Entering barn (narrow!)
            { x: 2000, y: 400,  width: 100, surface: 'dirt' },     // CP 12: Inside barn — tightest
            { x: 2300, y: 350,  width: 110, surface: 'dirt' },     // CP 13: Exiting barn

            // === STATION 2 — Right after barn exit ===
            { x: 2600, y: 400,  width: 130, surface: 'dirt' },     // CP 14: STATION 2 zone

            // === SECTION 5: Fast sweeping curve ===
            { x: 3000, y: 600,  width: 180, surface: 'asphalt' },  // CP 15: Wide asphalt reward
            { x: 3400, y: 1000, width: 200, surface: 'asphalt' },  // CP 16: Big sweeping right
            { x: 3600, y: 1500, width: 200, surface: 'asphalt' },  // CP 17: Max speed section
            { x: 3500, y: 2000, width: 180, surface: 'asphalt' },  // CP 18: Curving south

            // === SECTION 6: Creek crossing ===
            { x: 3300, y: 2400, width: 160, surface: 'mud' },      // CP 19: Approaching creek
            { x: 3100, y: 2600, width: 140, surface: 'water' },    // CP 20: CREEK! Hydroplane
            { x: 2900, y: 2800, width: 140, surface: 'water' },    // CP 21: Still in water
            { x: 2700, y: 2900, width: 160, surface: 'mud' },      // CP 22: Mud after creek

            // === STATION 3 — In the muddy section ===
            { x: 2500, y: 3000, width: 150, surface: 'mud' },      // CP 23: STATION 3 zone

            // === SECTION 7: Home stretch ===
            { x: 2300, y: 3200, width: 170, surface: 'dirt' },     // CP 24: Curving back
            { x: 2200, y: 3400, width: 190, surface: 'asphalt' },  // CP 25: Back on pavement
            // Loops back to CP 0
        ];

        // Build spline from control points
        this._buildSpline();

        // Build spatial grid for fast collision detection
        this._buildSpatialGrid();

        // Place snack stations at specific control points
        const stationCPs = [
            { cpIndex: 7,  id: 1 },  // Station 1: narrow dirt section
            { cpIndex: 14, id: 2 },  // Station 2: after barn exit
            { cpIndex: 23, id: 3 },  // Station 3: in the mud
        ];

        this.snackStations = stationCPs.map(s => {
            const cp = this.controlPoints[s.cpIndex];
            return {
                x: cp.x,
                y: cp.y,
                radius: 150,
                delivered: false,
                id: s.id
            };
        });

        // Start/finish zone at first control point
        const startPos = this.getStartPosition();
        this.startFinishZone = {
            x: startPos.x,
            y: startPos.y,
            radius: 250
        };

        // Generate ranch obstacles
        this._generateObstacles();

        console.log(`Track generated: ${this.controlPoints.length} control points, ${this.splinePoints.length} spline samples, ${Math.round(this.totalTrackLength)} units total length`);

        return this;
    }

    // Catmull-Rom interpolation between P1 and P2
    _catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return {
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    }

    // Catmull-Rom tangent (derivative) at parameter t
    _catmullRomTangent(p0, p1, p2, p3, t) {
        const t2 = t * t;
        return {
            x: 0.5 * ((-p0.x + p2.x) + (4 * p0.x - 10 * p1.x + 8 * p2.x - 2 * p3.x) * t + (-3 * p0.x + 9 * p1.x - 9 * p2.x + 3 * p3.x) * t2),
            y: 0.5 * ((-p0.y + p2.y) + (4 * p0.y - 10 * p1.y + 8 * p2.y - 2 * p3.y) * t + (-3 * p0.y + 9 * p1.y - 9 * p2.y + 3 * p3.y) * t2)
        };
    }

    // Sample the spline at high density
    _buildSpline() {
        const N = this.controlPoints.length;
        const SAMPLES_PER_SEGMENT = 20;
        this.splinePoints = [];
        let totalDist = 0;

        for (let seg = 0; seg < N; seg++) {
            const p0 = this.controlPoints[(seg - 1 + N) % N];
            const p1 = this.controlPoints[seg];
            const p2 = this.controlPoints[(seg + 1) % N];
            const p3 = this.controlPoints[(seg + 2) % N];

            for (let i = 0; i < SAMPLES_PER_SEGMENT; i++) {
                const t = i / SAMPLES_PER_SEGMENT;
                const pos = this._catmullRom(p0, p1, p2, p3, t);
                const tangent = this._catmullRomTangent(p0, p1, p2, p3, t);

                const tLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
                const tx = tLen > 0 ? tangent.x / tLen : 1;
                const ty = tLen > 0 ? tangent.y / tLen : 0;

                // Normal = perpendicular to tangent (left-hand side of travel direction)
                const nx = -ty;
                const ny = tx;

                // Interpolate width linearly between control points
                const width = p1.width + (p2.width - p1.width) * t;

                // Surface: snap to nearest control point's surface
                const surface = t < 0.5 ? p1.surface : p2.surface;

                // Accumulate distance
                if (this.splinePoints.length > 0) {
                    const prev = this.splinePoints[this.splinePoints.length - 1];
                    const dx = pos.x - prev.x;
                    const dy = pos.y - prev.y;
                    totalDist += Math.sqrt(dx * dx + dy * dy);
                }

                this.splinePoints.push({
                    x: pos.x, y: pos.y,
                    tx, ty, nx, ny,
                    width, surface,
                    distFromStart: totalDist
                });
            }
        }

        this.totalTrackLength = totalDist;
    }

    // Build spatial grid for O(1)-ish closest-point lookup
    _buildSpatialGrid() {
        this.spatialGrid = {};
        const cs = this.GRID_CELL_SIZE;

        for (let i = 0; i < this.splinePoints.length; i++) {
            const sp = this.splinePoints[i];
            const hw = sp.width;

            // Index the center point and offset positions to cover the full road width
            const offsets = [0, -hw * 0.5, hw * 0.5, -hw, hw];
            for (const off of offsets) {
                const px = sp.x + sp.nx * off;
                const py = sp.y + sp.ny * off;
                const gx = Math.floor(px / cs);
                const gy = Math.floor(py / cs);
                const key = `${gx}_${gy}`;
                if (!this.spatialGrid[key]) this.spatialGrid[key] = new Set();
                this.spatialGrid[key].add(i);
            }
        }

        // Convert sets to arrays for iteration
        for (const key in this.spatialGrid) {
            this.spatialGrid[key] = Array.from(this.spatialGrid[key]);
        }
    }

    // Check collision at world position — THE critical public API method
    checkCollision(worldX, worldY) {
        const cs = this.GRID_CELL_SIZE;
        const gx = Math.floor(worldX / cs);
        const gy = Math.floor(worldY / cs);

        let bestDist = Infinity;
        let bestIdx = -1;
        let bestLateral = 0;

        // Search 3x3 neighborhood of grid cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${gx + dx}_${gy + dy}`;
                const indices = this.spatialGrid[key];
                if (!indices) continue;

                for (const idx of indices) {
                    const sp = this.splinePoints[idx];
                    const px = worldX - sp.x;
                    const py = worldY - sp.y;

                    // Lateral distance: projection onto normal
                    const lateral = px * sp.nx + py * sp.ny;
                    const dist = Math.abs(lateral);

                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = idx;
                        bestLateral = lateral;
                    }
                }
            }
        }

        // Far from any track point — off in the grass
        if (bestIdx < 0) {
            return {
                type: 'grass', friction: 0.5,
                normalX: 0, normalY: 0,
                surface: 'grass', brakeMult: 0.5, steerMult: 0.6
            };
        }

        const sp = this.splinePoints[bestIdx];
        const halfWidth = sp.width;
        const edgeMargin = 15; // fence collision zone extends outward from edge

        // On the road surface (all the way to the fence line)
        if (Math.abs(bestLateral) < halfWidth) {
            const surfData = this.SURFACES[sp.surface] || this.SURFACES.asphalt;
            return {
                type: 'road', friction: surfData.friction,
                normalX: 0, normalY: 0,
                surface: sp.surface, brakeMult: surfData.brakeMult, steerMult: surfData.steerMult
            };
        }

        // In fence/guardrail zone (from inset to just beyond the fence line)
        if (Math.abs(bestLateral) < halfWidth + edgeMargin) {
            // Wall collision — normal points inward toward centerline
            const sign = bestLateral > 0 ? -1 : 1;
            return {
                type: 'wall',
                normalX: sp.nx * sign, normalY: sp.ny * sign,
                side: 'fence', surface: sp.surface
            };
        }

        // Off track entirely — grass with gentle push toward road
        const sign = bestLateral > 0 ? -1 : 1;
        return {
            type: 'wall',
            normalX: sp.nx * sign, normalY: sp.ny * sign,
            side: 'fence', surface: 'grass',
            friction: 0.5, brakeMult: 0.5, steerMult: 0.6
        };
    }

    // Compatibility shim for camera code that called _isRoad(tileX, tileY)
    _isRoad(tileX, tileY) {
        const worldX = tileX * this.tileSize + this.tileSize / 2;
        const worldY = tileY * this.tileSize + this.tileSize / 2;
        const result = this.checkCollision(worldX, worldY);
        return result.type === 'road';
    }

    // Check if a world position is on the track
    isOnTrack(worldX, worldY) {
        const result = this.checkCollision(worldX, worldY);
        return result.type === 'road';
    }

    // Get start position — at first control point, heading along tangent
    getStartPosition() {
        if (this.splinePoints.length === 0) {
            return { x: 2000, y: 3500, heading: Math.PI };
        }
        const sp = this.splinePoints[0];
        return {
            x: sp.x,
            y: sp.y,
            heading: Math.atan2(sp.ty, sp.tx)
        };
    }

    // Return left and right edge polylines for fence/wall placement
    getWallEdges() {
        const edges = { left: [], right: [] };

        for (let i = 0; i < this.splinePoints.length; i++) {
            const sp = this.splinePoints[i];
            const hw = sp.width;

            edges.left.push({
                x: sp.x + sp.nx * hw,
                y: sp.y + sp.ny * hw,
                nx: sp.nx, ny: sp.ny
            });
            edges.right.push({
                x: sp.x - sp.nx * hw,
                y: sp.y - sp.ny * hw,
                nx: -sp.nx, ny: -sp.ny
            });
        }

        return edges;
    }

    // Generate ranch-themed obstacles near the track
    _generateObstacles() {
        this.obstacles = [];

        // Seeded pseudo-random
        const seededRandom = (a, b) => {
            const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
            return n - Math.floor(n);
        };

        // Place on-road cows (knockable obstacles) — 10-12 scattered on the track
        const cowSplineIndices = [30, 65, 90, 120, 180, 220, 280, 330, 370, 420, 460];
        for (const idx of cowSplineIndices) {
            if (idx >= this.splinePoints.length) continue;
            const sp = this.splinePoints[idx];
            // Place slightly off center for variety
            const lateralOffset = (seededRandom(idx, 42) - 0.5) * sp.width * 0.6;
            this.obstacles.push({
                x: sp.x + sp.nx * lateralOffset,
                y: sp.y + sp.ny * lateralOffset,
                type: 'cow',
                scaleX: 1, scaleY: 1,
                knockable: true,
                collisionRadius: 12
            });
        }

        // Place hay bales along track edges — some on road, some off
        for (let i = 0; i < this.splinePoints.length; i += 15) {
            const sp = this.splinePoints[i];
            const r = seededRandom(i, 7);
            if (r < 0.15) {
                // On-road hay bale (knockable obstacle)
                const lateralOffset = (seededRandom(i, 13) - 0.5) * sp.width * 0.8;
                this.obstacles.push({
                    x: sp.x + sp.nx * lateralOffset,
                    y: sp.y + sp.ny * lateralOffset,
                    type: 'hay_bale',
                    scaleX: 1, scaleY: 1,
                    knockable: true,
                    collisionRadius: 15
                });
            } else if (r < 0.35) {
                // Off-road hay bale (scenery near edge)
                const side = seededRandom(i, 19) > 0.5 ? 1 : -1;
                const offset = sp.width + 30 + seededRandom(i, 21) * 80;
                this.obstacles.push({
                    x: sp.x + sp.nx * side * offset,
                    y: sp.y + sp.ny * side * offset,
                    type: 'hay_bale',
                    scaleX: 1, scaleY: 1,
                    knockable: false,
                    collisionRadius: 15
                });
            }
        }

        // Place trees in natural clusters (groves), 30 total, never within 200 of centerline
        // Grove 1: Tree-lined avenue along fast sweeping curve (section 5, CPs 15-18) — one side
        const grove1Start = 15 * 20; // CP 15
        const grove1End = 18 * 20;   // CP 18
        for (let i = grove1Start; i < grove1End && i < this.splinePoints.length; i += 12) {
            const sp = this.splinePoints[i];
            const offset = sp.width + 200 + seededRandom(i, 31) * 80;
            this.obstacles.push({
                x: sp.x + sp.nx * offset,
                y: sp.y + sp.ny * offset,
                type: 'tree', scaleX: 1, scaleY: 1, knockable: false, collisionRadius: 30
            });
        }
        // Grove 2: Cluster near creek (CPs 19-22), riparian vegetation
        const grove2Start = 19 * 20;
        const grove2End = 22 * 20;
        for (let i = grove2Start; i < grove2End && i < this.splinePoints.length; i += 18) {
            const sp = this.splinePoints[i];
            const side = seededRandom(i, 33) > 0.5 ? 1 : -1;
            const offset = sp.width + 220 + seededRandom(i, 35) * 100;
            this.obstacles.push({
                x: sp.x + sp.nx * side * offset,
                y: sp.y + sp.ny * side * offset,
                type: 'tree', scaleX: 1, scaleY: 1, knockable: false, collisionRadius: 30
            });
        }
        // Grove 3: Cluster between S-curve and Station 1 (CPs 5-7)
        const grove3Start = 5 * 20;
        const grove3End = 7 * 20;
        for (let i = grove3Start; i < grove3End && i < this.splinePoints.length; i += 10) {
            const sp = this.splinePoints[i];
            const offset = sp.width + 250 + seededRandom(i, 37) * 150;
            this.obstacles.push({
                x: sp.x - sp.nx * offset,
                y: sp.y - sp.ny * offset,
                type: 'tree', scaleX: 1, scaleY: 1, knockable: false, collisionRadius: 30
            });
        }
        // Grove 4: Scattered trees along home stretch (CPs 24-25)
        const grove4Start = 24 * 20;
        const grove4End = 25 * 20;
        for (let i = grove4Start; i < grove4End && i < this.splinePoints.length; i += 10) {
            const sp = this.splinePoints[i];
            const side = seededRandom(i, 39) > 0.5 ? 1 : -1;
            const offset = sp.width + 200 + seededRandom(i, 41) * 200;
            this.obstacles.push({
                x: sp.x + sp.nx * side * offset,
                y: sp.y + sp.ny * side * offset,
                type: 'tree', scaleX: 1, scaleY: 1, knockable: false, collisionRadius: 30
            });
        }
        // NO trees within 150 units of the barn (CPs 11-14 area) — farmers clear trees
        // DECORATION TASK 7 COMPLETE

        // Place decorative off-road cows (not knockable, just grazing) — 6-8 total
        for (let i = 0; i < this.splinePoints.length; i += 25) {
            const sp = this.splinePoints[i];
            if (seededRandom(i, 51) < 0.35) {
                const side = seededRandom(i, 53) > 0.5 ? 1 : -1;
                const offset = sp.width + 60 + seededRandom(i, 57) * 200;
                this.obstacles.push({
                    x: sp.x + sp.nx * side * offset,
                    y: sp.y + sp.ny * side * offset,
                    type: seededRandom(i, 59) > 0.3 ? 'cow_decorative' : 'bull_decorative',
                    scaleX: 1, scaleY: 1,
                    knockable: false,
                    collisionRadius: 20
                });
            }
        }

        // Place decorative horses/donkeys far off-track — 5-7 total
        for (let i = 0; i < this.splinePoints.length; i += 40) {
            const sp = this.splinePoints[i];
            if (seededRandom(i, 61) < 0.5) {
                const side = seededRandom(i, 63) > 0.5 ? 1 : -1;
                const offset = sp.width + 200 + seededRandom(i, 67) * 400;
                const animalTypes = ['horse_decorative', 'whiteHorse_decorative', 'donkey_decorative', 'alpaca_decorative'];
                const typeIdx = Math.floor(seededRandom(i, 69) * animalTypes.length);
                this.obstacles.push({
                    x: sp.x + sp.nx * side * offset,
                    y: sp.y + sp.ny * side * offset,
                    type: animalTypes[typeIdx],
                    scaleX: 1, scaleY: 1,
                    knockable: false,
                    collisionRadius: 20
                });
            }
        }

        // Far off-road wildlife: deer (sparse, distant) — 3-4 total
        for (let i = 0; i < this.splinePoints.length; i += 80) {
            const sp = this.splinePoints[i];
            if (seededRandom(i, 71) < 0.5) {
                const side = seededRandom(i, 73) > 0.5 ? 1 : -1;
                const offset = sp.width + 400 + seededRandom(i, 77) * 500;
                this.obstacles.push({
                    x: sp.x + sp.nx * side * offset,
                    y: sp.y + sp.ny * side * offset,
                    type: 'deer_decorative',
                    scaleX: 1, scaleY: 1,
                    knockable: false,
                    collisionRadius: 15
                });
            }
        }

        console.log(`Generated ${this.obstacles.length} ranch obstacles`);
    }
}
