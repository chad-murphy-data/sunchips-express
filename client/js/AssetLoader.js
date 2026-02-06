// AssetLoader.js - Simplified asset loader for Three.js renderer
// The 3D renderer handles all visual elements, so we only need minimal assets

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
        // With Three.js handling all 3D rendering, we don't need sprite assets
        // Keep minimal assets for potential future use (UI, minimap, etc.)
        const assets = [];

        this.total = assets.length || 1; // Avoid division by zero
        this.loaded = 1;

        if (assets.length > 0) {
            const promises = assets.map(([name, path]) => this.loadImage(name, path));
            await Promise.all(promises);
        }

        console.log('Asset loading complete (Three.js handles 3D rendering)');
        return this.images;
    }

    get(name) {
        return this.images[name];
    }

    getProgress() {
        return this.total > 0 ? this.loaded / this.total : 1;
    }
}
