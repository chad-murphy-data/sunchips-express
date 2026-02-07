// ThreeRenderer.js - Three.js based 3D renderer for the office environment

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Shared materials palette for consistent look and better performance
function buildMaterials() {
    return {
        // Metals
        chrome: new THREE.MeshStandardMaterial({
            color: 0xCCCCCC,
            metalness: 0.9,
            roughness: 0.1
        }),
        brushedSteel: new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.7,
            roughness: 0.35
        }),
        blackMetal: new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.6,
            roughness: 0.4
        }),

        // Plastics
        whitePlastic: new THREE.MeshStandardMaterial({
            color: 0xF5F5F5,
            metalness: 0.0,
            roughness: 0.4
        }),
        grayPlastic: new THREE.MeshStandardMaterial({
            color: 0x606060,
            metalness: 0.0,
            roughness: 0.5
        }),
        blackPlastic: new THREE.MeshStandardMaterial({
            color: 0x1A1A1A,
            metalness: 0.0,
            roughness: 0.6
        }),

        // Fabrics
        seatFabric: new THREE.MeshStandardMaterial({
            color: 0x2E4A2E,
            metalness: 0.0,
            roughness: 0.9
        }),
        chairFabric: new THREE.MeshStandardMaterial({
            color: 0x2A2A2A,
            metalness: 0.0,
            roughness: 0.95
        }),

        // Woods
        deskWood: new THREE.MeshStandardMaterial({
            color: 0x8B5A2B,
            metalness: 0.0,
            roughness: 0.7
        }),
        darkWood: new THREE.MeshStandardMaterial({
            color: 0x5D4037,
            metalness: 0.0,
            roughness: 0.65
        }),

        // Glass
        clearGlass: new THREE.MeshStandardMaterial({
            color: 0xCCEEFF,
            metalness: 0.1,
            roughness: 0.05,
            transparent: true,
            opacity: 0.3
        }),
        tintedGlass: new THREE.MeshStandardMaterial({
            color: 0x88AACC,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.5
        }),

        // Accent colors
        sunChipsYellow: new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.0,
            roughness: 0.5
        }),
        golfCartGreen: new THREE.MeshStandardMaterial({
            color: 0x2E8B57,
            metalness: 0.0,
            roughness: 0.6
        }),
        cautionYellow: new THREE.MeshStandardMaterial({
            color: 0xFFCC00,
            metalness: 0.0,
            roughness: 0.5
        }),
        redTaillight: new THREE.MeshStandardMaterial({
            color: 0xCC0000,
            metalness: 0.2,
            roughness: 0.3,
            emissive: 0x330000,
            emissiveIntensity: 0.3
        }),
        headlightGlow: new THREE.MeshStandardMaterial({
            color: 0xFFFF88,
            emissive: 0xFFFF44,
            emissiveIntensity: 0.6
        }),

        // Office specific
        cubicleGray: new THREE.MeshStandardMaterial({
            color: 0x808090,
            metalness: 0.0,
            roughness: 0.8
        }),
        cubicleFrame: new THREE.MeshStandardMaterial({
            color: 0x606068,
            metalness: 0.4,
            roughness: 0.5
        }),
        whiteboard: new THREE.MeshStandardMaterial({
            color: 0xFAFAFA,
            metalness: 0.1,
            roughness: 0.2
        }),
        recyclingBlue: new THREE.MeshStandardMaterial({
            color: 0x2255AA,
            metalness: 0.0,
            roughness: 0.6
        }),
        vendingRed: new THREE.MeshStandardMaterial({
            color: 0xCC2222,
            metalness: 0.1,
            roughness: 0.4
        }),
        printerGray: new THREE.MeshStandardMaterial({
            color: 0xCCCCCC,
            metalness: 0.0,
            roughness: 0.5
        }),

        // Nature
        plantGreen: new THREE.MeshStandardMaterial({
            color: 0x228B22,
            metalness: 0.0,
            roughness: 0.8
        }),
        potBrown: new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            metalness: 0.0,
            roughness: 0.9
        }),
        trunkBrown: new THREE.MeshStandardMaterial({
            color: 0x5D3A1A,
            metalness: 0.0,
            roughness: 0.95
        }),

        // Water cooler
        waterBlue: new THREE.MeshStandardMaterial({
            color: 0x4488CC,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7
        }),

        // Screen
        screenGlow: new THREE.MeshStandardMaterial({
            color: 0x4488FF,
            emissive: 0x2244AA,
            emissiveIntensity: 0.4
        })
    };
}

// Particle class for collision and skid effects
class Particle {
    constructor(mesh, velocity, lifespan, rotSpeed = null) {
        this.mesh = mesh;
        this.velocity = velocity;  // { x, y, z }
        this.lifespan = lifespan;  // seconds
        this.age = 0;
        this.initialOpacity = mesh.material.opacity;
        // Rotation speed for paper flutter effect
        this.rotSpeed = rotSpeed || { x: 0, y: 0, z: 0 };
    }

    update(dt) {
        this.age += dt;

        // Move
        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.y += this.velocity.y * dt;
        this.mesh.position.z += this.velocity.z * dt;

        // Gravity on Y
        this.velocity.y -= 80 * dt;

        // Spin (for papers)
        if (this.rotSpeed) {
            this.mesh.rotation.x += this.rotSpeed.x * dt;
            this.mesh.rotation.y += this.rotSpeed.y * dt;
            this.mesh.rotation.z += this.rotSpeed.z * dt;
        }

        // Fade out
        const life = 1 - (this.age / this.lifespan);
        this.mesh.material.opacity = this.initialOpacity * life;

        return this.age < this.lifespan;
    }
}

// Chip bag particle (handles groups with multiple children)
class ChipBagParticle {
    constructor(group, velocity, lifespan, rotSpeed = null) {
        this.mesh = group;  // Using 'mesh' for compatibility with cleanup code
        this.velocity = velocity;
        this.lifespan = lifespan;
        this.age = 0;
        this.rotSpeed = rotSpeed || { x: 0, y: 0, z: 0 };

        // Store initial opacity for all children
        this.childMaterials = [];
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                this.childMaterials.push({
                    material: child.material,
                    initialOpacity: child.material.opacity || 1
                });
            }
        });
    }

    update(dt) {
        this.age += dt;

        // Move
        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.y += this.velocity.y * dt;
        this.mesh.position.z += this.velocity.z * dt;

        // Gravity on Y
        this.velocity.y -= 60 * dt;  // Slightly less gravity for bags

        // Spin
        if (this.rotSpeed) {
            this.mesh.rotation.x += this.rotSpeed.x * dt;
            this.mesh.rotation.y += this.rotSpeed.y * dt;
            this.mesh.rotation.z += this.rotSpeed.z * dt;
        }

        // Fade out all children
        const life = 1 - (this.age / this.lifespan);
        for (const item of this.childMaterials) {
            item.material.opacity = item.initialOpacity * life;
        }

        return this.age < this.lifespan;
    }
}

