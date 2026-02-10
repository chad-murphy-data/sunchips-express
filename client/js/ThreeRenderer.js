// ThreeRenderer.js - Three.js based 3D renderer for the office environment

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { DeliveryAnimator } from './DeliveryAnimator.js';

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
        this.fbxLoader = new FBXLoader();
        this.textureLoader = new THREE.TextureLoader();

        // Delivery animation system
        this.deliveryAnimator = new DeliveryAnimator(this.scene);

        // Camera wall-avoidance
        this.cameraRaycaster = new THREE.Raycaster();
        this.wallMeshes = []; // populated during buildTiledWalls

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
            // Racing elements (just what we use)
            flagCheckers: 'assets/racing/flagCheckers.glb',
            pylon: 'assets/racing/pylon.glb',
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

        // Load animated characters for delivery sequence
        await this.deliveryAnimator.loadCharacter(this.fbxLoader, this.textureLoader);

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
        // Store track reference for camera wall avoidance
        this.track = track;

        // Load GLB assets first
        await this.loadAssets();

        this.buildFloor(track);
        this.buildCeiling(track);
        this.buildLighting();
        this.buildTiledWalls(track);
        this.buildRacingElements(track);
        this.buildSnackStations(track);
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

        // Create large linoleum floor (entire map — now rectangular)
        const mapWidth = track.width * ts;
        const mapHeight = track.height * ts;
        const linoleumGeo = new THREE.PlaneGeometry(mapWidth, mapHeight);
        const linoleumMat = new THREE.MeshStandardMaterial({
            map: linoleumTexture,
            roughness: 0.8
        });
        const linoleum = new THREE.Mesh(linoleumGeo, linoleumMat);
        linoleum.rotation.x = -Math.PI / 2;
        linoleum.position.set(mapWidth / 2, -0.1, mapHeight / 2);
        linoleum.receiveShadow = true;
        this.scene.add(linoleum);

        // Helper to create a carpet section
        const createCarpetSection = (x1, z1, x2, z2) => {
            const width = Math.abs(x2 - x1);
            const depth = Math.abs(z2 - z1);

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

        // Carpet sections: one per road region
        for (const region of track.roadRegions) {
            const x1 = region.x1 * ts;
            const z1 = region.y1 * ts;
            const x2 = (region.x2 + 1) * ts;
            const z2 = (region.y2 + 1) * ts;
            createCarpetSection(x1, z1, x2, z2);
        }

        // Floor tape lines (yellow center lines on carpet)
        const tapeMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.5
        });

        const createTapeLine = (x1, z1, x2, z2, tapeWidth = 4) => {
            const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
            if (length < 1) return;
            const geo = new THREE.PlaneGeometry(tapeWidth, length);
            const tape = new THREE.Mesh(geo, tapeMat);
            tape.rotation.x = -Math.PI / 2;
            tape.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);

            if (Math.abs(x2 - x1) > Math.abs(z2 - z1)) {
                tape.rotation.z = Math.PI / 2;
            }

            this.scene.add(tape);
        };

        // Center tape line per road region
        for (const region of track.roadRegions) {
            const x1 = region.x1 * ts;
            const z1 = region.y1 * ts;
            const x2 = (region.x2 + 1) * ts;
            const z2 = (region.y2 + 1) * ts;
            const cx = (x1 + x2) / 2;
            const cz = (z1 + z2) / 2;
            const rw = x2 - x1;
            const rh = z2 - z1;

            if (rw >= rh) {
                // Horizontal region — horizontal center line
                createTapeLine(x1 + ts * 0.5, cz, x2 - ts * 0.5, cz);
            } else {
                // Vertical region — vertical center line
                createTapeLine(cx, z1 + ts * 0.5, cx, z2 - ts * 0.5);
            }
        }
    }

    buildCeiling(track) {
        const ts = track.tileSize;
        const mapWidth = track.width * ts;
        const mapHeight = track.height * ts;

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
        ceilingTexture.repeat.set(mapWidth / 200, mapHeight / 200);

        // Ceiling plane (rectangular)
        const ceilingGeo = new THREE.PlaneGeometry(mapWidth, mapHeight);
        const ceilingMat = new THREE.MeshStandardMaterial({
            map: ceilingTexture,
            side: THREE.BackSide,
            roughness: 0.9
        });
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(mapWidth / 2, this.CEILING_HEIGHT, mapHeight / 2);
        this.scene.add(ceiling);

        // Fluorescent light panels — place over each road region
        const lightPanelGeo = new THREE.PlaneGeometry(40, 12);
        const lightPanelMat = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            emissive: 0xFFFFF0,
            emissiveIntensity: 0.8,
            side: THREE.BackSide
        });

        const spacing = 300;
        for (const region of track.roadRegions) {
            const startX = region.x1 * ts;
            const endX = (region.x2 + 1) * ts;
            const startZ = region.y1 * ts;
            const endZ = (region.y2 + 1) * ts;

            for (let x = startX + spacing / 2; x < endX; x += spacing) {
                for (let z = startZ + spacing / 2; z < endZ; z += spacing) {
                    const panel = new THREE.Mesh(lightPanelGeo, lightPanelMat);
                    panel.position.set(x, this.CEILING_HEIGHT - 0.5, z);
                    panel.rotation.x = Math.PI / 2;
                    this.scene.add(panel);
                }
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
        const wallOffset = -15;

        // Get merged wall edges from the tile map
        const edges = track.getWallEdges();

        const wallRuns = [];
        for (const edge of edges) {
            // Determine wall rotation from normal direction
            // Wall model faces local +Z; rotate so visible face points toward road
            let rotY;
            if (edge.normalY === -1) rotY = 0;            // Top edge, faces south into road
            else if (edge.normalY === 1) rotY = Math.PI;   // Bottom edge, faces north
            else if (edge.normalX === -1) rotY = Math.PI / 2;  // Left edge, faces right
            else if (edge.normalX === 1) rotY = -Math.PI / 2;  // Right edge, faces left
            else rotY = 0;

            // Apply wall offset (push wall slightly toward road)
            const offX = -edge.normalX * wallOffset;
            const offZ = -edge.normalY * wallOffset;

            wallRuns.push({
                start: { x: edge.x1 + offX, z: edge.y1 + offZ },
                end: { x: edge.x2 + offX, z: edge.y2 + offZ },
                rotY: rotY,
                normalX: edge.normalX,
                normalY: edge.normalY,
                label: `wall_${edge.x1}_${edge.y1}`
            });
        }

        this._wallRuns = wallRuns;
        return wallRuns;
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
        const tileWidth = Math.max(wallInfo.width, wallInfo.depth) * scaleFactor;
        console.log(`Wall tiling: scaleFactor=${scaleFactor.toFixed(2)}, tileWidth=${tileWidth.toFixed(1)}, ${wallRuns.length} wall runs`);

        for (const run of wallRuns) {
            const dx = run.end.x - run.start.x;
            const dz = run.end.z - run.start.z;
            const runLength = Math.sqrt(dx * dx + dz * dz);
            if (runLength < 1) continue;

            const numTiles = Math.max(1, Math.floor(runLength / tileWidth));
            const dirX = dx / runLength;
            const dirZ = dz / runLength;
            const actualStride = runLength / numTiles;

            for (let i = 0; i < numTiles; i++) {
                const modelKey = this.pickWallVariant(i);
                const model = this.cloneModel(modelKey, this.WALL_HEIGHT);

                if (!model) {
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

        // Place corner pieces at wall junctions
        this.placeCornerPieces();
    }

    placeCornerPieces() {
        const runs = this._wallRuns;
        if (!runs || runs.length === 0) return;

        // Collect all run endpoints with their orientation info
        const tolerance = 20;
        const cornerMap = new Map();

        for (const run of runs) {
            for (const point of [run.start, run.end]) {
                const key = `${Math.round(point.x / tolerance)}_${Math.round(point.z / tolerance)}`;
                if (!cornerMap.has(key)) {
                    cornerMap.set(key, { x: point.x, z: point.z, rotYs: new Set() });
                }
                cornerMap.get(key).rotYs.add(run.rotY);
            }
        }

        // Place corners where 2+ perpendicular wall runs meet
        for (const corner of cornerMap.values()) {
            if (corner.rotYs.size < 2) continue;

            const piece = this.cloneModel('wallCorner', this.WALL_HEIGHT);
            if (piece) {
                piece.position.set(corner.x, 0, corner.z);
                // Use one of the meeting wall rotations
                piece.rotation.y = corner.rotYs.values().next().value;
                this.scene.add(piece);
            }
        }
    }

    buildRacingElements(track) {
        const ts = track.tileSize;
        const startPos = track.getStartPosition();

        // Find road region containing start position to get local road width
        let localRoadWidth = 4 * ts; // default
        for (const region of track.roadRegions) {
            const px = startPos.x / ts;
            const py = startPos.y / ts;
            if (px >= region.x1 && px <= region.x2 + 1 && py >= region.y1 && py <= region.y2 + 1) {
                // Start heading is PI (west), so road runs east-west
                // Road width is the north-south span of this region
                localRoadWidth = (region.y2 - region.y1 + 1) * ts;
                break;
            }
        }

        // === Start/Finish line — flags in a straight line across the road ===
        const roadHalfWidth = localRoadWidth / 2;
        const roadCenterZ = startPos.y;
        const numFlags = 5;

        for (let i = 0; i < numFlags; i++) {
            const t = (i / (numFlags - 1)) - 0.5;
            const flagZ = roadCenterZ + t * roadHalfWidth * 1.8;

            const flag = this.cloneModel('flagCheckers', 40);
            if (flag) {
                flag.position.set(startPos.x, 0, flagZ);
                flag.rotation.y = Math.PI / 2;
                this.scene.add(flag);
            }
        }

        // === Pylons at a subset of wall run endpoints ===
        if (this._wallRuns) {
            const cornerSet = new Set();
            for (const run of this._wallRuns) {
                cornerSet.add(`${Math.round(run.start.x)}_${Math.round(run.start.z)}`);
                cornerSet.add(`${Math.round(run.end.x)}_${Math.round(run.end.z)}`);
            }

            let count = 0;
            for (const posStr of cornerSet) {
                count++;
                if (count % 4 !== 0) continue; // Place at every 4th corner
                const [x, z] = posStr.split('_').map(Number);
                for (let j = 0; j < 2; j++) {
                    const pylon = this.cloneModel('pylon', 15);
                    if (pylon) {
                        const seed = x * 7 + z * 13 + j * 31;
                        const px = ((seed % 30) - 15);
                        const pz = (((seed * 3) % 30) - 15);
                        pylon.position.set(x + px, 0, z + pz);
                        this.scene.add(pylon);
                    }
                }
            }
        }
    }

    buildSnackStations(track) {
        if (!track.snackStations) return;

        this.stationRings = [];
        this.stationBags = []; // Array of arrays: chip bags per station for fill animation
        this.stationVMs = []; // Vending machine groups for reference

        // Grid layout for chip bags on the vending machine:
        // 6 columns x 5 rows = 30 bags in grid, plus overflow bags on top/sides
        // Revealed progressively — overly stuffed look!
        const COLS = 6;
        const ROWS = 5;
        const BAG_SPACING_X = 4;   // tight horizontal spacing
        const BAG_SPACING_Y = 5.5; // tight vertical spacing
        const BAG_START_Y = 12;    // start low to fill the whole face
        const BAG_FRONT_Z = 12;    // how far in front of the vending machine

        for (let s = 0; s < track.snackStations.length; s++) {
            const station = track.snackStations[s];

            // Vending machine model
            const vm = this.cloneModel('vendingMachine', 45);
            if (vm) {
                vm.position.set(station.x, 0, station.y);
                vm.rotation.y = Math.PI / 2;
                this.scene.add(vm);
            }
            this.stationVMs.push(vm);

            // Create chip bags on BOTH sides of the vending machine (initially invisible)
            // bags array stores pairs: [front0, back0, front1, back1, ...]
            // so showing bag index i also shows its paired twin
            const bags = [];
            const vmRotY = Math.PI / 2; // same rotation as vending machine
            const fwdX = Math.sin(vmRotY);  // forward direction of the VM front face
            const fwdZ = Math.cos(vmRotY);
            const rightX = Math.cos(vmRotY);
            const rightZ = -Math.sin(vmRotY);

            // Helper to create a bag pair (front + back of vending machine)
            const makeBagPair = (lateralOffset, heightOffset, bagScale = 0.8) => {
                const frontBag = this.createSunChipsBag(bagScale);
                frontBag.visible = false;
                frontBag.position.set(
                    station.x + fwdX * BAG_FRONT_Z + rightX * lateralOffset,
                    heightOffset,
                    station.y + fwdZ * BAG_FRONT_Z + rightZ * lateralOffset
                );
                frontBag.rotation.y = vmRotY;
                frontBag.rotation.x = (Math.random() - 0.5) * 0.2;
                frontBag.rotation.z = (Math.random() - 0.5) * 0.15;
                this.scene.add(frontBag);

                const backBag = this.createSunChipsBag(bagScale);
                backBag.visible = false;
                backBag.position.set(
                    station.x - fwdX * BAG_FRONT_Z + rightX * lateralOffset,
                    heightOffset,
                    station.y - fwdZ * BAG_FRONT_Z + rightZ * lateralOffset
                );
                backBag.rotation.y = vmRotY + Math.PI;
                backBag.rotation.x = (Math.random() - 0.5) * 0.2;
                backBag.rotation.z = (Math.random() - 0.5) * 0.15;
                this.scene.add(backBag);

                bags.push({ front: frontBag, back: backBag });
            };

            // Main grid: 6 cols × 5 rows = 30 bags filling the full face
            for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                    const lateralOffset = (col - (COLS - 1) / 2) * BAG_SPACING_X;
                    const heightOffset = BAG_START_Y + row * BAG_SPACING_Y;
                    makeBagPair(lateralOffset, heightOffset, 0.8);
                }
            }

            // Overflow bags on TOP of the machine (stacked up, spilling over)
            const topY = BAG_START_Y + ROWS * BAG_SPACING_Y;
            for (let i = 0; i < 5; i++) {
                const lat = (Math.random() - 0.5) * (COLS * BAG_SPACING_X);
                const h = topY + Math.random() * 8;
                makeBagPair(lat, h, 0.7 + Math.random() * 0.25);
            }

            // Extra bags jutting out further in front / back (depth overflow)
            for (let i = 0; i < 4; i++) {
                const lat = (Math.random() - 0.5) * (COLS * BAG_SPACING_X * 0.8);
                const h = BAG_START_Y + Math.random() * (ROWS * BAG_SPACING_Y);
                const extraFront = this.createSunChipsBag(0.7 + Math.random() * 0.2);
                extraFront.visible = false;
                extraFront.position.set(
                    station.x + fwdX * (BAG_FRONT_Z + 3 + Math.random() * 3) + rightX * lat,
                    h,
                    station.y + fwdZ * (BAG_FRONT_Z + 3 + Math.random() * 3) + rightZ * lat
                );
                extraFront.rotation.y = vmRotY + (Math.random() - 0.5) * 0.4;
                extraFront.rotation.x = (Math.random() - 0.5) * 0.3;
                extraFront.rotation.z = (Math.random() - 0.5) * 0.3;
                this.scene.add(extraFront);

                const extraBack = this.createSunChipsBag(0.7 + Math.random() * 0.2);
                extraBack.visible = false;
                extraBack.position.set(
                    station.x - fwdX * (BAG_FRONT_Z + 3 + Math.random() * 3) + rightX * lat,
                    h,
                    station.y - fwdZ * (BAG_FRONT_Z + 3 + Math.random() * 3) + rightZ * lat
                );
                extraBack.rotation.y = vmRotY + Math.PI + (Math.random() - 0.5) * 0.4;
                extraBack.rotation.x = (Math.random() - 0.5) * 0.3;
                extraBack.rotation.z = (Math.random() - 0.5) * 0.3;
                this.scene.add(extraBack);

                bags.push({ front: extraFront, back: extraBack });
            }

            // Bags fallen on the FLOOR around the base (overly full, spilling out!)
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 8;
                const floorFront = this.createSunChipsBag(0.65 + Math.random() * 0.2);
                floorFront.visible = false;
                floorFront.position.set(
                    station.x + Math.cos(angle) * dist,
                    1 + Math.random() * 3, // on or near the floor
                    station.y + Math.sin(angle) * dist
                );
                floorFront.rotation.x = Math.PI * 0.4 + (Math.random() - 0.5) * 0.3; // lying mostly flat
                floorFront.rotation.y = Math.random() * Math.PI * 2;
                floorFront.rotation.z = (Math.random() - 0.5) * 0.5;
                this.scene.add(floorFront);

                // Floor bags only have a front (no mirrored back needed)
                bags.push({ front: floorFront, back: floorFront }); // same ref, fine for visibility toggle
            }

            this.stationBags.push(bags);

            // Yellow ring on the floor (delivery zone indicator)
            const ringGeo = new THREE.RingGeometry(station.radius * 0.7, station.radius, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xFFD700,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2; // Lay flat on floor
            ring.position.set(station.x, 0.5, station.y); // Just above floor
            this.scene.add(ring);
            this.stationRings.push(ring);
        }
    }

    // Update chip bag fill level on a station (0-100 progress)
    // stationIndex: which station, progress: 0-100
    updateStationFill(stationIndex, progress) {
        if (!this.stationBags || stationIndex < 0 || stationIndex >= this.stationBags.length) return;

        const bags = this.stationBags[stationIndex];
        const totalBags = bags.length;

        // Each bag pair appears at (index+1) * (100/totalBags) percent
        for (let i = 0; i < totalBags; i++) {
            const threshold = ((i + 1) / totalBags) * 100;
            const shouldShow = progress >= threshold;

            const pair = bags[i];
            if (shouldShow && !pair.front.visible) {
                // Show both front and back bag simultaneously
                for (const bag of [pair.front, pair.back]) {
                    bag.visible = true;
                    bag.userData.popTimer = 0.2;
                    bag.userData.baseScale = { x: bag.scale.x, y: bag.scale.y, z: bag.scale.z };
                    bag.scale.set(0.01, 0.01, 0.01);
                }
            }
        }
    }

    // Reset all bags on a station to invisible (for new lap)
    resetStationFill(stationIndex) {
        if (!this.stationBags || stationIndex < 0 || stationIndex >= this.stationBags.length) return;
        for (const pair of this.stationBags[stationIndex]) {
            pair.front.visible = false;
            pair.back.visible = false;
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

        // Attach animated characters to the cart as seated passengers
        this.deliveryAnimator.attachToCart(this.cartGroup);
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
        let camX = gameCamera.x - Math.cos(gameCamera.angle) * this.FOLLOW_DISTANCE;
        let camZ = gameCamera.y - Math.sin(gameCamera.angle) * this.FOLLOW_DISTANCE;

        // Pull camera forward if it would be behind a wall
        if (this.track) {
            const ts = this.track.tileSize;
            const tileX = Math.floor(camX / ts);
            const tileZ = Math.floor(camZ / ts);

            // Check if the camera tile is NOT a road tile
            if (!this.track._isRoad(tileX, tileZ)) {
                // Binary search along the ray from cart to desired camera position
                // to find the furthest point that's still on road
                const cartX = gameCamera.x;
                const cartZ = gameCamera.y;
                let lo = 0;  // t=0 is cart position (always road)
                let hi = 1;  // t=1 is desired camera position (in wall)

                for (let step = 0; step < 10; step++) {
                    const midT = (lo + hi) / 2;
                    const testX = cartX + (camX - cartX) * midT;
                    const testZ = cartZ + (camZ - cartZ) * midT;
                    const testTileX = Math.floor(testX / ts);
                    const testTileZ = Math.floor(testZ / ts);

                    if (this.track._isRoad(testTileX, testTileZ)) {
                        lo = midT;  // still safe, try further out
                    } else {
                        hi = midT;  // in wall, pull back
                    }
                }
                const bestT = lo;

                // Pull camera to the best road position (with a small margin)
                const safeT = Math.max(0, bestT - 0.05);
                camX = cartX + (camX - cartX) * safeT;
                camZ = cartZ + (camZ - cartZ) * safeT;
            }
        }

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

        // Pulse snack station rings
        if (this.stationRings) {
            const time = performance.now() / 1000;
            for (const ring of this.stationRings) {
                ring.material.opacity = 0.25 + 0.15 * Math.sin(time * 2);
            }
        }

        // Animate chip bag pop-in on stations
        if (this.stationBags) {
            for (const bags of this.stationBags) {
                for (const pair of bags) {
                    for (const bag of [pair.front, pair.back]) {
                        if (bag.visible && bag.userData.popTimer > 0) {
                            bag.userData.popTimer -= dt;
                            const t = 1 - Math.max(0, bag.userData.popTimer) / 0.2; // 0→1
                            // Elastic ease-out for a satisfying pop
                            const ease = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5) : 1;
                            const bs = bag.userData.baseScale;
                            bag.scale.set(bs.x * ease, bs.y * ease, bs.z * ease);
                        }
                    }
                }
            }
        }

        // Skid effect when turning hard at speed
        if (Math.abs(vehicle.steerState) > 0 && Math.abs(vehicle.speed) > 100) {
            if (Math.random() < 0.3) {
                this.triggerSkidEffect(vehicle.x, vehicle.y, vehicle.heading);
            }
        }

        // Update delivery animation (always tick — handles seated idle animation too)
        this.deliveryAnimator.update(dt);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
