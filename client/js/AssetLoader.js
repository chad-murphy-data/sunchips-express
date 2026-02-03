// AssetLoader.js - Preloads all game images

export class AssetLoader {
    constructor() {
        this.images = {};
        this.loaded = 0;
        this.total = 0;
    }

    async loadImage(name, path) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this.loaded++;
                console.log(`Loaded: ${name}`);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load: ${path}`);
                this.loaded++;
                resolve(null); // Continue loading other assets
            };
            img.src = path;
        });
    }

    async loadAll() {
        const assets = [
            // Golf cart sprites (Suzuki Cappuccino)
            ['cart_straight', 'assets/kei-cars/Kei%20Car%20Pack%20%231/Szki_cno/Stock/cno_frame_0.png'],
            ['cart_left', 'assets/kei-cars/Kei%20Car%20Pack%20%231/Szki_cno/Stock/cno_turn_left.png'],
            ['cart_right', 'assets/kei-cars/Kei%20Car%20Pack%20%231/Szki_cno/Stock/cno_turn_right.png'],

            // Ground tiles (kept for fallback, though we use procedural colors now)
            ['grass01', 'assets/kenney/PNG/Tiles/Grass/land_grass01.png'],
            ['grass02', 'assets/kenney/PNG/Tiles/Grass/land_grass02.png'],
            ['grass03', 'assets/kenney/PNG/Tiles/Grass/land_grass03.png'],
            ['grass04', 'assets/kenney/PNG/Tiles/Grass/land_grass04.png'],
        ];

        this.total = assets.length;

        const promises = assets.map(([name, path]) => this.loadImage(name, path));

        await Promise.all(promises);

        // Generate procedural office furniture sprites
        this.generateOfficeSprites();

        console.log(`Loaded ${this.loaded}/${this.total} assets`);
        return this.images;
    }

    // Generate side-view office furniture sprites procedurally
    generateOfficeSprites() {
        // ===== BARRIER OBJECTS (track edges) =====

        // Cubicle wall - gray fabric partition panel
        this.generateCubicleWall();
        this.generateCubicleWallTall();
        this.generateFilingCabinet();
        this.generateFilingCabinetShort();

        // ===== NEAR-TRACK DECORATION =====
        this.generateOfficeChair();
        this.generateWaterCooler();
        this.generateRecyclingBin();
        this.generatePrinter();
        this.generatePottedFicus();

        // ===== FAR DECORATION =====
        this.generateDeskWithMonitor();
        this.generateWhiteboard();
        this.generateVendingMachine();
        this.generateConferenceTable();
        this.generateCautionSign();

        // Keep guardrails for backwards compatibility
        this.generateGuardrailSprites();
    }

    generateCubicleWall() {
        const w = 24, h = 32;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Metal frame (dark gray)
        ctx.fillStyle = '#606068';
        ctx.fillRect(0, 0, w, h);

        // Fabric panel (gray-blue)
        ctx.fillStyle = '#808090';
        ctx.fillRect(2, 2, w - 4, h - 4);

        // Fabric seam line
        ctx.fillStyle = '#707078';
        ctx.fillRect(2, Math.floor(h * 0.6), w - 4, 1);

        // Bottom rail (dark base)
        ctx.fillStyle = '#505058';
        ctx.fillRect(0, h - 3, w, 3);

        this.images['cubicle_wall'] = canvas;
    }

    generateCubicleWallTall() {
        const w = 24, h = 40;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Metal frame
        ctx.fillStyle = '#606068';
        ctx.fillRect(0, 0, w, h);

        // Fabric panel
        ctx.fillStyle = '#808090';
        ctx.fillRect(2, 2, w - 4, h - 4);

        // Fabric seam
        ctx.fillStyle = '#707078';
        ctx.fillRect(2, Math.floor(h * 0.6), w - 4, 1);

        // Bottom rail
        ctx.fillStyle = '#505058';
        ctx.fillRect(0, h - 3, w, 3);

        this.images['cubicle_wall_tall'] = canvas;
    }

    generateFilingCabinet() {
        const w = 18, h = 28;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Body (light gray metal)
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(0, 0, w, h);

        // Top edge highlight
        ctx.fillStyle = '#B0B0B0';
        ctx.fillRect(0, 0, w, 2);

        // Drawer dividing lines
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, Math.floor(h / 2), w, 1);

        // Handles
        ctx.fillStyle = '#606060';
        ctx.fillRect(Math.floor(w / 2) - 2, Math.floor(h / 4) - 1, 4, 2);
        ctx.fillRect(Math.floor(w / 2) - 2, Math.floor(h * 3 / 4) - 1, 4, 2);

        // Base shadow
        ctx.fillStyle = '#707070';
        ctx.fillRect(0, h - 2, w, 2);

        this.images['filing_cabinet'] = canvas;
    }

    generateFilingCabinetShort() {
        const w = 18, h = 20;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Body
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(0, 0, w, h);

        // Top highlight
        ctx.fillStyle = '#B0B0B0';
        ctx.fillRect(0, 0, w, 2);

        // Handle
        ctx.fillStyle = '#606060';
        ctx.fillRect(Math.floor(w / 2) - 2, Math.floor(h / 2) - 1, 4, 2);

        // Base
        ctx.fillStyle = '#707070';
        ctx.fillRect(0, h - 2, w, 2);

        this.images['filing_cabinet_short'] = canvas;
    }

    generateOfficeChair() {
        const w = 20, h = 28;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Back rest (black mesh)
        ctx.fillStyle = '#2A2A2A';
        ctx.fillRect(5, 0, 10, 14);

        // Armrest
        ctx.fillStyle = '#3A3A3A';
        ctx.fillRect(3, 10, 2, 8);

        // Seat
        ctx.fillStyle = '#2A2A2A';
        ctx.fillRect(3, 14, 14, 6);

        // Post
        ctx.fillStyle = '#606060';
        ctx.fillRect(8, 20, 4, 5);

        // Base (star shape simplified)
        ctx.fillStyle = '#404040';
        ctx.fillRect(2, 25, 16, 3);

        // Wheels
        ctx.fillStyle = '#303030';
        ctx.fillRect(2, 26, 2, 2);
        ctx.fillRect(16, 26, 2, 2);

        this.images['office_chair'] = canvas;
    }

    generateWaterCooler() {
        const w = 14, h = 30;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Jug cap
        ctx.fillStyle = '#336699';
        ctx.fillRect(4, 0, 6, 3);

        // Jug (blue)
        ctx.fillStyle = '#4488CC';
        ctx.fillRect(2, 3, 10, 10);

        // Body (white)
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(1, 13, 12, 14);

        // Tap area
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(3, 18, 8, 3);

        // Base
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(1, 27, 12, 3);

        this.images['water_cooler'] = canvas;
    }

    generateRecyclingBin() {
        const w = 12, h = 18;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Body (blue)
        ctx.fillStyle = '#2255AA';
        ctx.fillRect(0, 3, w, 13);

        // Rim
        ctx.fillStyle = '#1A4488';
        ctx.fillRect(0, 0, w, 3);

        // Symbol (simplified white triangle)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(4, 7, 4, 4);

        // Base
        ctx.fillStyle = '#1A3366';
        ctx.fillRect(0, h - 2, w, 2);

        this.images['recycling_bin'] = canvas;
    }

    generatePrinter() {
        const w = 22, h = 18;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Body
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(0, 3, w, 13);

        // Top (scanner glass)
        ctx.fillStyle = '#F0F0F0';
        ctx.fillRect(0, 0, w, 3);

        // Display panel
        ctx.fillStyle = '#333333';
        ctx.fillRect(2, 5, 6, 3);

        // Paper tray
        ctx.fillStyle = '#D0D0D0';
        ctx.fillRect(3, 13, 16, 3);

        // Base shadow
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(0, h - 2, w, 2);

        this.images['printer'] = canvas;
    }

    generatePottedFicus() {
        const w = 16, h = 32;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Foliage (green blob)
        ctx.fillStyle = '#3A8B3A';
        ctx.fillRect(1, 0, 14, 18);

        // Foliage highlights
        ctx.fillStyle = '#4AA84A';
        ctx.fillRect(3, 2, 3, 3);
        ctx.fillRect(9, 5, 3, 3);
        ctx.fillRect(5, 10, 4, 3);

        // Trunk
        ctx.fillStyle = '#6B4226';
        ctx.fillRect(6, 18, 4, 6);

        // Pot rim
        ctx.fillStyle = '#7A5230';
        ctx.fillRect(3, 24, 10, 2);

        // Pot
        ctx.fillStyle = '#8B5E3C';
        ctx.fillRect(4, 26, 8, 6);

        this.images['potted_ficus'] = canvas;
    }

    generateDeskWithMonitor() {
        const w = 30, h = 24;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Monitor
        ctx.fillStyle = '#222222';
        ctx.fillRect(9, 0, 12, 10);

        // Screen
        ctx.fillStyle = '#4466AA';
        ctx.fillRect(10, 1, 10, 7);

        // Monitor stand
        ctx.fillStyle = '#333333';
        ctx.fillRect(13, 10, 4, 3);

        // Desk surface
        ctx.fillStyle = '#C8A882';
        ctx.fillRect(0, 13, w, 4);

        // Keyboard
        ctx.fillStyle = '#D0D0D0';
        ctx.fillRect(10, 14, 10, 2);

        // Desk legs
        ctx.fillStyle = '#B0956E';
        ctx.fillRect(2, 17, 3, 7);
        ctx.fillRect(25, 17, 3, 7);

        this.images['desk_with_monitor'] = canvas;
    }

    generateWhiteboard() {
        const w = 28, h = 32;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Frame
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(0, 0, w, 22);

        // Board (white)
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(1, 1, w - 2, 18);

        // Scribbles
        ctx.fillStyle = '#3344AA';
        ctx.fillRect(4, 4, 8, 2);
        ctx.fillRect(6, 8, 10, 1);
        ctx.fillStyle = '#CC3333';
        ctx.fillRect(14, 12, 6, 2);

        // Marker tray
        ctx.fillStyle = '#909090';
        ctx.fillRect(4, 19, 20, 2);

        // Stand legs
        ctx.fillStyle = '#808080';
        ctx.fillRect(6, 22, 2, 8);
        ctx.fillRect(20, 22, 2, 8);

        // Wheels
        ctx.fillStyle = '#404040';
        ctx.fillRect(5, 30, 3, 2);
        ctx.fillRect(20, 30, 3, 2);

        this.images['whiteboard'] = canvas;
    }

    generateVendingMachine() {
        const w = 22, h = 38;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Body (red - Coca-Cola vibe)
        ctx.fillStyle = '#CC2222';
        ctx.fillRect(0, 0, w, h);

        // Front panel (slightly lighter)
        ctx.fillStyle = '#DD3333';
        ctx.fillRect(2, 2, w - 4, h - 6);

        // Product window (dark)
        ctx.fillStyle = '#333333';
        ctx.fillRect(3, 4, w - 6, 16);

        // Button area
        ctx.fillStyle = '#AAAAAA';
        ctx.fillRect(3, 22, w - 6, 6);

        // Dispensing slot
        ctx.fillStyle = '#111111';
        ctx.fillRect(7, 30, 8, 4);

        // Base
        ctx.fillStyle = '#991111';
        ctx.fillRect(0, h - 4, w, 4);

        this.images['vending_machine'] = canvas;
    }

    generateConferenceTable() {
        const w = 32, h = 16;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Table top
        ctx.fillStyle = '#8B6C4A';
        ctx.fillRect(0, 0, w, 4);

        // Table edge shadow
        ctx.fillStyle = '#7A5C3A';
        ctx.fillRect(0, 4, w, 2);

        // Legs
        ctx.fillStyle = '#7A5C3A';
        ctx.fillRect(3, 6, 3, 10);
        ctx.fillRect(26, 6, 3, 10);

        this.images['conference_table'] = canvas;
    }

    generateCautionSign() {
        const w = 10, h = 24;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // A-frame shape (yellow)
        ctx.fillStyle = '#FFD700';
        // Left leg
        ctx.fillRect(0, 0, 3, h);
        // Right leg
        ctx.fillRect(w - 3, 0, 3, h);
        // Top connection
        ctx.fillRect(0, 0, w, 8);

        // Orange border
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(1, 1, w - 2, 1);
        ctx.fillRect(1, 7, w - 2, 1);

        // Warning "!" symbol
        ctx.fillStyle = '#000000';
        ctx.fillRect(4, 3, 2, 2);

        this.images['caution_sign'] = canvas;
    }

    // Keep guardrails for backwards compatibility
    generateGuardrailSprites() {
        const postWidth = 16;
        const postHeight = 32;

        // Red post with white stripe
        const redCanvas = document.createElement('canvas');
        redCanvas.width = postWidth;
        redCanvas.height = postHeight;
        const redCtx = redCanvas.getContext('2d');

        redCtx.fillStyle = '#CC0000';
        redCtx.fillRect(0, 0, postWidth, postHeight);
        redCtx.fillStyle = '#FFFFFF';
        redCtx.fillRect(0, 10, postWidth, 6);
        redCtx.fillStyle = '#990000';
        redCtx.fillRect(0, postHeight - 2, postWidth, 2);

        this.images['guardrail_red'] = redCanvas;

        // White post with red stripe
        const whiteCanvas = document.createElement('canvas');
        whiteCanvas.width = postWidth;
        whiteCanvas.height = postHeight;
        const whiteCtx = whiteCanvas.getContext('2d');

        whiteCtx.fillStyle = '#EEEEEE';
        whiteCtx.fillRect(0, 0, postWidth, postHeight);
        whiteCtx.fillStyle = '#CC0000';
        whiteCtx.fillRect(0, 10, postWidth, 6);
        whiteCtx.fillStyle = '#AAAAAA';
        whiteCtx.fillRect(0, postHeight - 2, postWidth, 2);

        this.images['guardrail_white'] = whiteCanvas;

        // Yellow bollard
        const yellowCanvas = document.createElement('canvas');
        yellowCanvas.width = 14;
        yellowCanvas.height = 20;
        const yellowCtx = yellowCanvas.getContext('2d');

        yellowCtx.fillStyle = '#FFD700';
        yellowCtx.fillRect(0, 0, 14, 20);
        yellowCtx.fillStyle = '#000000';
        yellowCtx.fillRect(0, 6, 14, 3);
        yellowCtx.fillStyle = '#CC9900';
        yellowCtx.fillRect(0, 18, 14, 2);

        this.images['guardrail_yellow'] = yellowCanvas;
    }

    get(name) {
        return this.images[name];
    }

    getProgress() {
        return this.total > 0 ? this.loaded / this.total : 0;
    }
}