export class ThreeRenderer {
    constructor(canvas) {
        this.canvas = canvas;

        // Build shared materials palette
        this.materials = buildMaterials();

        // Get container size for proper aspect ratio
        const container = document.getElementById('game-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Three.js fundamentals - narrower FOV for less distortion
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, width / height, 1, 2000);

        // Brighter background color (light gray office)
        this.scene.background = new THREE.Color(0xE8E8E0);

        // References to dynamic objects
        this.cartGroup = null;
        this.particles = [];
        this.screenShake = { active: false, intensity: 0, timer: 0 };

        // Loaded assets
        this.loadedModels = {};
        this.gltfLoader = new GLTFLoader();

        // Configure renderer to fill container
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add fog for distance fade - lighter fog to match brighter scene
        this.scene.fog = new THREE.Fog(0xE8E8E0, 500, 1400);

        // Scene constants - camera further back and higher
        this.CEILING_HEIGHT = 90;
        this.WALL_HEIGHT = 60;
        this.WALL_THICKNESS = 10;
        this.FOLLOW_DISTANCE = 120;
        this.CAMERA_HEIGHT = 60;
        this.LOOK_AHEAD = 80;

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const container = document.getElementById('game-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    async loadAssets() {
        console.log('Loading GLB assets...');

        // Define assets to load with their paths
        const assetManifest = {
            // Cart
            cart: 'assets/cart/golf_cart.glb',
            // Office furniture
            chairDesk: 'assets/furniture/chairDesk.glb',
            desk: 'assets/furniture/desk.glb',
            computerScreen: 'assets/furniture/computerScreen.glb',
            computerKeyboard: 'assets/furniture/computerKeyboard.glb',
            plantSmall1: 'assets/furniture/plantSmall1.glb',
            plantSmall2: 'assets/furniture/plantSmall2.glb',
            tableCoffee: 'assets/furniture/tableCoffee.glb',
            // Arcade items
            vendingMachine: 'assets/arcade/vending-machine.glb',
            arcadeMachine: 'assets/arcade/arcade-machine.glb',
            // Food items for decoration
            bag: 'assets/food/bag.glb',
            // Wall pieces (furniture set)
            wall: 'assets/furniture/wall.glb',
            wallWindow: 'assets/furniture/wallWindow.glb',
            wallWindowSlide: 'assets/furniture/wallWindowSlide.glb',
            wallDoorway: 'assets/furniture/wallDoorway.glb',
            wallDoorwayWide: 'assets/furniture/wallDoorwayWide.glb',
            wallCorner: 'assets/furniture/wallCorner.glb',
            wallCornerRond: 'assets/furniture/wallCornerRond.glb',
            wallHalf: 'assets/furniture/wallHalf.glb',
            // Racing elements
            barrierRed: 'assets/racing/barrierRed.glb',
            barrierWhite: 'assets/racing/barrierWhite.glb',
            flagCheckers: 'assets/racing/flagCheckers.glb',
            flagCheckersSmall: 'assets/racing/flagCheckersSmall.glb',
            flagGreen: 'assets/racing/flagGreen.glb',
            flagRed: 'assets/racing/flagRed.glb',
            bannerTowerGreen: 'assets/racing/bannerTowerGreen.glb',
            bannerTowerRed: 'assets/racing/bannerTowerRed.glb',
            pylon: 'assets/racing/pylon.glb',
            billboard: 'assets/racing/billboard.glb',
            billboardLow: 'assets/racing/billboardLow.glb',
            lightPostModern: 'assets/racing/lightPostModern.glb',
        };

        // Load all assets in parallel
        const loadPromises = Object.entries(assetManifest).map(async ([key, path]) => {
            try {
                const gltf = await this.loadGLTF(path);
                this.loadedModels[key] = gltf.scene;
                console.log(`Loaded: ${key}`);
            } catch (error) {
                console.warn(`Could not load ${key} from ${path}:`, error.message);
                this.loadedModels[key] = null;
            }
        });

        await Promise.all(loadPromises);

        // Measure wall model dimensions for tiling
        this.wallModelWidths = {};
        for (const key of ['wall', 'wallWindow', 'wallWindowSlide', 'wallDoorway', 'wallDoorwayWide', 'wallHalf']) {
            const model = this.loadedModels[key];
            if (model) {
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                this.wallModelWidths[key] = { width: size.x, height: size.y, depth: size.z };
                console.log(`Wall model ${key}: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
            }
        }

        console.log('All assets loaded');
    }

    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => resolve(gltf),
                (progress) => {
                    // Optional: track loading progress
                },
                (error) => reject(error)
            );
        });
    }

    // Clone a loaded GLB model and scale it to a target size
    cloneModel(modelKey, targetHeight = 30) {
        const model = this.loadedModels[modelKey];
        if (!model) return null;

        const clone = model.clone();

        // Compute bounding box and scale to target height
        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const scale = targetHeight / size.y;
        clone.scale.set(scale, scale, scale);

        // Recompute box after scaling
        box.setFromObject(clone);
        const center = box.getCenter(new THREE.Vector3());

        // Center horizontally and place on ground
        clone.position.x = -center.x;
        clone.position.y = -box.min.y;
        clone.position.z = -center.z;

        // Enable shadows
        clone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Wrap in a group for easier positioning
        const group = new THREE.Group();
        group.add(clone);
        return group;
    }

    async buildScene(track) {
        // Load GLB assets first
        await this.loadAssets();

        this.buildFloor(track);
        this.buildCeiling(track);
        this.buildLighting();
        this.buildTiledWalls(track);
        this.buildRacingElements(track);
        this.buildFurniture(track);
        this.buildCart();
    }

    buildFloor(track) {
        const ts = track.tileSize;

        // Create carpet texture from canvas
        const carpetCanvas = document.createElement('canvas');
        carpetCanvas.width = 128;
        carpetCanvas.height = 128;
        const carpetCtx = carpetCanvas.getContext('2d');

        // Base carpet color
        carpetCtx.fillStyle = '#5A5A6E';
        carpetCtx.fillRect(0, 0, 128, 128);

        // Speckle pattern - more density
        for (let i = 0; i < 350; i++) {
            const variation = Math.floor(Math.random() * 30) - 15;
            carpetCtx.fillStyle = `rgb(${90 + variation}, ${90 + variation}, ${110 + variation})`;
            carpetCtx.fillRect(
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                1, 1
            );
        }

        // Larger color variations
        for (let i = 0; i < 50; i++) {
            const variation = Math.floor(Math.random() * 20) - 10;
            carpetCtx.fillStyle = `rgb(${85 + variation}, ${85 + variation}, ${105 + variation})`;
            carpetCtx.fillRect(
                Math.floor(Math.random() * 126),
                Math.floor(Math.random() * 126),
                2, 2
            );
        }

        // Tile seam - more visible
        carpetCtx.strokeStyle = 'rgba(0,0,0,0.25)';
        carpetCtx.lineWidth = 1;
        carpetCtx.strokeRect(0.5, 0.5, 127, 127);

        const carpetTexture = new THREE.CanvasTexture(carpetCanvas);
        carpetTexture.wrapS = THREE.RepeatWrapping;
        carpetTexture.wrapT = THREE.RepeatWrapping;

        // Create linoleum texture
        const linoleumCanvas = document.createElement('canvas');
        linoleumCanvas.width = 128;
        linoleumCanvas.height = 128;
        const linoleumCtx = linoleumCanvas.getContext('2d');

        linoleumCtx.fillStyle = '#C8B896';
        linoleumCtx.fillRect(0, 0, 128, 128);

        // Subtle mottling
        for (let i = 0; i < 150; i++) {
            const variation = Math.floor(Math.random() * 20) - 10;
            linoleumCtx.fillStyle = `rgb(${200 + variation}, ${184 + variation}, ${150 + variation})`;
            linoleumCtx.fillRect(
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                2, 2
            );
        }

        // Faint scuff marks
        linoleumCtx.strokeStyle = 'rgba(80, 70, 50, 0.15)';
        linoleumCtx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const x = Math.floor(Math.random() * 120) + 4;
            const y = Math.floor(Math.random() * 120) + 4;
            linoleumCtx.beginPath();
            linoleumCtx.moveTo(x, y);
            linoleumCtx.lineTo(x + Math.random() * 15 - 7, y + Math.random() * 4);
            linoleumCtx.stroke();
        }

        const linoleumTexture = new THREE.CanvasTexture(linoleumCanvas);
        linoleumTexture.wrapS = THREE.RepeatWrapping;
        linoleumTexture.wrapT = THREE.RepeatWrapping;
        linoleumTexture.repeat.set(track.width, track.height);

        // Create large linoleum floor (entire map)
        const mapSize = track.width * ts;
        const linoleumGeo = new THREE.PlaneGeometry(mapSize, mapSize);
        const linoleumMat = new THREE.MeshStandardMaterial({
            map: linoleumTexture,
            roughness: 0.8
        });
        const linoleum = new THREE.Mesh(linoleumGeo, linoleumMat);
        linoleum.rotation.x = -Math.PI / 2;
        linoleum.position.set(mapSize / 2, -0.1, mapSize / 2);
        linoleum.receiveShadow = true;
        this.scene.add(linoleum);

        // Build carpet for the road surface
        const left = track.roadLeft;
        const right = track.roadRight;
        const top = track.roadTop;
        const bottom = track.roadBottom;
        const w = track.roadWidth;

        // Road sections (rectangular carpet pieces)
        const carpetMat = new THREE.MeshStandardMaterial({
            map: carpetTexture,
            roughness: 0.9
        });

        // Helper to create a carpet section
        const createCarpetSection = (x1, z1, x2, z2) => {
            const width = Math.abs(x2 - x1);
            const depth = Math.abs(z2 - z1);

            // Update texture repeat for this section
            const sectionTexture = carpetTexture.clone();
            sectionTexture.repeat.set(width / ts, depth / ts);
            sectionTexture.needsUpdate = true;

            const mat = new THREE.MeshStandardMaterial({
                map: sectionTexture,
                roughness: 0.9
            });

            const geo = new THREE.PlaneGeometry(width, depth);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        };

        // Top horizontal road
        createCarpetSection(left * ts, top * ts, (right + w) * ts, (top + w) * ts);
        // Bottom horizontal road
        createCarpetSection(left * ts, bottom * ts, (right + w) * ts, (bottom + w) * ts);
        // Left vertical road
        createCarpetSection(left * ts, (top + w) * ts, (left + w) * ts, bottom * ts);
        // Right vertical road
        createCarpetSection(right * ts, (top + w) * ts, (right + w) * ts, bottom * ts);

        // Floor tape lines (yellow center lines on carpet)
        const tapeMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            roughness: 0.5
        });

        const createTapeLine = (x1, z1, x2, z2, width = 4) => {
            const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
            const geo = new THREE.PlaneGeometry(width, length);
            const tape = new THREE.Mesh(geo, tapeMat);
            tape.rotation.x = -Math.PI / 2;
            tape.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);

            // Rotate to align with direction
            if (Math.abs(x2 - x1) > Math.abs(z2 - z1)) {
                tape.rotation.z = Math.PI / 2;
            }

            this.scene.add(tape);
        };

        // Center lines for each road section
        const centerOffset = w * ts / 2;

        // Top horizontal center line
        createTapeLine((left + 0.5) * ts, (top * ts) + centerOffset, (right + w - 0.5) * ts, (top * ts) + centerOffset);
        // Bottom horizontal center line
        createTapeLine((left + 0.5) * ts, (bottom * ts) + centerOffset, (right + w - 0.5) * ts, (bottom * ts) + centerOffset);
        // Left vertical center line
        createTapeLine((left * ts) + centerOffset, (top + w + 0.5) * ts, (left * ts) + centerOffset, (bottom - 0.5) * ts);
        // Right vertical center line
        createTapeLine((right * ts) + centerOffset, (top + w + 0.5) * ts, (right * ts) + centerOffset, (bottom - 0.5) * ts);
    }

    buildCeiling(track) {
        const ts = track.tileSize;
        const mapSize = track.width * ts;

        // Create ceiling grid texture
        const ceilingCanvas = document.createElement('canvas');
        ceilingCanvas.width = 128;
        ceilingCanvas.height = 128;
        const ctx = ceilingCanvas.getContext('2d');

        // Base color (off-white)
        ctx.fillStyle = '#E8E8E0';
        ctx.fillRect(0, 0, 128, 128);

        // Grid lines (drop ceiling T-bar)
        ctx.strokeStyle = '#C0C0B8';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 126, 126);

        const ceilingTexture = new THREE.CanvasTexture(ceilingCanvas);
        ceilingTexture.wrapS = THREE.RepeatWrapping;
        ceilingTexture.wrapT = THREE.RepeatWrapping;
        ceilingTexture.repeat.set(mapSize / 200, mapSize / 200);

        // Ceiling plane
        const ceilingGeo = new THREE.PlaneGeometry(mapSize, mapSize);
        const ceilingMat = new THREE.MeshStandardMaterial({
            map: ceilingTexture,
            side: THREE.BackSide,
            roughness: 0.9
        });
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(mapSize / 2, this.CEILING_HEIGHT, mapSize / 2);
        this.scene.add(ceiling);

        // Fluorescent light panels
        const lightPanelGeo = new THREE.PlaneGeometry(40, 12);
        const lightPanelMat = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            emissive: 0xFFFFF0,
            emissiveIntensity: 0.8,
            side: THREE.BackSide
        });

        // Place lights in grid pattern over the track area
        const spacing = 300;
        const startX = track.roadLeft * ts - 200;
        const endX = (track.roadRight + track.roadWidth) * ts + 200;
        const startZ = track.roadTop * ts - 200;
        const endZ = (track.roadBottom + track.roadWidth) * ts + 200;

        for (let x = startX; x < endX; x += spacing) {
            for (let z = startZ; z < endZ; z += spacing) {
                const panel = new THREE.Mesh(lightPanelGeo, lightPanelMat);
                panel.position.set(x, this.CEILING_HEIGHT - 0.5, z);
                panel.rotation.x = Math.PI / 2;
                this.scene.add(panel);
            }
        }
    }

    buildLighting() {
        // Brighter ambient light - base fluorescent wash
        const ambient = new THREE.AmbientLight(0xF8F4EC, 0.85);
        this.scene.add(ambient);

        // Hemisphere light - warm from above, cool from floor
        const hemi = new THREE.HemisphereLight(0xFFFFF0, 0x808080, 0.4);
        this.scene.add(hemi);

        // Main directional light for shadows
        const mainLight = new THREE.DirectionalLight(0xFFFFFA, 0.6);
        mainLight.position.set(2000, 85, 2000);
        mainLight.castShadow = true;

        // Shadow settings
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far = 500;
        mainLight.shadow.camera.left = -1000;
        mainLight.shadow.camera.right = 1000;
        mainLight.shadow.camera.top = 1000;
        mainLight.shadow.camera.bottom = -1000;
        mainLight.shadow.radius = 4;

        this.scene.add(mainLight);

        // Fill light from front to reduce harsh shadows
        const fillLight = new THREE.DirectionalLight(0xF0F0FF, 0.3);
        fillLight.position.set(-1000, 60, -1000);
        this.scene.add(fillLight);
    }

    getWallRuns(track) {
        const ts = track.tileSize;
        const wallOffset = -15;
        const cornerGap = this.WALL_THICKNESS * 4;

        const outerLeft = track.roadLeft * ts - wallOffset;
        const outerRight = (track.roadRight + track.roadWidth) * ts + wallOffset;
        const outerTop = track.roadTop * ts - wallOffset;
        const outerBottom = (track.roadBottom + track.roadWidth) * ts + wallOffset;

        const innerLeft = (track.roadLeft + track.roadWidth) * ts + wallOffset;
        const innerRight = track.roadRight * ts - wallOffset;
        const innerTop = (track.roadTop + track.roadWidth) * ts + wallOffset;
        const innerBottom = track.roadBottom * ts - wallOffset;

        // Store computed bounds for use by other methods
        this._wallBounds = { outerLeft, outerRight, outerTop, outerBottom, innerLeft, innerRight, innerTop, innerBottom };

        return [
            // Outer walls - facing inward toward road
            { start: {x: outerLeft + cornerGap, z: outerTop},   end: {x: outerRight - cornerGap, z: outerTop},   rotY: 0,            label: 'outerTop' },
            { start: {x: outerLeft + cornerGap, z: outerBottom}, end: {x: outerRight - cornerGap, z: outerBottom}, rotY: Math.PI,      label: 'outerBottom' },
            { start: {x: outerLeft, z: outerTop + cornerGap},   end: {x: outerLeft, z: outerBottom - cornerGap},   rotY: Math.PI / 2,  label: 'outerLeft' },
            { start: {x: outerRight, z: outerTop + cornerGap},  end: {x: outerRight, z: outerBottom - cornerGap},  rotY: -Math.PI / 2, label: 'outerRight' },
            // Inner walls - facing outward toward road
            { start: {x: innerLeft + cornerGap, z: innerTop},   end: {x: innerRight - cornerGap, z: innerTop},   rotY: Math.PI,      label: 'innerTop' },
            { start: {x: innerLeft + cornerGap, z: innerBottom}, end: {x: innerRight - cornerGap, z: innerBottom}, rotY: 0,            label: 'innerBottom' },
            { start: {x: innerLeft, z: innerTop + cornerGap},   end: {x: innerLeft, z: innerBottom - cornerGap},   rotY: -Math.PI / 2, label: 'innerLeft' },
            { start: {x: innerRight, z: innerTop + cornerGap},  end: {x: innerRight, z: innerBottom - cornerGap},  rotY: Math.PI / 2,  label: 'innerRight' },
        ];
    }

    pickWallVariant(index) {
        const pattern = index % 7;
        switch (pattern) {
            case 2: return 'wallWindow';
            case 5: return 'wallDoorway';
            default: return 'wall';
        }
    }

    createFallbackWallSegment(x, z, width, thickness, rotY) {
        const m = this.materials;
        const geo = new THREE.BoxGeometry(width, this.WALL_HEIGHT, thickness);
        const wall = new THREE.Mesh(geo, m.cubicleGray);
        wall.position.set(x, this.WALL_HEIGHT / 2, z);
        wall.rotation.y = rotY;
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);

        const frameGeo = new THREE.BoxGeometry(width + 2, 3, thickness + 2);
        const frame = new THREE.Mesh(frameGeo, m.cubicleFrame);
        frame.position.set(x, this.WALL_HEIGHT, z);
        frame.rotation.y = rotY;
        this.scene.add(frame);
    }

    buildTiledWalls(track) {
        const wallRuns = this.getWallRuns(track);

        // Determine tiling stride from the wall model
        const wallInfo = this.wallModelWidths && this.wallModelWidths['wall'];
        if (!wallInfo || !this.loadedModels['wall']) {
            // Full fallback: use old box-geometry walls
            console.warn('Wall GLBs not available, using procedural fallback');
            for (const run of wallRuns) {
                const dx = run.end.x - run.start.x;
                const dz = run.end.z - run.start.z;
                const runLength = Math.sqrt(dx * dx + dz * dz);
                const cx = (run.start.x + run.end.x) / 2;
                const cz = (run.start.z + run.end.z) / 2;
                // Determine if wall runs along X or Z
                const isHorizontal = Math.abs(dx) > Math.abs(dz);
                if (isHorizontal) {
                    this.createFallbackWallSegment(cx, cz, runLength, this.WALL_THICKNESS, 0);
                } else {
                    this.createFallbackWallSegment(cx, cz, this.WALL_THICKNESS, runLength, 0);
                }
            }
            return;
        }

        // Scale factor: match wall model height to our WALL_HEIGHT
        const scaleFactor = this.WALL_HEIGHT / wallInfo.height;
        // Tiling stride in world units (use the larger of width/depth as the tiling dimension)
        const tileWidth = Math.max(wallInfo.width, wallInfo.depth) * scaleFactor;
        console.log(`Wall tiling: scaleFactor=${scaleFactor.toFixed(2)}, tileWidth=${tileWidth.toFixed(1)}`);

        for (const run of wallRuns) {
            const dx = run.end.x - run.start.x;
            const dz = run.end.z - run.start.z;
            const runLength = Math.sqrt(dx * dx + dz * dz);
            const numTiles = Math.max(1, Math.floor(runLength / tileWidth));
            const dirX = dx / runLength;
            const dirZ = dz / runLength;

            // Spread tiles evenly across the run
            const actualStride = runLength / numTiles;

            for (let i = 0; i < numTiles; i++) {
                const modelKey = this.pickWallVariant(i);
                const model = this.cloneModel(modelKey, this.WALL_HEIGHT);

                if (!model) {
                    // Per-tile fallback
                    const cx = run.start.x + dirX * (i * actualStride + actualStride / 2);
                    const cz = run.start.z + dirZ * (i * actualStride + actualStride / 2);
                    this.createFallbackWallSegment(cx, cz, actualStride, this.WALL_THICKNESS, run.rotY);
                    continue;
                }

                const cx = run.start.x + dirX * (i * actualStride + actualStride / 2);
                const cz = run.start.z + dirZ * (i * actualStride + actualStride / 2);

                model.position.set(cx, 0, cz);
                model.rotation.y = run.rotY;
                this.scene.add(model);
            }
        }

        // Place corner pieces
        this.placeCornerPieces();
    }

    placeCornerPieces() {
        const b = this._wallBounds;
        if (!b) return;

        const corners = [
            // Outer corners (rounded for smooth appearance)
            { x: b.outerLeft,  z: b.outerTop,    rotY: 0,              model: 'wallCornerRond' },
            { x: b.outerRight, z: b.outerTop,    rotY: -Math.PI / 2,  model: 'wallCornerRond' },
            { x: b.outerLeft,  z: b.outerBottom, rotY: Math.PI / 2,   model: 'wallCornerRond' },
            { x: b.outerRight, z: b.outerBottom, rotY: Math.PI,       model: 'wallCornerRond' },
            // Inner corners (sharp)
            { x: b.innerLeft,  z: b.innerTop,    rotY: Math.PI,       model: 'wallCorner' },
            { x: b.innerRight, z: b.innerTop,    rotY: Math.PI / 2,   model: 'wallCorner' },
            { x: b.innerLeft,  z: b.innerBottom, rotY: -Math.PI / 2,  model: 'wallCorner' },
            { x: b.innerRight, z: b.innerBottom, rotY: 0,             model: 'wallCorner' },
        ];

        for (const corner of corners) {
            const piece = this.cloneModel(corner.model, this.WALL_HEIGHT);
            if (piece) {
                piece.position.set(corner.x, 0, corner.z);
                piece.rotation.y = corner.rotY;
                this.scene.add(piece);
            }
        }
    }

    buildRacingElements(track) {
        const wallRuns = this.getWallRuns(track);
        const b = this._wallBounds;
        if (!b) return;

        // === Barriers along road edges ===
        const barrierSpacing = 250;
        const barrierOffset = 25; // offset from wall toward road center

        for (const run of wallRuns) {
            const dx = run.end.x - run.start.x;
            const dz = run.end.z - run.start.z;
            const runLength = Math.sqrt(dx * dx + dz * dz);
            if (runLength < barrierSpacing) continue;

            const dirX = dx / runLength;
            const dirZ = dz / runLength;

            // Normal pointing into road (perpendicular to wall direction)
            const isOuter = run.label.startsWith('outer');
            const normalX = -dirZ * (isOuter ? 1 : -1);
            const normalZ = dirX * (isOuter ? 1 : -1);

            const numBarriers = Math.floor(runLength / barrierSpacing);
            for (let i = 0; i < numBarriers; i++) {
                const t = (i + 0.5) / numBarriers;
                const bx = run.start.x + dx * t + normalX * barrierOffset;
                const bz = run.start.z + dz * t + normalZ * barrierOffset;

                const modelKey = (i % 2 === 0) ? 'barrierRed' : 'barrierWhite';
                const barrier = this.cloneModel(modelKey, 12);
                if (barrier) {
                    barrier.position.set(bx, 0, bz);
                    barrier.rotation.y = run.rotY;
                    this.scene.add(barrier);
                }
            }
        }

        // === Start/Finish line ===
        const startPos = track.getStartPosition();
        // Start is on bottom straightaway heading west
        // Road runs east-west, outer wall at higher z, inner wall at lower z

        const flag1 = this.cloneModel('flagCheckers', 50);
        if (flag1) {
            flag1.position.set(startPos.x, 0, startPos.y + 60);
            flag1.rotation.y = Math.PI;
            this.scene.add(flag1);
        }

        const flag2 = this.cloneModel('flagCheckers', 50);
        if (flag2) {
            flag2.position.set(startPos.x, 0, startPos.y - 60);
            flag2.rotation.y = 0;
            this.scene.add(flag2);
        }

        // Small flanking flags
        for (const [dx, dz] of [[-80, 40], [80, 40], [-80, -40], [80, -40]]) {
            const sf = this.cloneModel('flagCheckersSmall', 30);
            if (sf) {
                sf.position.set(startPos.x + dx, 0, startPos.y + dz);
                this.scene.add(sf);
            }
        }

        // === Pylons at corners ===
        const allCorners = [
            { x: b.outerLeft, z: b.outerTop },
            { x: b.outerRight, z: b.outerTop },
            { x: b.outerLeft, z: b.outerBottom },
            { x: b.outerRight, z: b.outerBottom },
            { x: b.innerLeft, z: b.innerTop },
            { x: b.innerRight, z: b.innerTop },
            { x: b.innerLeft, z: b.innerBottom },
            { x: b.innerRight, z: b.innerBottom },
        ];

        for (const corner of allCorners) {
            for (let j = 0; j < 3; j++) {
                const pylon = this.cloneModel('pylon', 15);
                if (pylon) {
                    // Spread pylons in a small cluster around the corner
                    const seed = corner.x * 7 + corner.z * 13 + j * 31;
                    const px = ((seed % 40) - 20);
                    const pz = (((seed * 3) % 40) - 20);
                    pylon.position.set(corner.x + px, 0, corner.z + pz);
                    this.scene.add(pylon);
                }
            }
        }

        // === Banner towers at straightaway midpoints ===
        const midpoints = [
            { x: (b.outerLeft + b.outerRight) / 2, z: b.outerTop - 30, rotY: 0 },
            { x: (b.outerLeft + b.outerRight) / 2, z: b.outerBottom + 30, rotY: Math.PI },
            { x: b.outerLeft - 30, z: (b.outerTop + b.outerBottom) / 2, rotY: Math.PI / 2 },
            { x: b.outerRight + 30, z: (b.outerTop + b.outerBottom) / 2, rotY: -Math.PI / 2 },
        ];

        midpoints.forEach((mp, i) => {
            const key = (i % 2 === 0) ? 'bannerTowerGreen' : 'bannerTowerRed';
            const tower = this.cloneModel(key, 70);
            if (tower) {
                tower.position.set(mp.x, 0, mp.z);
                tower.rotation.y = mp.rotY;
                this.scene.add(tower);
            }
        });

        // === Billboards outside the track ===
        const billboardPositions = [
            { x: b.outerLeft - 80, z: b.outerTop + 300, rotY: Math.PI / 2 },
            { x: b.outerRight + 80, z: b.outerBottom - 300, rotY: -Math.PI / 2 },
            { x: b.outerLeft + 400, z: b.outerTop - 80, rotY: 0 },
            { x: b.outerRight - 400, z: b.outerBottom + 80, rotY: Math.PI },
        ];

        billboardPositions.forEach((bp, i) => {
            const key = (i % 2 === 0) ? 'billboard' : 'billboardLow';
            const bb = this.cloneModel(key, 55);
            if (bb) {
                bb.position.set(bp.x, 0, bp.z);
                bb.rotation.y = bp.rotY;
                this.scene.add(bb);
            }
        });

        // === Light posts along outer straightaways ===
        const lightSpacing = 400;
        for (const run of wallRuns) {
            if (!run.label.startsWith('outer')) continue;
            const dx = run.end.x - run.start.x;
            const dz = run.end.z - run.start.z;
            const runLength = Math.sqrt(dx * dx + dz * dz);
            if (runLength < lightSpacing) continue;

            const dirX = dx / runLength;
            const dirZ = dz / runLength;
            const numLights = Math.floor(runLength / lightSpacing);

            for (let i = 0; i < numLights; i++) {
                const t = (i + 0.5) / numLights;
                const lx = run.start.x + dx * t;
                const lz = run.start.z + dz * t;

                const light = this.cloneModel('lightPostModern', 75);
                if (light) {
                    // Position just outside the wall
                    const normalX = dirZ; // perpendicular, pointing outward from outer wall
                    const normalZ = -dirX;
                    light.position.set(lx + normalX * 30, 0, lz + normalZ * 30);
                    light.rotation.y = run.rotY;
                    this.scene.add(light);
                }
            }
        }
    }

    buildFurniture(track) {
        // Filter out barrier types that are now walls
        const barrierTypes = ['cubicle_wall', 'cubicle_wall_tall', 'filing_cabinet', 'filing_cabinet_short'];

        for (const obstacle of track.obstacles) {
            // Skip barrier types - they're rendered as walls now
            if (barrierTypes.includes(obstacle.type)) continue;

            let obj = null;

            switch (obstacle.type) {
                case 'office_chair':
                    obj = this.createOfficeChair();
                    break;
                case 'water_cooler':
                    obj = this.createWaterCooler();
                    break;
                case 'printer':
                    obj = this.createPrinter();
                    break;
                case 'potted_ficus':
                    obj = this.createPottedFicus();
                    break;
                case 'desk_with_monitor':
                    obj = this.createDeskWithMonitor();
                    break;
                case 'vending_machine':
                    obj = this.createVendingMachine();
                    break;
                case 'whiteboard':
                    obj = this.createWhiteboard();
                    break;
                case 'recycling_bin':
                    obj = this.createRecyclingBin();
                    break;
                case 'caution_sign':
                    obj = this.createCautionSign();
                    break;
                case 'conference_table':
                    obj = this.createConferenceTable();
                    break;
                case 'arcade_machine':
                    obj = this.createArcadeMachine();
                    break;
                default:
                    continue;
            }

            if (obj) {
                // Convert game (x, y) to Three.js (x, z)
                obj.position.set(obstacle.x, 0, obstacle.y);
                // Random rotation for variety
                obj.rotation.y = Math.random() * Math.PI * 2;
                this.scene.add(obj);
            }
        }
    }

    // Furniture factory functions using GLB models with procedural fallbacks
    createOfficeChair() {
        // Try GLB first
        const glb = this.cloneModel('chairDesk', 35);
        if (glb) return glb;

        // Procedural fallback
        const group = new THREE.Group();
        const m = this.materials;

        // Seat - fabric
        const seat = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 14), m.chairFabric);
        seat.position.y = 18;
        seat.castShadow = true;
        group.add(seat);

        // Back rest - fabric
        const back = new THREE.Mesh(new THREE.BoxGeometry(12, 16, 3), m.chairFabric);
        back.position.set(0, 28, -5);
        back.castShadow = true;
        group.add(back);

        // Armrests - black plastic
        const armGeo = new THREE.BoxGeometry(2, 2, 10);
        const armL = new THREE.Mesh(armGeo, m.blackPlastic);
        armL.position.set(-7, 22, 0);
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, m.blackPlastic);
        armR.position.set(7, 22, 0);
        group.add(armR);

        // Post - chrome
        const post = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 14, 8), m.chrome);
        post.position.y = 10;
        group.add(post);

        // Base - black plastic with chrome
        const baseGeo = new THREE.BoxGeometry(18, 2, 4);
        const base = new THREE.Mesh(baseGeo, m.blackPlastic);
        base.position.y = 2;
        group.add(base);
        const base2 = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 18), m.blackPlastic);
        base2.position.y = 2;
        group.add(base2);

        // Casters - chrome
        const casterGeo = new THREE.SphereGeometry(1.5, 8, 8);
        const casterPositions = [[-8, 1, 0], [8, 1, 0], [0, 1, -8], [0, 1, 8]];
        for (const [x, y, z] of casterPositions) {
            const caster = new THREE.Mesh(casterGeo, m.chrome);
            caster.position.set(x, y, z);
            group.add(caster);
        }

        return group;
    }

    createWaterCooler() {
        const group = new THREE.Group();
        const m = this.materials;

        // Body - white plastic
        const body = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 12), m.whitePlastic);
        body.position.y = 15;
        body.castShadow = true;
        group.add(body);

        // Water jug - translucent blue
        const jug = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 18, 12), m.waterBlue);
        jug.position.y = 39;
        group.add(jug);

        // Spout buttons - red and blue
        const hotButton = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), m.redTaillight);
        hotButton.position.set(-2, 18, 6.5);
        group.add(hotButton);
        const coldButton = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), m.recyclingBlue);
        coldButton.position.set(2, 18, 6.5);
        group.add(coldButton);

        // Base - brushed steel
        const base = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 14), m.brushedSteel);
        base.position.y = 1;
        group.add(base);

        return group;
    }

    createPrinter() {
        const group = new THREE.Group();
        const m = this.materials;

        // Main body - light gray plastic
        const body = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 18), m.printerGray);
        body.position.y = 12;
        body.castShadow = true;
        group.add(body);

        // Control panel - black plastic with screen
        const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 4), m.blackPlastic);
        panel.position.set(0, 19, -8);
        group.add(panel);

        // Small screen
        const screenGeo = new THREE.PlaneGeometry(4, 1.5);
        const screen = new THREE.Mesh(screenGeo, m.screenGlow);
        screen.position.set(0, 19.1, -6);
        screen.rotation.x = -0.3;
        group.add(screen);

        // Paper tray - white plastic
        const tray = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 8), m.whitePlastic);
        tray.position.set(0, 7, 12);
        group.add(tray);

        return group;
    }

    createPottedFicus() {
        // Try GLB plants first (randomly pick one)
        const plantKeys = ['plantSmall1', 'plantSmall2'];
        const plantKey = plantKeys[Math.floor(Math.random() * plantKeys.length)];
        const glb = this.cloneModel(plantKey, 45);
        if (glb) return glb;

        // Procedural fallback
        const group = new THREE.Group();
        const m = this.materials;

        // Pot - terracotta
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 10, 8), m.potBrown);
        pot.position.y = 5;
        pot.castShadow = true;
        group.add(pot);

        // Trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 15, 6), m.trunkBrown);
        trunk.position.y = 17;
        group.add(trunk);

        // Foliage (cluster of spheres)
        for (let i = 0; i < 5; i++) {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 3, 8, 8), m.plantGreen);
            leaf.position.set(
                (Math.random() - 0.5) * 10,
                28 + Math.random() * 8,
                (Math.random() - 0.5) * 10
            );
            leaf.castShadow = true;
            group.add(leaf);
        }

        return group;
    }

    createDeskWithMonitor() {
        // Try to build from GLB components
        if (this.loadedModels.desk && this.loadedModels.computerScreen) {
            const group = new THREE.Group();

            // Add desk
            const desk = this.cloneModel('desk', 28);
            if (desk) group.add(desk);

            // Add monitor on desk
            const monitor = this.cloneModel('computerScreen', 15);
            if (monitor) {
                monitor.position.set(0, 28, -5);
                group.add(monitor);
            }

            // Add keyboard
            const keyboard = this.cloneModel('computerKeyboard', 2);
            if (keyboard) {
                keyboard.position.set(0, 28, 5);
                group.add(keyboard);
            }

            return group;
        }

        // Procedural fallback
        const group = new THREE.Group();
        const m = this.materials;

        // Desk surface - wood
        const surface = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 24), m.deskWood);
        surface.position.y = 28;
        surface.castShadow = true;
        surface.receiveShadow = true;
        group.add(surface);

        // Legs - brushed steel
        const legGeo = new THREE.CylinderGeometry(1.5, 1.5, 26, 8);
        const positions = [[-17, 13, -9], [17, 13, -9], [-17, 13, 9], [17, 13, 9]];
        for (const [x, y, z] of positions) {
            const leg = new THREE.Mesh(legGeo, m.brushedSteel);
            leg.position.set(x, y, z);
            leg.castShadow = true;
            group.add(leg);
        }

        // Monitor bezel - black plastic
        const monitor = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 2), m.blackPlastic);
        monitor.position.set(0, 38, -6);
        monitor.castShadow = true;
        group.add(monitor);

        // Screen - glowing
        const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), m.screenGlow);
        screenMesh.position.set(0, 38, -4.9);
        group.add(screenMesh);

        // Monitor stand - chrome
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 4, 8), m.chrome);
        stand.position.set(0, 31, -6);
        group.add(stand);

        // Keyboard
        const keyboard = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 5), m.blackPlastic);
        keyboard.position.set(0, 29.5, 2);
        group.add(keyboard);

        // Mouse
        const mouse = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 4), m.blackPlastic);
        mouse.position.set(10, 29.5, 2);
        group.add(mouse);

        return group;
    }

    createVendingMachine() {
        // Try GLB first
        const glb = this.cloneModel('vendingMachine', 60);
        if (glb) return glb;

        // Procedural fallback
        const group = new THREE.Group();
        const m = this.materials;

        // Main body - red
        const body = new THREE.Mesh(new THREE.BoxGeometry(24, 60, 20), m.vendingRed);
        body.position.y = 30;
        body.castShadow = true;
        group.add(body);

        // Window - clear glass
        const window = new THREE.Mesh(new THREE.BoxGeometry(18, 35, 1), m.clearGlass);
        window.position.set(0, 35, 10.5);
        group.add(window);

        // Base - black metal
        const base = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 22), m.blackMetal);
        base.position.y = 4;
        group.add(base);

        // Coin slot - chrome
        const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 1), m.chrome);
        coinSlot.position.set(10, 40, 10.5);
        group.add(coinSlot);

        return group;
    }

    createWhiteboard() {
        const group = new THREE.Group();
        const m = this.materials;

        // Board - whiteboard material
        const board = new THREE.Mesh(new THREE.BoxGeometry(50, 36, 2), m.whiteboard);
        board.position.y = 50;
        board.castShadow = true;
        group.add(board);

        // Frame - brushed steel
        const frameTop = new THREE.Mesh(new THREE.BoxGeometry(52, 3, 3), m.brushedSteel);
        frameTop.position.set(0, 69, 0);
        group.add(frameTop);

        const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(52, 3, 3), m.brushedSteel);
        frameBottom.position.set(0, 31, 0);
        group.add(frameBottom);

        const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(3, 42, 3), m.brushedSteel);
        frameLeft.position.set(-26, 50, 0);
        group.add(frameLeft);

        const frameRight = new THREE.Mesh(new THREE.BoxGeometry(3, 42, 3), m.brushedSteel);
        frameRight.position.set(26, 50, 0);
        group.add(frameRight);

        // Stand posts - chrome
        const postGeo = new THREE.CylinderGeometry(2, 2, 68, 8);
        const postL = new THREE.Mesh(postGeo, m.chrome);
        postL.position.set(-20, 34, 5);
        group.add(postL);

        const postR = new THREE.Mesh(postGeo, m.chrome);
        postR.position.set(20, 34, 5);
        group.add(postR);

        // Marker tray
        const tray = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 3), m.grayPlastic);
        tray.position.set(0, 30, 2);
        group.add(tray);

        return group;
    }

    createRecyclingBin() {
        const group = new THREE.Group();
        const m = this.materials;

        // Bin body - recycling blue
        const bin = new THREE.Mesh(new THREE.BoxGeometry(12, 20, 12), m.recyclingBlue);
        bin.position.y = 10;
        bin.castShadow = true;
        group.add(bin);

        // Rim - darker plastic
        const rim = new THREE.Mesh(new THREE.BoxGeometry(13, 2, 13), m.grayPlastic);
        rim.position.y = 20;
        group.add(rim);

        return group;
    }

    createCautionSign() {
        const group = new THREE.Group();
        const m = this.materials;

        // A-frame sign (two angled panels)
        const panelGeo = new THREE.BoxGeometry(14, 30, 1);

        const panel1 = new THREE.Mesh(panelGeo, m.cautionYellow);
        panel1.position.set(0, 15, 3);
        panel1.rotation.x = 0.2;
        panel1.castShadow = true;
        group.add(panel1);

        const panel2 = new THREE.Mesh(panelGeo, m.cautionYellow);
        panel2.position.set(0, 15, -3);
        panel2.rotation.x = -0.2;
        panel2.castShadow = true;
        group.add(panel2);

        return group;
    }

    createConferenceTable() {
        // Try GLB coffee table scaled up
        const glb = this.cloneModel('tableCoffee', 28);
        if (glb) {
            // Scale wider for conference table feel
            glb.scale.set(1.5, 1, 1.5);
            return glb;
        }

        // Procedural fallback
        const group = new THREE.Group();
        const m = this.materials;

        // Table top - dark wood
        const top = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 30), m.darkWood);
        top.position.y = 28;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        // Legs - chrome
        const legGeo = new THREE.CylinderGeometry(2, 2, 26, 8);
        const legPositions = [[-25, 13, -10], [25, 13, -10], [-25, 13, 10], [25, 13, 10]];
        for (const [x, y, z] of legPositions) {
            const leg = new THREE.Mesh(legGeo, m.chrome);
            leg.position.set(x, y, z);
            leg.castShadow = true;
            group.add(leg);
        }

        return group;
    }

    createArcadeMachine() {
        // Try GLB first
        const glb = this.cloneModel('arcadeMachine', 55);
        if (glb) return glb;

        // Procedural fallback - simple arcade cabinet shape
        const group = new THREE.Group();
        const m = this.materials;

        // Main cabinet body
        const body = new THREE.Mesh(new THREE.BoxGeometry(20, 50, 24), m.blackPlastic);
        body.position.y = 25;
        body.castShadow = true;
        group.add(body);

        // Screen area
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), m.screenGlow);
        screen.position.set(0, 35, 12.5);
        group.add(screen);

        // Control panel
        const panel = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 10), m.blackMetal);
        panel.position.set(0, 20, 15);
        panel.rotation.x = -0.3;
        group.add(panel);

        return group;
    }

    buildCart() {
        this.cartGroup = new THREE.Group();

        // Try to use loaded GLB model, fall back to procedural
        if (this.loadedModels.cart) {
            this.buildCartFromGLB();
        } else {
            this.buildProceduralCart();
        }

        // Add Sun Chips bags to cargo bed (works with either version)
        this.addChipBagsToCargo();

        this.scene.add(this.cartGroup);
    }

    buildCartFromGLB() {
        // Clone the loaded model so we can use it independently
        const cartModel = this.loadedModels.cart.clone();

        // First, compute unscaled bounding box to see actual model size
        const unscaledBox = new THREE.Box3().setFromObject(cartModel);
        const unscaledSize = unscaledBox.getSize(new THREE.Vector3());
        console.log('Cart GLB unscaled size:', unscaledSize);

        // Kenney models are typically 1 unit = 1 meter scale
        // Our game uses larger units - physics collision box is 70 units long (COLLISION_FRONT * 2)
        // Scale visual to roughly match physics
        const targetLength = 60; // Slightly smaller than physics for visual clarity
        const scale = targetLength / Math.max(unscaledSize.x, unscaledSize.z);
        console.log('Calculated scale:', scale);
        cartModel.scale.set(scale, scale, scale);

        // Enable shadows on all meshes
        cartModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Compute bounding box AFTER scaling to get final size
        const box = new THREE.Box3().setFromObject(cartModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        console.log('Cart GLB scaled size:', size);
        console.log('Cart GLB center:', center);

        // Center the model horizontally and position so wheels touch ground (y=0)
        cartModel.position.x = -center.x;
        cartModel.position.y = -box.min.y;
        cartModel.position.z = -center.z;

        // Rotate to face negative Z (our cart's forward direction)
        // The model was facing backwards, so remove the PI rotation
        // Our game: heading 0 = east (+X), cart front should face -Z in local space
        cartModel.rotation.y = 0;

        this.cartGroup.add(cartModel);

        // Store reference for adding chip bags at correct height
        this.cartModelHeight = size.y;
        this.cartModelLength = Math.max(size.x, size.z); // Use longest dimension as length
    }

    buildProceduralCart() {
        const m = this.materials;

        // Main body - white plastic
        const body = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 36), m.whitePlastic);
        body.position.y = 12;
        body.castShadow = true;
        this.cartGroup.add(body);

        // Front grille/bumper - chrome
        const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 2), m.chrome);
        frontBumper.position.set(0, 6, -18);
        this.cartGroup.add(frontBumper);

        // Rear bumper - chrome
        const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 2), m.chrome);
        rearBumper.position.set(0, 6, 18);
        this.cartGroup.add(rearBumper);

        // Roof - green
        const roofTop = new THREE.Mesh(new THREE.BoxGeometry(24, 2, 34), m.golfCartGreen);
        roofTop.position.y = 30;
        roofTop.castShadow = true;
        this.cartGroup.add(roofTop);

        // Roof support posts - chrome
        const postGeo = new THREE.CylinderGeometry(1, 1, 12, 8);
        const postPositions = [
            [-10, 24, -14], [10, 24, -14],
            [-10, 24, 14], [10, 24, 14]
        ];
        for (const [px, py, pz] of postPositions) {
            const post = new THREE.Mesh(postGeo, m.chrome);
            post.position.set(px, py, pz);
            this.cartGroup.add(post);
        }

        // Windshield frame - chrome
        const windshieldFrame = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 1), m.chrome);
        windshieldFrame.position.set(0, 25, -14);
        this.cartGroup.add(windshieldFrame);

        // Windshield glass
        const windshieldGeo = new THREE.PlaneGeometry(18, 12);
        const windshield = new THREE.Mesh(windshieldGeo, m.clearGlass);
        windshield.position.set(0, 22, -14.5);
        windshield.rotation.x = 0.15; // Slight tilt
        this.cartGroup.add(windshield);

        // Seats - fabric bench seat
        const seatGeo = new THREE.BoxGeometry(18, 4, 12);
        const seat = new THREE.Mesh(seatGeo, m.seatFabric);
        seat.position.set(0, 17, 2);
        seat.castShadow = true;
        this.cartGroup.add(seat);

        // Seat back
        const seatBackGeo = new THREE.BoxGeometry(18, 12, 3);
        const seatBack = new THREE.Mesh(seatBackGeo, m.seatFabric);
        seatBack.position.set(0, 23, 9);
        seatBack.castShadow = true;
        this.cartGroup.add(seatBack);

        // Steering column
        const steeringColumn = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 8, 8),
            m.blackPlastic
        );
        steeringColumn.position.set(0, 20, -8);
        steeringColumn.rotation.x = -0.5; // Angled toward driver
        this.cartGroup.add(steeringColumn);

        // Steering wheel - torus
        const steeringWheelGeo = new THREE.TorusGeometry(4, 0.5, 8, 16);
        const steeringWheel = new THREE.Mesh(steeringWheelGeo, m.blackPlastic);
        steeringWheel.position.set(0, 23, -10);
        steeringWheel.rotation.x = -0.5;
        this.cartGroup.add(steeringWheel);

        // Dashboard
        const dashboard = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 4), m.blackPlastic);
        dashboard.position.set(0, 17, -12);
        this.cartGroup.add(dashboard);

        // Wheels - black rubber with chrome hubcaps
        const wheelGeo = new THREE.CylinderGeometry(5, 5, 3, 12);
        const hubcapGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.5, 12);
        const wheelPositions = [
            [-13, 5, -12], [13, 5, -12],
            [-13, 5, 12], [13, 5, 12]
        ];
        for (const [wx, wy, wz] of wheelPositions) {
            const wheel = new THREE.Mesh(wheelGeo, m.blackPlastic);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wx, wy, wz);
            wheel.castShadow = true;
            this.cartGroup.add(wheel);

            // Hubcap
            const hubcap = new THREE.Mesh(hubcapGeo, m.chrome);
            hubcap.rotation.z = Math.PI / 2;
            hubcap.position.set(wx > 0 ? wx + 1.5 : wx - 1.5, wy, wz);
            this.cartGroup.add(hubcap);
        }

        // Tail lights
        const tailGeo = new THREE.BoxGeometry(3, 3, 1);
        const tailL = new THREE.Mesh(tailGeo, m.redTaillight);
        tailL.position.set(-9, 12, 18.5);
        this.cartGroup.add(tailL);
        const tailR = new THREE.Mesh(tailGeo, m.redTaillight);
        tailR.position.set(9, 12, 18.5);
        this.cartGroup.add(tailR);

        // Headlights
        const headGeo = new THREE.CylinderGeometry(2, 2, 1, 12);
        const headL = new THREE.Mesh(headGeo, m.headlightGlow);
        headL.rotation.x = Math.PI / 2;
        headL.position.set(-8, 10, -18.5);
        this.cartGroup.add(headL);
        const headR = new THREE.Mesh(headGeo, m.headlightGlow);
        headR.rotation.x = Math.PI / 2;
        headR.position.set(8, 10, -18.5);
        this.cartGroup.add(headR);

        // Headlight chrome bezels
        const bezelGeo = new THREE.TorusGeometry(2.2, 0.3, 8, 16);
        const bezelL = new THREE.Mesh(bezelGeo, m.chrome);
        bezelL.rotation.y = Math.PI / 2;
        bezelL.position.set(-8, 10, -18.6);
        this.cartGroup.add(bezelL);
        const bezelR = new THREE.Mesh(bezelGeo, m.chrome);
        bezelR.rotation.y = Math.PI / 2;
        bezelR.position.set(8, 10, -18.6);
        this.cartGroup.add(bezelR);

        // Cargo bed (back of cart)
        const cargoBed = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 10), m.blackPlastic);
        cargoBed.position.set(0, 12, 14);
        this.cartGroup.add(cargoBed);

        // Store model dimensions for chip bag placement
        this.cartModelHeight = 30;
        this.cartModelLength = 36;
    }

    createSunChipsBag(scale = 1) {
        const group = new THREE.Group();

        // Main bag body - golden yellow
        const bagGeo = new THREE.BoxGeometry(4 * scale, 6 * scale, 2 * scale);
        const bagMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.3,
            roughness: 0.4
        });
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.castShadow = true;
        group.add(bag);

        // Top crimp
        const crimpGeo = new THREE.BoxGeometry(4 * scale, 0.5 * scale, 1.8 * scale);
        const crimpMat = new THREE.MeshStandardMaterial({
            color: 0xCC9900,
            metalness: 0.2,
            roughness: 0.5
        });
        const crimp = new THREE.Mesh(crimpGeo, crimpMat);
        crimp.position.y = 3.25 * scale;
        group.add(crimp);

        // Green stripe accent
        const stripeGeo = new THREE.BoxGeometry(4.1 * scale, 1.5 * scale, 0.1 * scale);
        const stripeMat = new THREE.MeshStandardMaterial({
            color: 0x228B22,
            metalness: 0.0,
            roughness: 0.6
        });
        const stripeFront = new THREE.Mesh(stripeGeo, stripeMat);
        stripeFront.position.set(0, 0, 1.05 * scale);
        group.add(stripeFront);
        const stripeBack = new THREE.Mesh(stripeGeo, stripeMat);
        stripeBack.position.set(0, 0, -1.05 * scale);
        group.add(stripeBack);

        return group;
    }

    addChipBagsToCargo() {
        // Adjust bag positions based on whether using GLB or procedural cart
        // GLB cart may have different dimensions
        // Position bags at the BACK of the cart (NEGATIVE Z = rear, since cart faces -Z)
        const cargoHeight = this.loadedModels.cart ? (this.cartModelHeight * 0.45) : 14;
        const cargoZ = this.loadedModels.cart ? -(this.cartModelLength * 0.5) : -16; // Negative = back of cart

        // Lots of scattered Sun Chips bags piled up in the back!
        const bagPositions = [
            // Bottom layer - spread across the back
            { x: -5, y: cargoHeight, z: cargoZ, rot: 0.2, scale: 1 },
            { x: 0, y: cargoHeight, z: cargoZ - 1, rot: -0.15, scale: 1.05 },
            { x: 5, y: cargoHeight, z: cargoZ, rot: 0.35, scale: 0.95 },
            { x: -3, y: cargoHeight, z: cargoZ - 3, rot: -0.4, scale: 1 },
            { x: 3, y: cargoHeight, z: cargoZ - 3, rot: 0.5, scale: 0.9 },
            { x: 0, y: cargoHeight, z: cargoZ - 4, rot: 0.1, scale: 1.1 },
            // Second layer - stacked on top
            { x: -2, y: cargoHeight + 4, z: cargoZ - 1, rot: -0.3, scale: 0.9 },
            { x: 2, y: cargoHeight + 4, z: cargoZ - 2, rot: 0.4, scale: 0.85 },
            { x: 0, y: cargoHeight + 4, z: cargoZ - 3, rot: -0.2, scale: 0.95 },
            { x: -4, y: cargoHeight + 4, z: cargoZ - 2, rot: 0.6, scale: 0.8 },
            { x: 4, y: cargoHeight + 4, z: cargoZ - 1, rot: -0.5, scale: 0.88 },
            // Third layer - top of the pile
            { x: -1, y: cargoHeight + 7, z: cargoZ - 2, rot: 0.25, scale: 0.85 },
            { x: 1.5, y: cargoHeight + 7, z: cargoZ - 2.5, rot: -0.35, scale: 0.8 },
            { x: 0, y: cargoHeight + 9, z: cargoZ - 2, rot: 0.15, scale: 0.75 },
            // A few scattered toward the middle
            { x: -6, y: cargoHeight, z: cargoZ + 2, rot: 0.7, scale: 0.9 },
            { x: 6, y: cargoHeight, z: cargoZ + 1, rot: -0.6, scale: 0.85 }
        ];

        for (const pos of bagPositions) {
            const bag = this.createSunChipsBag(pos.scale);
            bag.position.set(pos.x, pos.y, pos.z);
            bag.rotation.y = pos.rot;
            bag.rotation.x = (Math.random() - 0.5) * 0.3;
            bag.rotation.z = (Math.random() - 0.5) * 0.2;
            this.cartGroup.add(bag);
        }
    }

    updateCamera(gameCamera) {
        // Camera sits behind and above the cart
        const camX = gameCamera.x - Math.cos(gameCamera.angle) * this.FOLLOW_DISTANCE;
        const camZ = gameCamera.y - Math.sin(gameCamera.angle) * this.FOLLOW_DISTANCE;

        this.camera.position.set(camX, this.CAMERA_HEIGHT, camZ);

        // Look at point ahead of camera
        const lookX = gameCamera.x + Math.cos(gameCamera.angle) * this.LOOK_AHEAD;
        const lookZ = gameCamera.y + Math.sin(gameCamera.angle) * this.LOOK_AHEAD;
        this.camera.lookAt(lookX, 15, lookZ);

        // Apply screen shake
        if (this.screenShake.active) {
            this.camera.position.x += (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.y += (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.z += (Math.random() - 0.5) * this.screenShake.intensity;
        }
    }

    updateParticles(dt) {
        // Screen shake decay
        if (this.screenShake.active) {
            this.screenShake.timer -= dt;
            if (this.screenShake.timer <= 0) {
                this.screenShake.active = false;
                this.screenShake.intensity = 0;
            }
        }

        // Update particles, remove dead ones
        this.particles = this.particles.filter(p => {
            const alive = p.update(dt);
            if (!alive) {
                this.scene.remove(p.mesh);
                // Safely dispose - handle both Mesh and Group objects
                if (p.mesh.geometry) {
                    p.mesh.geometry.dispose();
                }
                if (p.mesh.material) {
                    p.mesh.material.dispose();
                }
                // For groups (like chip bags), dispose all children
                if (p.mesh.isGroup) {
                    p.mesh.traverse((child) => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) child.material.dispose();
                        }
                    });
                }
            }
            return alive;
        });
    }

    triggerCollisionEffect(worldX, worldY) {
        // Screen shake
        this.screenShake = { active: true, intensity: 3, timer: 0.25 };

        // Spawn paper particles
        for (let i = 0; i < 5; i++) {
            const geo = new THREE.PlaneGeometry(
                3 + Math.random() * 4,
                4 + Math.random() * 5
            );
            const mat = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.3 ? 0xFAFAFA : 0xFFF8DC,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1
            });
            const paper = new THREE.Mesh(geo, mat);
            paper.position.set(worldX, 15 + Math.random() * 20, worldY);
            paper.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            this.scene.add(paper);

            const velocity = {
                x: (Math.random() - 0.5) * 100,
                y: 30 + Math.random() * 40,
                z: (Math.random() - 0.5) * 100
            };

            // Add rotation speed for flutter effect
            const rotSpeed = {
                x: (Math.random() - 0.5) * 8,
                y: (Math.random() - 0.5) * 4,
                z: (Math.random() - 0.5) * 6
            };

            this.particles.push(new Particle(paper, velocity, 1.5, rotSpeed));
        }

        // Spawn Sun Chips bag particles
        for (let i = 0; i < 3; i++) {
            const chipBag = this.createSunChipsBag(0.6 + Math.random() * 0.3);
            chipBag.position.set(
                worldX + (Math.random() - 0.5) * 10,
                18 + Math.random() * 15,
                worldY + (Math.random() - 0.5) * 10
            );
            chipBag.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            this.scene.add(chipBag);

            const velocity = {
                x: (Math.random() - 0.5) * 80,
                y: 25 + Math.random() * 35,
                z: (Math.random() - 0.5) * 80
            };

            const rotSpeed = {
                x: (Math.random() - 0.5) * 6,
                y: (Math.random() - 0.5) * 8,
                z: (Math.random() - 0.5) * 4
            };

            // Create a material for fading (applied to the group)
            const bagParticle = new ChipBagParticle(chipBag, velocity, 2.0, rotSpeed);
            this.particles.push(bagParticle);
        }

        // Cap particle count
        while (this.particles.length > 50) {
            const oldest = this.particles.shift();
            this.scene.remove(oldest.mesh);
            if (oldest.mesh.geometry) {
                oldest.mesh.geometry.dispose();
            }
            if (oldest.mesh.material) {
                oldest.mesh.material.dispose();
            }
        }
    }

    triggerSkidEffect(worldX, worldY, heading) {
        const geo = new THREE.SphereGeometry(1.5, 4, 4);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x8B8878,
            transparent: true,
            opacity: 0.5
        });
        const puff = new THREE.Mesh(geo, mat);

        // Position behind vehicle
        const behindX = worldX - Math.cos(heading) * 20;
        const behindZ = worldY - Math.sin(heading) * 20;
        puff.position.set(
            behindX + (Math.random() - 0.5) * 10,
            2,
            behindZ + (Math.random() - 0.5) * 10
        );

        this.scene.add(puff);

        const velocity = { x: 0, y: 5 + Math.random() * 5, z: 0 };
        this.particles.push(new Particle(puff, velocity, 0.6));
    }

    update(vehicle, gameCamera, dt) {
        // Sync cart position and rotation
        this.cartGroup.position.x = vehicle.x;
        this.cartGroup.position.z = vehicle.y;
        // Game heading: 0 = east (positive X), PI/2 = south (positive Z)
        // Cart model: front faces negative Z
        // Offset by PI/2 to align correctly
        this.cartGroup.rotation.y = -vehicle.heading + Math.PI / 2;

        // Cart lean on steering
        const targetLean = -vehicle.steerState * 0.06;
        this.cartGroup.rotation.z += (targetLean - this.cartGroup.rotation.z) * 0.15;

        // Update 3D camera
        this.updateCamera(gameCamera);

        // Update particles
        this.updateParticles(dt);

        // Skid effect when turning hard at speed
        if (Math.abs(vehicle.steerState) > 0 && Math.abs(vehicle.speed) > 100) {
            if (Math.random() < 0.3) {
                this.triggerSkidEffect(vehicle.x, vehicle.y, vehicle.heading);
            }
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
