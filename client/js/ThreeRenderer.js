// ThreeRenderer.js - Three.js based 3D renderer for the ranch environment

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { DeliveryAnimator } from './DeliveryAnimator.js';

// Shared materials palette
function buildMaterials() {
    return {
        // Metals
        chrome: new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.1 }),
        brushedSteel: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.35 }),
        blackMetal: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 }),

        // Plastics
        whitePlastic: new THREE.MeshStandardMaterial({ color: 0xF5F5F5, metalness: 0.0, roughness: 0.4 }),
        grayPlastic: new THREE.MeshStandardMaterial({ color: 0x606060, metalness: 0.0, roughness: 0.5 }),
        blackPlastic: new THREE.MeshStandardMaterial({ color: 0x1A1A1A, metalness: 0.0, roughness: 0.6 }),

        // Fabrics
        seatFabric: new THREE.MeshStandardMaterial({ color: 0x2E4A2E, metalness: 0.0, roughness: 0.9 }),

        // Glass
        clearGlass: new THREE.MeshStandardMaterial({ color: 0xCCEEFF, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3 }),

        // Accent colors
        sunChipsYellow: new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.0, roughness: 0.5 }),
        golfCartGreen: new THREE.MeshStandardMaterial({ color: 0x2E8B57, metalness: 0.0, roughness: 0.6 }),
        cautionYellow: new THREE.MeshStandardMaterial({ color: 0xFFCC00, metalness: 0.0, roughness: 0.5 }),
        redTaillight: new THREE.MeshStandardMaterial({ color: 0xCC0000, metalness: 0.2, roughness: 0.3, emissive: 0x330000, emissiveIntensity: 0.3 }),
        headlightGlow: new THREE.MeshStandardMaterial({ color: 0xFFFF88, emissive: 0xFFFF44, emissiveIntensity: 0.6 }),

        // Nature / Ranch
        plantGreen: new THREE.MeshStandardMaterial({ color: 0x228B22, metalness: 0.0, roughness: 0.8 }),
        trunkBrown: new THREE.MeshStandardMaterial({ color: 0x5D3A1A, metalness: 0.0, roughness: 0.95 }),
        hayGold: new THREE.MeshStandardMaterial({ color: 0xDAA520, metalness: 0.0, roughness: 0.95 }),
        fenceWood: new THREE.MeshStandardMaterial({ color: 0x8B6914, metalness: 0.0, roughness: 0.85 }),
        waterBlue: new THREE.MeshStandardMaterial({ color: 0x4488CC, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.6 }),
    };
}

// Particle class for collision and skid effects
class Particle {
    constructor(mesh, velocity, lifespan, rotSpeed = null) {
        this.mesh = mesh;
        this.velocity = velocity;
        this.lifespan = lifespan;
        this.age = 0;
        this.initialOpacity = mesh.material.opacity;
        this.rotSpeed = rotSpeed || { x: 0, y: 0, z: 0 };
    }

    update(dt) {
        this.age += dt;

        // Move
        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.y += this.velocity.y * dt;
        this.mesh.position.z += this.velocity.z * dt;

        // Gravity
        this.velocity.y -= 30 * dt;

        // Rotate (flutter)
        this.mesh.rotation.x += this.rotSpeed.x * dt;
        this.mesh.rotation.y += this.rotSpeed.y * dt;
        this.mesh.rotation.z += this.rotSpeed.z * dt;

        // Fade out
        const fadeStart = this.lifespan * 0.5;
        if (this.age > fadeStart) {
            const fadeProgress = (this.age - fadeStart) / (this.lifespan - fadeStart);
            this.mesh.material.opacity = this.initialOpacity * (1 - fadeProgress);
        }

        return this.age < this.lifespan;
    }
}

// Chip bag particle (group with multiple children)
class ChipBagParticle {
    constructor(group, velocity, lifespan, rotSpeed = null) {
        this.mesh = group;
        this.velocity = velocity;
        this.lifespan = lifespan;
        this.age = 0;
        this.rotSpeed = rotSpeed || { x: 0, y: 0, z: 0 };
    }

    update(dt) {
        this.age += dt;

        this.mesh.position.x += this.velocity.x * dt;
        this.mesh.position.y += this.velocity.y * dt;
        this.mesh.position.z += this.velocity.z * dt;

        this.velocity.y -= 30 * dt;

        this.mesh.rotation.x += this.rotSpeed.x * dt;
        this.mesh.rotation.y += this.rotSpeed.y * dt;
        this.mesh.rotation.z += this.rotSpeed.z * dt;

        // Fade all children
        const fadeStart = this.lifespan * 0.5;
        if (this.age > fadeStart) {
            const fadeProgress = (this.age - fadeStart) / (this.lifespan - fadeStart);
            const opacity = 1 - fadeProgress;
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = opacity;
                }
            });
        }

        return this.age < this.lifespan;
    }
}

