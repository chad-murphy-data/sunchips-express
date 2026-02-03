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

            // Ground tiles
            ['grass01', 'assets/kenney/PNG/Tiles/Grass/land_grass01.png'],
            ['grass02', 'assets/kenney/PNG/Tiles/Grass/land_grass02.png'],
            ['grass03', 'assets/kenney/PNG/Tiles/Grass/land_grass03.png'],
            ['grass04', 'assets/kenney/PNG/Tiles/Grass/land_grass04.png'],

            // Road tiles - straights
            ['road_straight_h', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt22.png'],
            ['road_straight_v', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt01.png'],

            // Road tiles - curves
            ['road_curve_ne', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt02.png'],
            ['road_curve_nw', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt03.png'],
            ['road_curve_se', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt04.png'],
            ['road_curve_sw', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt05.png'],

            // Road edges
            ['road_edge_left', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt24.png'],
            ['road_edge_right', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt26.png'],
            ['road_edge_top', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt43.png'],
            ['road_edge_bottom', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt45.png'],

            // Road with markings
            ['road_marked_v', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt40.png'],
            ['road_marked_h', 'assets/kenney/PNG/Tiles/Asphalt%20road/road_asphalt78.png'],

            // Trackside objects
            ['barrel_blue', 'assets/kenney/PNG/Objects/barrel_blue.png'],
            ['barrel_red', 'assets/kenney/PNG/Objects/barrel_red.png'],
            ['cone', 'assets/kenney/PNG/Objects/cone_straight.png'],
            ['barrier_red', 'assets/kenney/PNG/Objects/barrier_red.png'],
            ['barrier_white', 'assets/kenney/PNG/Objects/barrier_white.png'],
            ['tire_red', 'assets/kenney/PNG/Objects/tire_red.png'],
            ['tire_white', 'assets/kenney/PNG/Objects/tire_white.png'],
            ['tree_large', 'assets/kenney/PNG/Objects/tree_large.png'],
            ['tree_small', 'assets/kenney/PNG/Objects/tree_small.png'],
            ['rock1', 'assets/kenney/PNG/Objects/rock1.png'],
            ['rock2', 'assets/kenney/PNG/Objects/rock2.png'],
            ['tribune', 'assets/kenney/PNG/Objects/tribune_overhang_striped.png'],
            ['arrow_left', 'assets/kenney/PNG/Objects/arrow_white.png'],
            ['arrow_right', 'assets/kenney/PNG/Objects/arrow_yellow.png'],
        ];

        this.total = assets.length;

        const promises = assets.map(([name, path]) => this.loadImage(name, path));

        await Promise.all(promises);

        // Generate procedural guardrail sprites (since Kenney assets are top-down)
        this.generateGuardrailSprites();

        console.log(`Loaded ${this.loaded}/${this.total} assets`);
        return this.images;
    }

    // Generate side-view guardrail post sprites procedurally
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

        // Yellow bollard (shorter, wider) for inner guardrail
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