export class ThreeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.materials = buildMaterials();

        const container = document.getElementById('game-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, width / height, 1, 4000);

        // Sky blue background
        this.scene.background = new THREE.Color(0x87CEEB);

        // References to dynamic objects
        this.cartGroup = null;
        this.particles = [];
        this.screenShake = { active: false, intensity: 0, timer: 0 };

        // Knockable obstacles
        this.knockableObstacles = [];

        // Loaded assets
        this.loadedModels = {};
        this.loadedAnimations = {};  // Store animations separately for animated models
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.textureLoader = new THREE.TextureLoader();

        // Delivery animation system
        this.deliveryAnimator = new DeliveryAnimator(this.scene);

        // Animal animation mixers
        this.animalMixers = [];

        // Configure renderer
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Outdoor fog — sky-colored, further distance
        this.scene.fog = new THREE.Fog(0x87CEEB, 800, 3000);

        // Scene constants for outdoor camera
        this.FOLLOW_DISTANCE = 180;
        this.CAMERA_HEIGHT = 90;
        this.LOOK_AHEAD = 120;

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

        const assetManifest = {
            // Cart
            cart: 'assets/cart/golf_cart.glb',
            // Vending machine and food
            vendingMachine: 'assets/arcade/vending-machine.glb',
            bag: 'assets/food/bag.glb',
            // Racing elements
            flagCheckers: 'assets/racing/flagCheckers.glb',
            pylon: 'assets/racing/pylon.glb',
            // Ranch buildings
            barn: 'assets/ranch/Barn.glb',
            openBarn: 'assets/ranch/Open Barn.glb',
            silo: 'assets/ranch/Silo.glb',
            chickenCoop: 'assets/ranch/ChickenCoop.glb',
            windmill: 'assets/ranch/Tower Windmill.glb',
            fence: 'assets/ranch/Fence.glb',
            smallBarn: 'assets/ranch/Small Barn.glb',
        };

        // Animated animal models (need special handling for animations)
        const animatedManifest = {
            cow: 'assets/ranch/Cow.glb',
            bull: 'assets/ranch/Bull.glb',
            horse: 'assets/ranch/Horse.glb',
            whiteHorse: 'assets/ranch/White Horse.glb',
            alpaca: 'assets/ranch/Alpaca.glb',
            donkey: 'assets/ranch/Donkey.glb',
            fox: 'assets/ranch/Fox.glb',
            deer: 'assets/ranch/Deer.glb',
        };

        // Load static models
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

        // Load animated models (store animations separately)
        const animLoadPromises = Object.entries(animatedManifest).map(async ([key, path]) => {
            try {
                const gltf = await this.loadGLTF(path);
                this.loadedModels[key] = gltf.scene;
                this.loadedAnimations[key] = gltf.animations || [];
                console.log(`Loaded animated: ${key} (${gltf.animations?.length || 0} animations)`);
            } catch (error) {
                console.warn(`Could not load ${key} from ${path}:`, error.message);
                this.loadedModels[key] = null;
                this.loadedAnimations[key] = [];
            }
        });

        await Promise.all([...loadPromises, ...animLoadPromises]);

        // Load animated characters for delivery sequence
        await this.deliveryAnimator.loadCharacter(this.fbxLoader, this.textureLoader);

        console.log('All assets loaded');
    }

    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(path, (gltf) => resolve(gltf), undefined, (error) => reject(error));
        });
    }

    cloneModel(modelKey, targetHeight = 30) {
        const model = this.loadedModels[modelKey];
        if (!model) return null;

        const clone = model.clone();

        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const scale = targetHeight / size.y;
        clone.scale.set(scale, scale, scale);

        box.setFromObject(clone);
        const center = box.getCenter(new THREE.Vector3());

        clone.position.x = -center.x;
        clone.position.y = -box.min.y;
        clone.position.z = -center.z;

        clone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const group = new THREE.Group();
        group.add(clone);
        return group;
    }

    // Clone an animated model and set up AnimationMixer
    // Uses SkeletonUtils.clone for proper SkinnedMesh support
    cloneAnimatedModel(modelKey, targetHeight = 30, animationName = 'Idle') {
        const model = this.loadedModels[modelKey];
        if (!model) return null;

        // SkeletonUtils.clone properly handles SkinnedMesh + Skeleton
        const clone = SkeletonUtils.clone(model);

        // Quaternius animal GLBs have an AnimalArmature with scale 100
        // and tiny geometry vertices (~0.01 range). Box3.setFromObject() on
        // SkinnedMeshes uses bind-pose geometry, which gives a wrong bounding
        // box. We need to compute size from the actual skeleton-posed vertices.
        // The most reliable approach: advance the mixer one tick so bones are
        // in their idle pose, then read bone world positions to estimate height.
        let estimatedHeight = 0;
        const bones = [];
        clone.traverse(c => { if (c.isBone) bones.push(c); });
        if (bones.length > 0) {
            // Update world matrices so bone positions are valid
            clone.updateMatrixWorld(true);
            let minY = Infinity, maxY = -Infinity;
            for (const bone of bones) {
                const wp = new THREE.Vector3();
                bone.getWorldPosition(wp);
                if (wp.y < minY) minY = wp.y;
                if (wp.y > maxY) maxY = wp.y;
            }
            estimatedHeight = maxY - minY;
        }
        // Fallback to Box3 if bone-based height fails
        if (estimatedHeight < 0.01) {
            const box = new THREE.Box3().setFromObject(clone);
            estimatedHeight = box.getSize(new THREE.Vector3()).y;
        }
        if (estimatedHeight === 0) return null;

        const scale = targetHeight / estimatedHeight;
        clone.scale.set(scale, scale, scale);

        // Recompute position using bone-based bounds
        clone.updateMatrixWorld(true);
        let minBoneY = Infinity;
        const center = new THREE.Vector3();
        let boneCount = 0;
        for (const bone of bones) {
            const wp = new THREE.Vector3();
            bone.getWorldPosition(wp);
            center.add(wp);
            boneCount++;
            if (wp.y < minBoneY) minBoneY = wp.y;
        }
        if (boneCount > 0) {
            center.divideScalar(boneCount);
            clone.position.x = -center.x;
            clone.position.y = -minBoneY;
            clone.position.z = -center.z;
        } else {
            const box = new THREE.Box3().setFromObject(clone);
            const c = box.getCenter(new THREE.Vector3());
            clone.position.x = -c.x;
            clone.position.y = -box.min.y;
            clone.position.z = -c.z;
        }

        clone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // CRITICAL: SkeletonUtils.clone() doesn't recompute bounding volumes,
                // causing Three.js frustum culling to hide models that are actually in view.
                // Disable frustum culling entirely for animated models.
                child.frustumCulled = false;
            }
        });

        const group = new THREE.Group();
        group.add(clone);

        // Set up animation mixer
        const animations = this.loadedAnimations[modelKey];
        if (animations && animations.length > 0) {
            const mixer = new THREE.AnimationMixer(clone);

            // Try to find the requested animation, fall back to first
            let clip = animations.find(c =>
                c.name.toLowerCase().includes(animationName.toLowerCase())
            );
            if (!clip) clip = animations[0];

            if (clip) {
                const action = mixer.clipAction(clip);
                action.timeScale = 0.5; // Half speed for more natural, relaxed look
                action.play();
            }

            // Offset start time so animals don't animate in sync
            mixer.setTime(Math.random() * 6.0);

            this.animalMixers.push(mixer);
            group.userData.mixer = mixer;
            group.userData.animations = animations;
        }

        return group;
    }

    async buildScene(track) {
        this.track = track;

        await this.loadAssets();

        this.buildGround();
        this.buildRoadMesh(track);
        this.buildOutdoorLighting();
        this.buildFences(track);
        this.buildBarnChicane(track);
        this.buildRanchObstacles(track);
        this.buildRacingElements(track);
        this.buildSnackStations(track);
        this.buildCreek(track);
        this.buildEasterEggs(track);
        this.buildCart();
    }

    // ==================== NEW RANCH SCENE BUILDERS ====================

    buildGround() {
        // Canvas-generated grass texture
        const grassCanvas = document.createElement('canvas');
        grassCanvas.width = 256;
        grassCanvas.height = 256;
        const ctx = grassCanvas.getContext('2d');

        // Base green
        ctx.fillStyle = '#4A7C3A';
        ctx.fillRect(0, 0, 256, 256);

        // Grass variation
        for (let i = 0; i < 1000; i++) {
            const shade = Math.floor(Math.random() * 30) - 15;
            ctx.fillStyle = `rgb(${74 + shade}, ${124 + shade}, ${58 + shade})`;
            ctx.fillRect(
                Math.floor(Math.random() * 256),
                Math.floor(Math.random() * 256),
                1 + Math.floor(Math.random() * 3),
                2 + Math.floor(Math.random() * 4)
            );
        }

        const grassTexture = new THREE.CanvasTexture(grassCanvas);
        grassTexture.wrapS = THREE.RepeatWrapping;
        grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(60, 60);

        const groundGeo = new THREE.PlaneGeometry(8000, 8000);
        const groundMat = new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.9,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(1800, -0.5, 1800);
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    buildRoadMesh(track) {
        const splinePoints = track.splinePoints;
        if (!splinePoints || splinePoints.length === 0) return;

        // Group consecutive spline points by surface type
        const segments = [];
        let currentSurface = splinePoints[0].surface;
        let currentStart = 0;

        for (let i = 1; i < splinePoints.length; i++) {
            if (splinePoints[i].surface !== currentSurface) {
                segments.push({ surface: currentSurface, start: currentStart, end: i });
                currentSurface = splinePoints[i].surface;
                currentStart = i;
            }
        }
        segments.push({ surface: currentSurface, start: currentStart, end: splinePoints.length });

        // Build a mesh for each surface segment
        for (const seg of segments) {
            const surfData = track.SURFACES[seg.surface] || track.SURFACES.asphalt;
            const positions = [];
            const indices = [];
            const uvs = [];

            for (let i = seg.start; i <= seg.end && i < splinePoints.length; i++) {
                const sp = splinePoints[i % splinePoints.length];
                const hw = sp.width;

                // Left edge vertex (game y -> Three.js z)
                positions.push(sp.x + sp.nx * hw, 0.05, sp.y + sp.ny * hw);
                // Right edge vertex
                positions.push(sp.x - sp.nx * hw, 0.05, sp.y - sp.ny * hw);

                // UVs
                const v = sp.distFromStart / 200; // repeat every 200 units
                uvs.push(0, v);
                uvs.push(1, v);

                // Triangle strip indices
                const vi = (i - seg.start) * 2;
                if (i > seg.start) {
                    indices.push(vi - 2, vi - 1, vi);
                    indices.push(vi - 1, vi + 1, vi);
                }
            }

            if (positions.length < 6) continue;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            // Per-surface material properties for visual differentiation
            let material;
            if (seg.surface === 'mud') {
                // Mud: glossy/shiny to look wet and dangerous
                material = new THREE.MeshPhongMaterial({
                    color: 0x4A3520,
                    shininess: 60,
                    specular: 0x332211,
                });
            } else if (seg.surface === 'water') {
                // Water road: slightly raised, semi-transparent blue
                // Use depthWrite:false and polygonOffset to avoid z-fighting with creek plane
                material = new THREE.MeshStandardMaterial({
                    color: 0x2277AA,
                    roughness: 0.1,
                    metalness: 0.3,
                    transparent: true,
                    opacity: 0.7,
                    depthWrite: false,
                });
            } else if (seg.surface === 'gravel') {
                // Gravel: rough, speckled look
                material = new THREE.MeshStandardMaterial({
                    color: 0xA0937D,
                    roughness: 0.95,
                });
            } else if (seg.surface === 'asphalt') {
                // Asphalt: dark gray, matte
                material = new THREE.MeshStandardMaterial({
                    color: 0x555555,
                    roughness: 0.75,
                });
            } else {
                // Dirt: warm brown, matte
                material = new THREE.MeshStandardMaterial({
                    color: 0x8B6914,
                    roughness: 0.85,
                });
            }

            const roadMesh = new THREE.Mesh(geometry, material);
            roadMesh.receiveShadow = true;
            this.scene.add(roadMesh);
        }

        // Close the loop: connect last segment back to first
        this._buildRoadClosingSegment(track);

        // Center dashed line
        this.buildCenterLine(track);
        // DECORATION TASK 1 COMPLETE
    }

    _buildRoadClosingSegment(track) {
        const sp = track.splinePoints;
        if (sp.length < 2) return;

        const last = sp[sp.length - 1];
        const first = sp[0];
        const surfData = track.SURFACES[last.surface] || track.SURFACES.asphalt;

        const positions = [
            last.x + last.nx * last.width, 0.05, last.y + last.ny * last.width,
            last.x - last.nx * last.width, 0.05, last.y - last.ny * last.width,
            first.x + first.nx * first.width, 0.05, first.y + first.ny * first.width,
            first.x - first.nx * first.width, 0.05, first.y - first.ny * first.width,
        ];
        const indices = [0, 1, 2, 1, 3, 2];

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: surfData.color, roughness: 0.85 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
    }

    buildCenterLine(track) {
        const sp = track.splinePoints;
        const dashLength = 15;
        const gapLength = 25;

        // Yellow dashed center line for asphalt, white for dirt/gravel
        const yellowLineMat = new THREE.MeshStandardMaterial({ color: 0xFFCC00, roughness: 0.5 });
        const whiteLineMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 });

        let dist = 0;
        for (let i = 0; i < sp.length; i++) {
            if (i > 0) {
                const dx = sp[i].x - sp[i - 1].x;
                const dy = sp[i].y - sp[i - 1].y;
                dist += Math.sqrt(dx * dx + dy * dy);
            }

            const cycle = dist % (dashLength + gapLength);
            if (cycle < dashLength && sp[i].surface !== 'water' && sp[i].surface !== 'mud') {
                const dashGeo = new THREE.BoxGeometry(3, 0.2, 3);
                const mat = sp[i].surface === 'asphalt' ? yellowLineMat : whiteLineMat;
                const dash = new THREE.Mesh(dashGeo, mat);
                dash.position.set(sp[i].x, 0.15, sp[i].y);
                dash.rotation.y = Math.atan2(sp[i].ty, sp[i].tx);
                this.scene.add(dash);
            }
        }
    }

    buildOutdoorLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xFFFFFF, 0.5);
        this.scene.add(ambient);

        // Hemisphere light: sky blue above, grass green below
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x4A7C3A, 0.6);
        this.scene.add(hemi);

        // Sun directional light
        const sun = new THREE.DirectionalLight(0xFFEECC, 1.0);
        sun.position.set(2000, 800, 1000);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 4096;
        sun.shadow.mapSize.height = 4096;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 3000;
        sun.shadow.camera.left = -2500;
        sun.shadow.camera.right = 2500;
        sun.shadow.camera.top = 2500;
        sun.shadow.camera.bottom = -2500;
        sun.shadow.radius = 2;
        this.scene.add(sun);

        // Fill light from opposite side
        const fill = new THREE.DirectionalLight(0xCCDDFF, 0.3);
        fill.position.set(-1000, 400, -500);
        this.scene.add(fill);
    }

    buildFences(track) {
        const edges = track.getWallEdges();
        const m = this.materials;

        // Measure the GLB fence width so we can space them perfectly
        const testFence = this.cloneModel('fence', 15);
        let fenceWidth = 30; // default if no GLB
        if (testFence) {
            const box = new THREE.Box3().setFromObject(testFence);
            const size = new THREE.Vector3();
            box.getSize(size);
            // Fence extends along its longest horizontal axis
            fenceWidth = Math.max(size.x, size.z);
        }

        // Build fences along both sides using distance-based spacing
        for (const side of ['left', 'right']) {
            const edgePoints = edges[side];
            let distSinceLastFence = fenceWidth; // place one immediately

            for (let i = 0; i < edgePoints.length - 1; i++) {
                const ep = edgePoints[i];
                const next = edgePoints[i + 1];
                const dx = next.x - ep.x;
                const dy = next.y - ep.y;
                const segLen = Math.sqrt(dx * dx + dy * dy);
                distSinceLastFence += segLen;

                if (distSinceLastFence >= fenceWidth * 0.75) {
                    distSinceLastFence = 0;

                    // Compute tangent direction from a wider neighborhood for stability
                    const lookAhead = Math.min(i + 5, edgePoints.length - 1);
                    const tdx = edgePoints[lookAhead].x - ep.x;
                    const tdy = edgePoints[lookAhead].y - ep.y;

                    // Nudge fence outward to sit at the wall collision boundary
                    // (wall starts ~40-50 units beyond road edge due to track curvature)
                    const nudge = 45;
                    const fx = ep.x + ep.nx * nudge;
                    const fz = ep.y + ep.ny * nudge;

                    const fenceModel = this.cloneModel('fence', 15);
                    if (fenceModel) {
                        fenceModel.position.set(fx, 0, fz);
                        fenceModel.rotation.y = -Math.atan2(tdy, tdx);
                        this.scene.add(fenceModel);
                    } else {
                        // Procedural fence section: two posts + two rails
                        const sectionLen = fenceWidth;
                        const tLen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                        const cos = tdx / tLen;
                        const sin = tdy / tLen;

                        // Posts at each end
                        for (let p = 0; p <= 1; p++) {
                            const px = fx + cos * sectionLen * p;
                            const pz = fz + sin * sectionLen * p;
                            const postGeo = new THREE.BoxGeometry(2, 15, 2);
                            const post = new THREE.Mesh(postGeo, m.fenceWood);
                            post.position.set(px, 7.5, pz);
                            post.castShadow = true;
                            this.scene.add(post);
                        }

                        // Two horizontal rails connecting the posts
                        for (const railY of [5, 10]) {
                            const railGeo = new THREE.BoxGeometry(sectionLen, 1.5, 1.5);
                            const rail = new THREE.Mesh(railGeo, m.fenceWood);
                            rail.position.set(
                                fx + cos * sectionLen * 0.5,
                                railY,
                                fz + sin * sectionLen * 0.5
                            );
                            rail.rotation.y = -Math.atan2(tdy, tdx);
                            this.scene.add(rail);
                        }
                    }
                }
            }
        }
    }

    buildBarnChicane(track) {
        const SAMPLES_PER_SEGMENT = 20;

        // === BARN TUNNEL at CP 12 — centered ON the track so cart drives THROUGH it ===
        const barnIdx = 12 * SAMPLES_PER_SEGMENT;
        if (barnIdx < track.splinePoints.length) {
            const sp = track.splinePoints[barnIdx];
            const trackAngle = Math.atan2(sp.ty, sp.tx);

            // Open barn: load raw model and scale it ourselves for full control
            const openBarnModel = this.loadedModels['openBarn'];
            if (openBarnModel) {
                const clone = openBarnModel.clone();
                // Measure raw model size
                const box = new THREE.Box3().setFromObject(clone);
                const size = box.getSize(new THREE.Vector3());
                // We need it tall (~80 units) and wide enough for the cart
                // Scale based on the largest dimension to make it BIG
                const targetHeight = 80;
                const baseScale = targetHeight / Math.max(size.y, 0.01);
                clone.scale.set(baseScale * 2.0, baseScale * 2.0, baseScale * 2.0);

                // Re-measure after scaling
                box.setFromObject(clone);
                const center = box.getCenter(new THREE.Vector3());

                // Center on track position — feet on ground
                clone.position.x = -center.x;
                clone.position.y = -box.min.y;
                clone.position.z = -center.z;

                clone.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const barnGroup = new THREE.Group();
                barnGroup.add(clone);
                barnGroup.position.set(sp.x, 0, sp.y); // Centered ON the track
                // Align barn so its open face points along the track direction
                // The Open Barn model's open face points along the model's local -Z axis.
                // We rotate by trackAngle - PI/2 to align the opening with the track.
                barnGroup.rotation.y = trackAngle - Math.PI / 2;
                this.scene.add(barnGroup);
            } else {
                // Procedural barn tunnel fallback: 4 pillars + roof
                const barnGroup = new THREE.Group();
                const pillarGeo = new THREE.BoxGeometry(8, 70, 8);
                const roofGeo = new THREE.BoxGeometry(sp.width * 2 + 40, 6, 120);
                const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 });

                // 4 corner pillars straddling the road
                const halfW = sp.width + 15;
                for (const [lx, lz] of [[-halfW, -50], [-halfW, 50], [halfW, -50], [halfW, 50]]) {
                    const pillar = new THREE.Mesh(pillarGeo, woodMat);
                    pillar.position.set(lx, 35, lz);
                    pillar.castShadow = true;
                    barnGroup.add(pillar);
                }

                // Roof
                const roof = new THREE.Mesh(roofGeo, woodMat);
                roof.position.set(0, 73, 0);
                roof.castShadow = true;
                barnGroup.add(roof);

                barnGroup.position.set(sp.x, 0, sp.y);
                barnGroup.rotation.y = trackAngle;
                this.scene.add(barnGroup);
            }

            // Regular barn off to the side (not ON the track)
            const barn = this.cloneModel('barn', 70);
            if (barn) {
                barn.position.set(sp.x - sp.nx * 200, 0, sp.y - sp.ny * 200);
                barn.rotation.y = trackAngle + Math.PI / 4;
                this.scene.add(barn);
            }
        }

        // Silo near barn area (CP 13) — off-track
        const siloIdx = 13 * SAMPLES_PER_SEGMENT;
        if (siloIdx < track.splinePoints.length) {
            const sp = track.splinePoints[siloIdx];
            const silo = this.cloneModel('silo', 60);
            if (silo) {
                silo.position.set(sp.x + sp.nx * 200, 0, sp.y + sp.ny * 200);
                this.scene.add(silo);
            }
        }

        // Chicken coop near barn (CP 11) — in the pasture
        const coopIdx = 11 * SAMPLES_PER_SEGMENT;
        if (coopIdx < track.splinePoints.length) {
            const sp = track.splinePoints[coopIdx];
            const coop = this.cloneModel('chickenCoop', 25);
            if (coop) {
                coop.position.set(sp.x - sp.nx * 180, 0, sp.y - sp.ny * 180);
                coop.rotation.y = Math.random() * Math.PI;
                this.scene.add(coop);
            }
        }

        // Small barn off to the side (CP 14, near station 2)
        const smallBarnIdx = 14 * SAMPLES_PER_SEGMENT;
        if (smallBarnIdx < track.splinePoints.length) {
            const sp = track.splinePoints[smallBarnIdx];
            const sb = this.cloneModel('smallBarn', 50);
            if (sb) {
                sb.position.set(sp.x + sp.nx * 250, 0, sp.y + sp.ny * 250);
                sb.rotation.y = Math.atan2(sp.ty, sp.tx) - Math.PI / 3;
                this.scene.add(sb);
            }
        }

        // Tower windmill as a visible landmark (near CP 16 — fast sweeping curve)
        const windmillIdx = 16 * SAMPLES_PER_SEGMENT;
        if (windmillIdx < track.splinePoints.length) {
            const sp = track.splinePoints[windmillIdx];
            const windmill = this.cloneModel('windmill', 100);
            if (windmill) {
                windmill.position.set(sp.x + sp.nx * 400, 0, sp.y + sp.ny * 400);
                this.scene.add(windmill);
            }
        }

        // Paddock fence segments near barn — suggests the cows came from here
        const paddockIdx = 11 * SAMPLES_PER_SEGMENT + 10;
        if (paddockIdx < track.splinePoints.length) {
            const sp = track.splinePoints[paddockIdx];
            const paddockX = sp.x + sp.nx * 250;
            const paddockZ = sp.y + sp.ny * 250;
            const woodMat = this.materials.fenceWood;
            // Small square paddock of 4 fence sections
            for (let f = 0; f < 4; f++) {
                const angle = (f / 4) * Math.PI * 2;
                const fx = paddockX + Math.cos(angle) * 60;
                const fz = paddockZ + Math.sin(angle) * 60;
                const fence = this.cloneModel('fence', 15);
                if (fence) {
                    fence.position.set(fx, 0, fz);
                    fence.rotation.y = angle;
                    this.scene.add(fence);
                }
            }
        }
        // DECORATION TASK 3 COMPLETE
    }

    buildRanchObstacles(track) {
        this.knockableObstacles = [];

        for (let i = 0; i < track.obstacles.length; i++) {
            const obstacle = track.obstacles[i];
            let obj = null;

            switch (obstacle.type) {
                case 'cow':
                    obj = this.createCow();
                    break;
                case 'cow_decorative':
                    obj = this.createDecorativeAnimal('cow');
                    break;
                case 'bull_decorative':
                    obj = this.createDecorativeAnimal('bull');
                    break;
                case 'horse_decorative':
                    obj = this.createDecorativeAnimal('horse');
                    break;
                case 'donkey_decorative':
                    obj = this.createDecorativeAnimal('donkey');
                    break;
                case 'alpaca_decorative':
                    obj = this.createDecorativeAnimal('alpaca');
                    break;
                case 'whiteHorse_decorative':
                    obj = this.createDecorativeAnimal('whiteHorse');
                    break;
                case 'fox_decorative':
                    obj = this.createDecorativeAnimal('fox');
                    break;
                case 'deer_decorative':
                    obj = this.createDecorativeAnimal('deer');
                    break;
                case 'hay_bale':
                    obj = this.createHayBale();
                    break;
                case 'tree':
                    obj = this.createTree();
                    break;
                default:
                    continue;
            }

            if (obj) {
                obj.position.set(obstacle.x, 0, obstacle.y);
                obj.rotation.y = Math.random() * Math.PI * 2;
                this.scene.add(obj);

                if (obstacle.knockable) {
                    this.knockableObstacles.push({
                        group: obj,
                        obstacleIndex: i,
                        gameX: obstacle.x,
                        gameY: obstacle.y,
                        radius: obstacle.collisionRadius || 15,
                        knocked: false,
                        velocity: { x: 0, y: 0, z: 0 },
                        angVel: { x: 0, y: 0, z: 0 },
                        settled: false
                    });
                }
            }
        }
    }

    // DECORATION TASK 4 COMPLETE
    createCow() {
        // Try animated GLB — 25 units tall (roughly cart height)
        // Use "Eating" animation (grazing) — much calmer than "Idle" head-bobbing
        const cow = this.cloneAnimatedModel('cow', 25, 'Eating');
        if (cow) return cow;

        // Procedural fallback (~25 units tall to match GLB cow)
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F5, roughness: 0.8 });
        const spotMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 16), bodyMat);
        body.position.y = 16;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), bodyMat);
        head.position.set(18, 20, 0);
        head.castShadow = true;
        group.add(head);

        const legGeo = new THREE.CylinderGeometry(2, 2, 10, 6);
        for (const [x, z] of [[-10, -5], [-10, 5], [10, -5], [10, 5]]) {
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(x, 5, z);
            group.add(leg);
        }

        const spot = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 0.5), spotMat);
        spot.position.set(-5, 18, 8.5);
        group.add(spot);

        return group;
    }

    // DECORATION TASK 5 COMPLETE
    createDecorativeAnimal(type) {
        // Use "Eating" (grazing) for calmer look; falls back to Idle_Headlow then Idle
        const model = this.cloneAnimatedModel(type, 22, 'Eating');
        if (model) return model;

        // Fallback: use cow procedural model for any animal
        return this.createCow();
    }

    // DECORATION TASK 6 COMPLETE
    createHayBale() {
        const group = new THREE.Group();
        const hayMat = new THREE.MeshStandardMaterial({
            color: 0xD4A030,
            roughness: 0.9,
        });

        // Mix ~60% round bales / 40% square bales
        if (Math.random() < 0.6) {
            // Round bale — cylinder lying on its side
            const bale = new THREE.Mesh(
                new THREE.CylinderGeometry(8, 8, 10, 12),
                hayMat
            );
            bale.rotation.z = Math.PI / 2; // Lying on side
            bale.position.y = 8;
            bale.castShadow = true;
            group.add(bale);
        } else {
            // Square bale — rectangular box
            const bale = new THREE.Mesh(
                new THREE.BoxGeometry(12, 8, 8),
                hayMat
            );
            bale.position.y = 4;
            bale.castShadow = true;
            group.add(bale);
        }

        return group;
    }

    createTree() {
        const group = new THREE.Group();
        const m = this.materials;

        // Trunk
        const trunkHeight = 25 + Math.random() * 15;
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(3, 4, trunkHeight, 8),
            m.trunkBrown
        );
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        group.add(trunk);

        // Canopy (2-3 spheres for natural look)
        const canopyRadius = 15 + Math.random() * 10;
        const canopy = new THREE.Mesh(
            new THREE.SphereGeometry(canopyRadius, 8, 8),
            m.plantGreen
        );
        canopy.position.y = trunkHeight + canopyRadius * 0.5;
        canopy.castShadow = true;
        group.add(canopy);

        // Second smaller canopy sphere for variety
        const canopy2 = new THREE.Mesh(
            new THREE.SphereGeometry(canopyRadius * 0.7, 8, 8),
            m.plantGreen
        );
        canopy2.position.set(
            (Math.random() - 0.5) * canopyRadius,
            trunkHeight + canopyRadius * 0.3,
            (Math.random() - 0.5) * canopyRadius
        );
        canopy2.castShadow = true;
        group.add(canopy2);

        return group;
    }

    buildCreek(track) {
        // Find water sections of the track (the actual creek)
        const waterPoints = track.splinePoints.filter(sp => sp.surface === 'water');
        const creekArea = track.splinePoints.filter(sp =>
            sp.surface === 'water' || sp.surface === 'mud'
        );

        if (waterPoints.length === 0) return;

        // Bounding box of creek area — extend much wider than road (creek is wider)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const cp of creekArea) {
            const hw = cp.width + 200; // Creek extends 200 units beyond road on each side
            minX = Math.min(minX, cp.x - hw);
            maxX = Math.max(maxX, cp.x + hw);
            minY = Math.min(minY, cp.y - hw);
            maxY = Math.max(maxY, cp.y + hw);
        }

        const padding = 50;
        const waterWidth = maxX - minX + padding * 2;
        const waterHeight = maxY - minY + padding * 2;
        const waterGeo = new THREE.PlaneGeometry(waterWidth, waterHeight);

        // Create a canvas texture for animated water
        const waterCanvas = document.createElement('canvas');
        waterCanvas.width = 128;
        waterCanvas.height = 128;
        const wctx = waterCanvas.getContext('2d');
        wctx.fillStyle = '#3388BB';
        wctx.fillRect(0, 0, 128, 128);
        // Add some lighter ripple variation
        for (let i = 0; i < 200; i++) {
            const shade = Math.floor(Math.random() * 30);
            wctx.fillStyle = `rgba(${100 + shade}, ${180 + shade}, ${220 + shade}, 0.3)`;
            wctx.fillRect(
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                2 + Math.floor(Math.random() * 6),
                1 + Math.floor(Math.random() * 2)
            );
        }
        const waterTexture = new THREE.CanvasTexture(waterCanvas);
        waterTexture.wrapS = THREE.RepeatWrapping;
        waterTexture.wrapT = THREE.RepeatWrapping;
        waterTexture.repeat.set(waterWidth / 80, waterHeight / 80);

        const waterMat = new THREE.MeshStandardMaterial({
            map: waterTexture,
            color: 0x3388BB,
            transparent: true,
            opacity: 0.6,
            roughness: 0.05,
            metalness: 0.3,
            depthWrite: false,
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.set(
            (minX + maxX) / 2,
            0.2,     // Slightly above ground (-0.5) to avoid z-fighting
            (minY + maxY) / 2
        );
        water.renderOrder = 1;  // Render after opaque objects
        water.receiveShadow = true;
        this.scene.add(water);
        this.waterMesh = water;
        this.waterTexture = waterTexture;

        // Creek rocks — half-submerged gray boulders
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9 });
        for (let i = 0; i < waterPoints.length; i += Math.floor(waterPoints.length / 6)) {
            const wp = waterPoints[i];
            const side = (i % 2 === 0) ? 1 : -1;
            const offset = wp.width * (0.6 + Math.random() * 0.8) * side;
            const rockSize = 4 + Math.random() * 6;
            const rock = new THREE.Mesh(
                new THREE.SphereGeometry(rockSize, 6, 5),
                rockMat
            );
            rock.position.set(
                wp.x + wp.nx * offset,
                -rockSize * 0.3,
                wp.y + wp.ny * offset
            );
            rock.scale.set(1, 0.6, 1); // Flatten slightly
            rock.castShadow = true;
            this.scene.add(rock);
        }
        // DECORATION TASK 2 COMPLETE
    }

    buildRacingElements(track) {
        const startPos = track.getStartPosition();

        // Place flags at start/finish if we have spline data
        if (track.splinePoints.length > 0) {
            const sp0 = track.splinePoints[0];
            const halfWidth = sp0.width;
            const numFlags = 5;

            for (let i = 0; i < numFlags; i++) {
                const t = (i / (numFlags - 1)) - 0.5;
                const flag = this.cloneModel('flagCheckers', 40);
                if (flag) {
                    flag.position.set(
                        startPos.x + sp0.nx * t * halfWidth * 1.8,
                        0,
                        startPos.y + sp0.ny * t * halfWidth * 1.8
                    );
                    this.scene.add(flag);
                }
            }

            // Pylons lining both sides of the road at start zone (8 total, training course vibes)
            for (let i = 0; i < 8; i++) {
                const pylon = this.cloneModel('pylon', 15);
                if (pylon) {
                    const side = i < 4 ? 1 : -1;
                    const along = ((i % 4) - 1.5) * 40;
                    pylon.position.set(
                        startPos.x + sp0.tx * along + sp0.nx * side * (sp0.width + 20),
                        0,
                        startPos.y + sp0.ty * along + sp0.ny * side * (sp0.width + 20)
                    );
                    this.scene.add(pylon);
                }
            }

            // "SUN CHIPS TRAINING FACILITY" billboard sign
            this.buildStartSign(startPos, sp0);

            // Hay bale pile near start (looks like course setup materials)
            const hayMat = new THREE.MeshStandardMaterial({ color: 0xD4A030, roughness: 0.9 });
            const pileX = startPos.x + sp0.nx * (sp0.width + 80);
            const pileZ = startPos.y + sp0.ny * (sp0.width + 80);
            // Ground bale
            const bale1 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 12), hayMat);
            bale1.rotation.z = Math.PI / 2;
            bale1.position.set(pileX, 8, pileZ);
            bale1.castShadow = true;
            this.scene.add(bale1);
            // Stacked square bale
            const bale2 = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 8), hayMat);
            bale2.position.set(pileX + 10, 4, pileZ + 5);
            bale2.rotation.y = 0.3;
            bale2.castShadow = true;
            this.scene.add(bale2);
            // Leaning bale against the round one
            const bale3 = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 7), hayMat);
            bale3.position.set(pileX - 5, 3.5, pileZ + 8);
            bale3.rotation.z = 0.2;
            bale3.castShadow = true;
            this.scene.add(bale3);
        }
    }

    buildStartSign(startPos, sp0) {
        // Billboard: "SUN CHIPS TRAINING FACILITY"
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Yellow background
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(0, 0, 512, 128);

        // Border
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 506, 122);

        // Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SUN CHIPS', 256, 40);
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillText('TRAINING FACILITY', 256, 88);

        const signTexture = new THREE.CanvasTexture(canvas);
        const signGeo = new THREE.PlaneGeometry(80, 20);
        const signMat = new THREE.MeshStandardMaterial({
            map: signTexture,
            roughness: 0.5,
        });
        const sign = new THREE.Mesh(signGeo, signMat);

        // Two posts
        const postMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9 });
        const postGeo = new THREE.CylinderGeometry(1.5, 1.5, 35, 6);

        const signGroup = new THREE.Group();
        const post1 = new THREE.Mesh(postGeo, postMat);
        post1.position.set(-30, 17.5, 0);
        post1.castShadow = true;
        signGroup.add(post1);

        const post2 = new THREE.Mesh(postGeo, postMat);
        post2.position.set(30, 17.5, 0);
        post2.castShadow = true;
        signGroup.add(post2);

        sign.position.set(0, 38, 0);
        signGroup.add(sign);

        // Also add a back face
        const signBack = new THREE.Mesh(signGeo, signMat);
        signBack.position.set(0, 38, -0.1);
        signBack.rotation.y = Math.PI;
        signGroup.add(signBack);

        // Position facing the start direction
        const signOffset = sp0.width + 120;
        signGroup.position.set(
            startPos.x - sp0.nx * signOffset,
            0,
            startPos.y - sp0.ny * signOffset
        );
        // Face perpendicular to the track
        signGroup.rotation.y = Math.atan2(sp0.tx, -sp0.ty);
        this.scene.add(signGroup);
        // DECORATION TASK 8 COMPLETE
    }

    // ==================== EASTER EGGS ====================

    buildEasterEggs(track) {
        const SAMPLES_PER_SEGMENT = 20;

        // 1. Cow standing on top of a hay bale — how did it get up there?
        const cowOnBaleIdx = 8 * SAMPLES_PER_SEGMENT; // Near fence corridor
        if (cowOnBaleIdx < track.splinePoints.length) {
            const sp = track.splinePoints[cowOnBaleIdx];
            const baleX = sp.x + sp.nx * (sp.width + 60);
            const baleZ = sp.y + sp.ny * (sp.width + 60);

            // Round hay bale on the ground
            const hayMat = new THREE.MeshStandardMaterial({ color: 0xD4A030, roughness: 0.9 });
            const bale = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 12), hayMat);
            bale.rotation.z = Math.PI / 2;
            bale.position.set(baleX, 8, baleZ);
            bale.castShadow = true;
            this.scene.add(bale);

            // Cow standing proudly on top
            const cow = this.cloneAnimatedModel('cow', 20, 'Idle');
            if (cow) {
                cow.position.set(baleX, 16, baleZ);
                cow.rotation.y = Math.random() * Math.PI * 2;
                this.scene.add(cow);
            }
        }

        // 2. Chicken coop placed suspiciously far from the barn — near the creek
        const creekIdx = 20 * SAMPLES_PER_SEGMENT; // Creek area
        if (creekIdx < track.splinePoints.length) {
            const sp = track.splinePoints[creekIdx];
            const coop = this.cloneModel('chickenCoop', 20);
            if (coop) {
                coop.position.set(
                    sp.x + sp.nx * (sp.width + 250),
                    0,
                    sp.y + sp.ny * (sp.width + 250)
                );
                coop.rotation.y = Math.random() * Math.PI;
                this.scene.add(coop);
            }
        }

        // 3. Fox hidden behind hay bale stack near the barn — only visible from certain angles
        const foxIdx = 13 * SAMPLES_PER_SEGMENT; // Near barn exit
        if (foxIdx < track.splinePoints.length) {
            const sp = track.splinePoints[foxIdx];
            const hideX = sp.x - sp.nx * (sp.width + 140);
            const hideZ = sp.y - sp.ny * (sp.width + 140);

            // Stack of hay bales to hide behind
            const hayMat = new THREE.MeshStandardMaterial({ color: 0xD4A030, roughness: 0.9 });
            const stackBale1 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 12), hayMat);
            stackBale1.rotation.z = Math.PI / 2;
            stackBale1.position.set(hideX, 8, hideZ);
            stackBale1.castShadow = true;
            this.scene.add(stackBale1);

            const stackBale2 = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 8), hayMat);
            stackBale2.position.set(hideX + 8, 4, hideZ + 6);
            stackBale2.castShadow = true;
            this.scene.add(stackBale2);

            // Fox behind the bales
            const fox = this.cloneAnimatedModel('fox', 12, 'Idle');
            if (fox) {
                fox.position.set(hideX - 10, 0, hideZ + 3);
                fox.rotation.y = Math.atan2(sp.ty, sp.tx); // Facing along track
                this.scene.add(fox);
            }
        }

        // 4. Scattered chip bags near each vending machine (evidence of previous trainees)
        if (track.snackStations) {
            for (const station of track.snackStations) {
                for (let i = 0; i < 6; i++) {
                    const bag = this.createSunChipsBag(0.5 + Math.random() * 0.3);
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 15 + Math.random() * 20;
                    bag.position.set(
                        station.x + Math.cos(angle) * dist,
                        0.5 + Math.random() * 2,
                        station.y + Math.sin(angle) * dist
                    );
                    bag.rotation.set(
                        Math.PI * 0.3 + (Math.random() - 0.5) * 0.5,
                        Math.random() * Math.PI * 2,
                        (Math.random() - 0.5) * 0.5
                    );
                    this.scene.add(bag);
                }
            }
        }

        // 5. Lone alpaca at the start/finish area — just standing there, judging
        const startPos = track.getStartPosition();
        if (track.splinePoints.length > 0) {
            const sp0 = track.splinePoints[0];
            const alpaca = this.cloneAnimatedModel('alpaca', 22, 'Idle');
            if (alpaca) {
                alpaca.position.set(
                    startPos.x + sp0.nx * (sp0.width + 50),
                    0,
                    startPos.y + sp0.ny * (sp0.width + 50)
                );
                // Face the track — watching the players
                alpaca.rotation.y = Math.atan2(-sp0.ny, -sp0.nx);
                this.scene.add(alpaca);
            }
        }
        // DECORATION TASK 9 COMPLETE
    }

    // ==================== SNACK STATIONS ====================

    buildSnackStations(track) {
        if (!track.snackStations) return;

        this.stationRings = [];
        this.stationBags = [];
        this.stationVMs = [];

        const COLS = 7;
        const ROWS = 6;
        const BAG_SPACING_X = 3.5;
        const BAG_SPACING_Y = 5;
        const BAG_START_Y = 10;
        const BAG_FRONT_Z = 11;
        const BAG_SCALE = 1.0;

        for (let s = 0; s < track.snackStations.length; s++) {
            const station = track.snackStations[s];

            const vm = this.cloneModel('vendingMachine', 45);
            if (vm) {
                vm.position.set(station.x, 0, station.y);
                vm.rotation.y = Math.PI / 2;
                this.scene.add(vm);
            }
            this.stationVMs.push(vm);

            const bags = [];
            const vmRotY = Math.PI / 2;
            const fwdX = Math.sin(vmRotY);
            const fwdZ = Math.cos(vmRotY);
            const rightX = Math.cos(vmRotY);
            const rightZ = -Math.sin(vmRotY);

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

            // Main grid
            for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                    const lateralOffset = (col - (COLS - 1) / 2) * BAG_SPACING_X;
                    const heightOffset = BAG_START_Y + row * BAG_SPACING_Y;
                    makeBagPair(lateralOffset, heightOffset, BAG_SCALE);
                }
            }

            // Staggered second layer
            const COLS2 = COLS - 1;
            const ROWS2 = ROWS - 1;
            for (let row = 0; row < ROWS2; row++) {
                for (let col = 0; col < COLS2; col++) {
                    const lateralOffset = (col - (COLS2 - 1) / 2) * BAG_SPACING_X;
                    const heightOffset = BAG_START_Y + (row + 0.5) * BAG_SPACING_Y;
                    const frontBag = this.createSunChipsBag(BAG_SCALE * 0.85);
                    frontBag.visible = false;
                    frontBag.position.set(
                        station.x + fwdX * (BAG_FRONT_Z + 2.5) + rightX * lateralOffset,
                        heightOffset,
                        station.y + fwdZ * (BAG_FRONT_Z + 2.5) + rightZ * lateralOffset
                    );
                    frontBag.rotation.y = vmRotY + (Math.random() - 0.5) * 0.2;
                    frontBag.rotation.x = (Math.random() - 0.5) * 0.2;
                    frontBag.rotation.z = (Math.random() - 0.5) * 0.15;
                    this.scene.add(frontBag);

                    const backBag = this.createSunChipsBag(BAG_SCALE * 0.85);
                    backBag.visible = false;
                    backBag.position.set(
                        station.x - fwdX * (BAG_FRONT_Z + 2.5) + rightX * lateralOffset,
                        heightOffset,
                        station.y - fwdZ * (BAG_FRONT_Z + 2.5) + rightZ * lateralOffset
                    );
                    backBag.rotation.y = vmRotY + Math.PI + (Math.random() - 0.5) * 0.2;
                    backBag.rotation.x = (Math.random() - 0.5) * 0.2;
                    backBag.rotation.z = (Math.random() - 0.5) * 0.15;
                    this.scene.add(backBag);

                    bags.push({ front: frontBag, back: backBag });
                }
            }

            // Overflow on top
            const topY = BAG_START_Y + ROWS * BAG_SPACING_Y;
            for (let i = 0; i < 6; i++) {
                const lat = (Math.random() - 0.5) * (COLS * BAG_SPACING_X);
                const h = topY + Math.random() * 10;
                makeBagPair(lat, h, 0.8 + Math.random() * 0.3);
            }

            // Depth overflow
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

            // Floor bags
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 8;
                const floorFront = this.createSunChipsBag(0.65 + Math.random() * 0.2);
                floorFront.visible = false;
                floorFront.position.set(
                    station.x + Math.cos(angle) * dist,
                    1 + Math.random() * 3,
                    station.y + Math.sin(angle) * dist
                );
                floorFront.rotation.x = Math.PI * 0.4 + (Math.random() - 0.5) * 0.3;
                floorFront.rotation.y = Math.random() * Math.PI * 2;
                floorFront.rotation.z = (Math.random() - 0.5) * 0.5;
                this.scene.add(floorFront);
                bags.push({ front: floorFront, back: floorFront });
            }

            this.stationBags.push(bags);

            // Yellow ring on the floor
            const ringGeo = new THREE.RingGeometry(station.radius * 0.7, station.radius, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xFFD700, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(station.x, 0.5, station.y);
            this.scene.add(ring);
            this.stationRings.push(ring);
        }
    }

    updateStationFill(stationIndex, progress) {
        if (!this.stationBags || stationIndex < 0 || stationIndex >= this.stationBags.length) return;

        const bags = this.stationBags[stationIndex];
        const totalBags = bags.length;

        for (let i = 0; i < totalBags; i++) {
            const threshold = ((i + 1) / totalBags) * 100;
            const shouldShow = progress >= threshold;

            const pair = bags[i];
            if (shouldShow && !pair.front.visible) {
                for (const bag of [pair.front, pair.back]) {
                    bag.visible = true;
                    bag.userData.popTimer = 0.2;
                    bag.userData.baseScale = { x: bag.scale.x, y: bag.scale.y, z: bag.scale.z };
                    bag.scale.set(0.01, 0.01, 0.01);
                }
            }
        }
    }

    resetStationFill(stationIndex) {
        if (!this.stationBags || stationIndex < 0 || stationIndex >= this.stationBags.length) return;
        for (const pair of this.stationBags[stationIndex]) {
            pair.front.visible = false;
            pair.back.visible = false;
        }
    }

    // ==================== OBSTACLE KNOCKOVER SYSTEM ====================

    knockObstacle(obstacleData, vehicleHeading, vehicleSpeed) {
        obstacleData.knocked = true;

        const dirX = Math.cos(vehicleHeading);
        const dirZ = Math.sin(vehicleHeading);
        const knockSpeed = Math.min(vehicleSpeed * 0.4, 200);

        const spreadX = (Math.random() - 0.5) * 60;
        const spreadZ = (Math.random() - 0.5) * 60;

        obstacleData.velocity = {
            x: dirX * knockSpeed + spreadX,
            y: 40 + Math.random() * 40,
            z: dirZ * knockSpeed + spreadZ
        };

        obstacleData.angVel = {
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 6,
            z: (Math.random() - 0.5) * 8
        };

        // If this was an animated animal, trigger death animation
        const group = obstacleData.group;
        if (group.userData.mixer && group.userData.animations) {
            const deathClip = group.userData.animations.find(c =>
                c.name.toLowerCase().includes('death')
            );
            if (deathClip) {
                group.userData.mixer.stopAllAction();
                const action = group.userData.mixer.clipAction(deathClip);
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
                action.play();
            }
        }
    }

    updateKnockedObstacles(dt) {
        for (const obs of this.knockableObstacles) {
            if (!obs.knocked || obs.settled) continue;

            const g = obs.group;
            const v = obs.velocity;

            g.position.x += v.x * dt;
            g.position.y += v.y * dt;
            g.position.z += v.z * dt;

            v.y -= 120 * dt;

            g.rotation.x += obs.angVel.x * dt;
            g.rotation.y += obs.angVel.y * dt;
            g.rotation.z += obs.angVel.z * dt;

            if (g.position.y <= 0) {
                g.position.y = 0;

                if (Math.abs(v.y) < 20) {
                    v.x *= 0.7;
                    v.y = 0;
                    v.z *= 0.7;

                    obs.angVel.x *= 0.8;
                    obs.angVel.y *= 0.8;
                    obs.angVel.z *= 0.8;

                    const totalSpeed = Math.abs(v.x) + Math.abs(v.z);
                    const totalRot = Math.abs(obs.angVel.x) + Math.abs(obs.angVel.y) + Math.abs(obs.angVel.z);
                    if (totalSpeed < 5 && totalRot < 0.5) {
                        obs.settled = true;
                    }
                } else {
                    v.y = Math.abs(v.y) * 0.3;
                    v.x *= 0.8;
                    v.z *= 0.8;
                }
            }

            v.x *= (1 - 0.5 * dt);
            v.z *= (1 - 0.5 * dt);
        }
    }

    checkObstacleCollisions(vehicle) {
        const speed = Math.abs(vehicle.speed);
        if (speed < 5) return;

        const vx = vehicle.x;
        const vy = vehicle.y;
        const cartRadius = 18;

        for (const obs of this.knockableObstacles) {
            if (obs.knocked) continue;

            const dx = vx - obs.gameX;
            const dy = vy - obs.gameY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < cartRadius + obs.radius) {
                // Cows are solid — cart bounces off them hard
                const pushDist = (cartRadius + obs.radius) - dist + 5;
                const nx = dx / dist; // Normal from cow to cart
                const ny = dy / dist;

                // Push cart out of cow
                vehicle.x += nx * pushDist;
                vehicle.y += ny * pushDist;

                // Bounce the cart backward using its bounce system
                const bounceSpeed = Math.min(speed * 0.5, 150);
                vehicle.bounceVx = nx * bounceSpeed;
                vehicle.bounceVy = ny * bounceSpeed;
                vehicle.bounceDuration = 0.3;
                vehicle.speed *= 0.3; // Lose 70% speed on cow hit

                // Cow plays hit reaction but stays standing
                const group = obs.group;
                if (group.userData.mixer && group.userData.animations) {
                    const hitClip = group.userData.animations.find(c =>
                        c.name.toLowerCase().includes('hitreact')
                    );
                    if (hitClip) {
                        group.userData.mixer.stopAllAction();
                        const action = group.userData.mixer.clipAction(hitClip);
                        action.setLoop(THREE.LoopOnce);
                        action.clampWhenFinished = false;
                        action.timeScale = 1; // Full speed for reaction
                        action.play();
                        // Return to eating after hit reaction
                        const eatClip = group.userData.animations.find(c =>
                            c.name.toLowerCase().includes('eating')
                        );
                        if (eatClip) {
                            const eatAction = group.userData.mixer.clipAction(eatClip);
                            eatAction.timeScale = 0.5;
                            eatAction.play();
                            eatAction.enabled = true;
                            eatAction.weight = 0;
                            action.crossFadeTo(eatAction, hitClip.duration * 0.9, false);
                        }
                    }
                }

                this.triggerObstacleHitEffect(obs.gameX, obs.gameY);
                this.screenShake = { active: true, intensity: 3, timer: 0.25 };
                break; // Only handle one cow collision per frame
            }
        }
    }

    triggerObstacleHitEffect(worldX, worldY) {
        this.screenShake = { active: true, intensity: 1.5, timer: 0.15 };

        // Hay/straw particles instead of paper
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.PlaneGeometry(
                2 + Math.random() * 3,
                3 + Math.random() * 4
            );
            const mat = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.3 ? 0xDAA520 : 0xC4961A,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1
            });
            const straw = new THREE.Mesh(geo, mat);
            straw.position.set(worldX, 10 + Math.random() * 15, worldY);
            straw.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            this.scene.add(straw);

            const velocity = {
                x: (Math.random() - 0.5) * 60,
                y: 20 + Math.random() * 30,
                z: (Math.random() - 0.5) * 60
            };
            const rotSpeed = {
                x: (Math.random() - 0.5) * 6,
                y: (Math.random() - 0.5) * 3,
                z: (Math.random() - 0.5) * 5
            };

            this.particles.push(new Particle(straw, velocity, 1.2, rotSpeed));
        }
    }

    // ==================== CART SYSTEM ====================

    buildCart() {
        this.cartGroup = new THREE.Group();

        if (this.loadedModels.cart) {
            this.buildCartFromGLB();
        } else {
            this.buildProceduralCart();
        }

        this.addChipBagsToCargo();
        this.scene.add(this.cartGroup);
        this.deliveryAnimator.attachToCart(this.cartGroup);
    }

    buildCartFromGLB() {
        const cartModel = this.loadedModels.cart.clone();

        const unscaledBox = new THREE.Box3().setFromObject(cartModel);
        const unscaledSize = unscaledBox.getSize(new THREE.Vector3());

        const targetLength = 60;
        const scale = targetLength / Math.max(unscaledSize.x, unscaledSize.z);
        cartModel.scale.set(scale, scale, scale);

        cartModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const box = new THREE.Box3().setFromObject(cartModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        cartModel.position.x = -center.x;
        cartModel.position.y = -box.min.y;
        cartModel.position.z = -center.z;
        cartModel.rotation.y = 0;

        this.cartGroup.add(cartModel);
        this.cartModelHeight = size.y;
        this.cartModelLength = Math.max(size.x, size.z);
    }

    buildProceduralCart() {
        const m = this.materials;

        const body = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 36), m.whitePlastic);
        body.position.y = 12;
        body.castShadow = true;
        this.cartGroup.add(body);

        const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 2), m.chrome);
        frontBumper.position.set(0, 6, -18);
        this.cartGroup.add(frontBumper);

        const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 2), m.chrome);
        rearBumper.position.set(0, 6, 18);
        this.cartGroup.add(rearBumper);

        const roofTop = new THREE.Mesh(new THREE.BoxGeometry(24, 2, 34), m.golfCartGreen);
        roofTop.position.y = 30;
        roofTop.castShadow = true;
        this.cartGroup.add(roofTop);

        const postGeo = new THREE.CylinderGeometry(1, 1, 12, 8);
        for (const [px, py, pz] of [[-10, 24, -14], [10, 24, -14], [-10, 24, 14], [10, 24, 14]]) {
            const post = new THREE.Mesh(postGeo, m.chrome);
            post.position.set(px, py, pz);
            this.cartGroup.add(post);
        }

        const windshieldFrame = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 1), m.chrome);
        windshieldFrame.position.set(0, 25, -14);
        this.cartGroup.add(windshieldFrame);

        const windshield = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), m.clearGlass);
        windshield.position.set(0, 22, -14.5);
        windshield.rotation.x = 0.15;
        this.cartGroup.add(windshield);

        const seat = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 12), m.seatFabric);
        seat.position.set(0, 17, 2);
        seat.castShadow = true;
        this.cartGroup.add(seat);

        const seatBack = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 3), m.seatFabric);
        seatBack.position.set(0, 23, 9);
        seatBack.castShadow = true;
        this.cartGroup.add(seatBack);

        const steeringColumn = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 8), m.blackPlastic);
        steeringColumn.position.set(0, 20, -8);
        steeringColumn.rotation.x = -0.5;
        this.cartGroup.add(steeringColumn);

        const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(4, 0.5, 8, 16), m.blackPlastic);
        steeringWheel.position.set(0, 23, -10);
        steeringWheel.rotation.x = -0.5;
        this.cartGroup.add(steeringWheel);

        const dashboard = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 4), m.blackPlastic);
        dashboard.position.set(0, 17, -12);
        this.cartGroup.add(dashboard);

        const wheelGeo = new THREE.CylinderGeometry(5, 5, 3, 12);
        const hubcapGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.5, 12);
        for (const [wx, wy, wz] of [[-13, 5, -12], [13, 5, -12], [-13, 5, 12], [13, 5, 12]]) {
            const wheel = new THREE.Mesh(wheelGeo, m.blackPlastic);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wx, wy, wz);
            wheel.castShadow = true;
            this.cartGroup.add(wheel);

            const hubcap = new THREE.Mesh(hubcapGeo, m.chrome);
            hubcap.rotation.z = Math.PI / 2;
            hubcap.position.set(wx > 0 ? wx + 1.5 : wx - 1.5, wy, wz);
            this.cartGroup.add(hubcap);
        }

        const tailGeo = new THREE.BoxGeometry(3, 3, 1);
        const tailL = new THREE.Mesh(tailGeo, m.redTaillight);
        tailL.position.set(-9, 12, 18.5);
        this.cartGroup.add(tailL);
        const tailR = new THREE.Mesh(tailGeo, m.redTaillight);
        tailR.position.set(9, 12, 18.5);
        this.cartGroup.add(tailR);

        const headGeo = new THREE.CylinderGeometry(2, 2, 1, 12);
        const headL = new THREE.Mesh(headGeo, m.headlightGlow);
        headL.rotation.x = Math.PI / 2;
        headL.position.set(-8, 10, -18.5);
        this.cartGroup.add(headL);
        const headR = new THREE.Mesh(headGeo, m.headlightGlow);
        headR.rotation.x = Math.PI / 2;
        headR.position.set(8, 10, -18.5);
        this.cartGroup.add(headR);

        const bezelGeo = new THREE.TorusGeometry(2.2, 0.3, 8, 16);
        const bezelL = new THREE.Mesh(bezelGeo, m.chrome);
        bezelL.rotation.y = Math.PI / 2;
        bezelL.position.set(-8, 10, -18.6);
        this.cartGroup.add(bezelL);
        const bezelR = new THREE.Mesh(bezelGeo, m.chrome);
        bezelR.rotation.y = Math.PI / 2;
        bezelR.position.set(8, 10, -18.6);
        this.cartGroup.add(bezelR);

        const cargoBed = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 10), m.blackPlastic);
        cargoBed.position.set(0, 12, 14);
        this.cartGroup.add(cargoBed);

        this.cartModelHeight = 30;
        this.cartModelLength = 36;
    }

    createSunChipsBag(scale = 1) {
        const group = new THREE.Group();

        const bagGeo = new THREE.BoxGeometry(4 * scale, 6 * scale, 2 * scale);
        const bagMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.3, roughness: 0.4 });
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.castShadow = true;
        group.add(bag);

        const crimpGeo = new THREE.BoxGeometry(4 * scale, 0.5 * scale, 1.8 * scale);
        const crimpMat = new THREE.MeshStandardMaterial({ color: 0xCC9900, metalness: 0.2, roughness: 0.5 });
        const crimp = new THREE.Mesh(crimpGeo, crimpMat);
        crimp.position.y = 3.25 * scale;
        group.add(crimp);

        const stripeGeo = new THREE.BoxGeometry(4.1 * scale, 1.5 * scale, 0.1 * scale);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x228B22, metalness: 0.0, roughness: 0.6 });
        const stripeFront = new THREE.Mesh(stripeGeo, stripeMat);
        stripeFront.position.set(0, 0, 1.05 * scale);
        group.add(stripeFront);
        const stripeBack = new THREE.Mesh(stripeGeo, stripeMat);
        stripeBack.position.set(0, 0, -1.05 * scale);
        group.add(stripeBack);

        return group;
    }

    addChipBagsToCargo() {
        const cargoHeight = this.loadedModels.cart ? (this.cartModelHeight * 0.45) : 14;
        const cargoZ = this.loadedModels.cart ? -(this.cartModelLength * 0.5) : -16;

        const bagPositions = [
            { x: -5, y: cargoHeight, z: cargoZ, rot: 0.2, scale: 1 },
            { x: 0, y: cargoHeight, z: cargoZ - 1, rot: -0.15, scale: 1.05 },
            { x: 5, y: cargoHeight, z: cargoZ, rot: 0.35, scale: 0.95 },
            { x: -3, y: cargoHeight, z: cargoZ - 3, rot: -0.4, scale: 1 },
            { x: 3, y: cargoHeight, z: cargoZ - 3, rot: 0.5, scale: 0.9 },
            { x: 0, y: cargoHeight, z: cargoZ - 4, rot: 0.1, scale: 1.1 },
            { x: -2, y: cargoHeight + 4, z: cargoZ - 1, rot: -0.3, scale: 0.9 },
            { x: 2, y: cargoHeight + 4, z: cargoZ - 2, rot: 0.4, scale: 0.85 },
            { x: 0, y: cargoHeight + 4, z: cargoZ - 3, rot: -0.2, scale: 0.95 },
            { x: -4, y: cargoHeight + 4, z: cargoZ - 2, rot: 0.6, scale: 0.8 },
            { x: 4, y: cargoHeight + 4, z: cargoZ - 1, rot: -0.5, scale: 0.88 },
            { x: -1, y: cargoHeight + 7, z: cargoZ - 2, rot: 0.25, scale: 0.85 },
            { x: 1.5, y: cargoHeight + 7, z: cargoZ - 2.5, rot: -0.35, scale: 0.8 },
            { x: 0, y: cargoHeight + 9, z: cargoZ - 2, rot: 0.15, scale: 0.75 },
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

    // ==================== CAMERA ====================

    updateCamera(gameCamera) {
        // Camera sits behind and above the cart — no wall avoidance needed outdoors
        const camX = gameCamera.x - Math.cos(gameCamera.angle) * this.FOLLOW_DISTANCE;
        const camZ = gameCamera.y - Math.sin(gameCamera.angle) * this.FOLLOW_DISTANCE;

        this.camera.position.set(camX, this.CAMERA_HEIGHT, camZ);

        const lookX = gameCamera.x + Math.cos(gameCamera.angle) * this.LOOK_AHEAD;
        const lookZ = gameCamera.y + Math.sin(gameCamera.angle) * this.LOOK_AHEAD;
        this.camera.lookAt(lookX, 15, lookZ);

        // Screen shake
        if (this.screenShake.active) {
            this.camera.position.x += (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.y += (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.z += (Math.random() - 0.5) * this.screenShake.intensity;
        }
    }

    // ==================== PARTICLES ====================

    updateParticles(dt) {
        if (this.screenShake.active) {
            this.screenShake.timer -= dt;
            if (this.screenShake.timer <= 0) {
                this.screenShake.active = false;
                this.screenShake.intensity = 0;
            }
        }

        this.particles = this.particles.filter(p => {
            const alive = p.update(dt);
            if (!alive) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
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
        this.screenShake = { active: true, intensity: 3, timer: 0.25 };

        // Hay/straw particles (was paper)
        for (let i = 0; i < 5; i++) {
            const geo = new THREE.PlaneGeometry(3 + Math.random() * 4, 4 + Math.random() * 5);
            const mat = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.3 ? 0xDAA520 : 0xC4961A,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1
            });
            const straw = new THREE.Mesh(geo, mat);
            straw.position.set(worldX, 15 + Math.random() * 20, worldY);
            straw.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            this.scene.add(straw);

            const velocity = {
                x: (Math.random() - 0.5) * 100,
                y: 30 + Math.random() * 40,
                z: (Math.random() - 0.5) * 100
            };
            const rotSpeed = {
                x: (Math.random() - 0.5) * 8,
                y: (Math.random() - 0.5) * 4,
                z: (Math.random() - 0.5) * 6
            };

            this.particles.push(new Particle(straw, velocity, 1.5, rotSpeed));
        }

        // Sun Chips bag particles (kept)
        for (let i = 0; i < 3; i++) {
            const chipBag = this.createSunChipsBag(0.6 + Math.random() * 0.3);
            chipBag.position.set(
                worldX + (Math.random() - 0.5) * 10,
                18 + Math.random() * 15,
                worldY + (Math.random() - 0.5) * 10
            );
            chipBag.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
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

            this.particles.push(new ChipBagParticle(chipBag, velocity, 2.0, rotSpeed));
        }

        // Dust cloud
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.SphereGeometry(2 + Math.random() * 3, 6, 6);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x8B6914,
                transparent: true,
                opacity: 0.4
            });
            const dust = new THREE.Mesh(geo, mat);
            dust.position.set(
                worldX + (Math.random() - 0.5) * 20,
                3 + Math.random() * 8,
                worldY + (Math.random() - 0.5) * 20
            );
            this.scene.add(dust);
            this.particles.push(new Particle(dust, {
                x: (Math.random() - 0.5) * 30,
                y: 8 + Math.random() * 10,
                z: (Math.random() - 0.5) * 30
            }, 1.0));
        }

        while (this.particles.length > 50) {
            const oldest = this.particles.shift();
            this.scene.remove(oldest.mesh);
            if (oldest.mesh.geometry) oldest.mesh.geometry.dispose();
            if (oldest.mesh.material) oldest.mesh.material.dispose();
        }
    }

    triggerSkidEffect(worldX, worldY, heading) {
        const geo = new THREE.SphereGeometry(1.5, 4, 4);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x8B6914,  // Brown dirt dust (was gray)
            transparent: true,
            opacity: 0.5
        });
        const puff = new THREE.Mesh(geo, mat);

        const behindX = worldX - Math.cos(heading) * 20;
        const behindZ = worldY - Math.sin(heading) * 20;
        puff.position.set(
            behindX + (Math.random() - 0.5) * 10,
            2,
            behindZ + (Math.random() - 0.5) * 10
        );

        this.scene.add(puff);
        this.particles.push(new Particle(puff, { x: 0, y: 5 + Math.random() * 5, z: 0 }, 0.6));
    }

    triggerSplashEffect(worldX, worldY) {
        for (let i = 0; i < 4; i++) {
            const geo = new THREE.SphereGeometry(1.5 + Math.random() * 2, 4, 4);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x4488CC,
                transparent: true,
                opacity: 0.7,
            });
            const drop = new THREE.Mesh(geo, mat);
            drop.position.set(
                worldX + (Math.random() - 0.5) * 15,
                2,
                worldY + (Math.random() - 0.5) * 15
            );
            this.scene.add(drop);

            const velocity = {
                x: (Math.random() - 0.5) * 40,
                y: 20 + Math.random() * 30,
                z: (Math.random() - 0.5) * 40,
            };
            this.particles.push(new Particle(drop, velocity, 0.8));
        }
    }

    // ==================== MAIN UPDATE LOOP ====================

    update(vehicle, gameCamera, dt) {
        // Sync cart position and rotation
        this.cartGroup.position.x = vehicle.x;
        this.cartGroup.position.z = vehicle.y;
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

        // Animate chip bag pop-in
        if (this.stationBags) {
            for (const bags of this.stationBags) {
                for (const pair of bags) {
                    for (const bag of [pair.front, pair.back]) {
                        if (bag.visible && bag.userData.popTimer > 0) {
                            bag.userData.popTimer -= dt;
                            const t = 1 - Math.max(0, bag.userData.popTimer) / 0.2;
                            const ease = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5) : 1;
                            const bs = bag.userData.baseScale;
                            bag.scale.set(bs.x * ease, bs.y * ease, bs.z * ease);
                        }
                    }
                }
            }
        }

        // Skid/splash effects when turning hard at speed
        if (Math.abs(vehicle.steerState) > 0 && Math.abs(vehicle.speed) > 100) {
            if (Math.random() < 0.3) {
                if (vehicle.currentSurface === 'water') {
                    this.triggerSplashEffect(vehicle.x, vehicle.y);
                } else {
                    this.triggerSkidEffect(vehicle.x, vehicle.y, vehicle.heading);
                }
            }
        }

        // Update knocked-over obstacles physics
        this.updateKnockedObstacles(dt);

        // Check for obstacle knockovers
        this.checkObstacleCollisions(vehicle);

        // Animate water UV scroll for flowing creek effect
        if (this.waterTexture) {
            this.waterTexture.offset.x += 0.08 * dt;
            this.waterTexture.offset.y += 0.03 * dt;
        }

        // Update animal animation mixers
        for (const mixer of this.animalMixers) {
            mixer.update(dt);
        }

        // Update delivery animation
        this.deliveryAnimator.update(dt);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
