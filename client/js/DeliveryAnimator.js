// DeliveryAnimator.js - Manages animated characters during delivery sequence
// Characters exit cart, walk to station, stock chips (punch), walk to other side, get back in

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Animation sequence phases
const PHASE = {
    IDLE: 'idle',
    EXIT_CART: 'exit_cart',
    WALK_TO_STATION: 'walk_to_station',
    STOCKING: 'stocking',
    WALK_TO_SWAP: 'walk_to_swap',
    ENTER_CART: 'enter_cart',
    DONE: 'done'
};

export class DeliveryAnimator {
    constructor(scene) {
        this.scene = scene;

        // Character meshes and animation mixers
        this.characters = [null, null]; // [player1, player2]
        this.mixers = [null, null];
        this.animations = {}; // { idle, walk, punch, interact } clip references
        this.activeActions = [null, null];

        // Animation state
        this.phase = PHASE.IDLE;
        this.phaseTimer = 0;
        this.active = false;

        // Positions computed per-delivery
        this.cartPosition = new THREE.Vector3();
        this.cartHeading = 0;
        this.stationPosition = new THREE.Vector3();

        // Character waypoints (computed when delivery starts)
        this.waypoints = [[], []]; // per character
        this.waypointIndex = [0, 0];

        // Timing constants (seconds)
        this.EXIT_DURATION = 0.8;
        this.WALK_SPEED = 80; // units per second
        this.STOCK_DURATION = 0; // set dynamically based on mashing
        this.ENTER_DURATION = 0.8;

        // Loaded state
        this.loaded = false;

        // Character scale
        this.CHARACTER_SCALE = 30;

        // Skin textures for player differentiation
        this.skinTextures = [null, null];
    }

    async loadCharacter(fbxLoader, textureLoader) {
        try {
            // Load the character model
            const charModel = await this.loadFBX(fbxLoader, 'assets/kenney-animated/Models/characterMedium.fbx');

            // Load animation clips
            const [idleClip, walkClip, punchClip, interactClip] = await Promise.all([
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/idle.fbx'),
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/walk.fbx'),
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/punch.fbx'),
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/interactStanding.fbx'),
            ]);

            // Store animation clips
            if (idleClip.animations.length > 0) this.animations.idle = idleClip.animations[0];
            if (walkClip.animations.length > 0) this.animations.walk = walkClip.animations[0];
            if (punchClip.animations.length > 0) this.animations.punch = punchClip.animations[0];
            if (interactClip.animations.length > 0) this.animations.interact = interactClip.animations[0];

            // Load skin textures for the two players
            try {
                this.skinTextures[0] = await this.loadTexture(textureLoader, 'assets/kenney-animated/casualMaleA.png');
                this.skinTextures[1] = await this.loadTexture(textureLoader, 'assets/kenney-animated/casualFemaleA.png');
            } catch (e) {
                console.warn('Could not load skin textures:', e.message);
            }

            // Create two character instances (use SkeletonUtils for proper skeletal clone)
            for (let i = 0; i < 2; i++) {
                const clone = SkeletonUtils.clone(charModel);

                // Scale to game units
                const box = new THREE.Box3().setFromObject(clone);
                const size = box.getSize(new THREE.Vector3());
                const scale = this.CHARACTER_SCALE / size.y;
                clone.scale.set(scale, scale, scale);

                // Apply skin texture
                if (this.skinTextures[i]) {
                    clone.traverse((child) => {
                        if (child.isMesh) {
                            child.material = child.material.clone();
                            child.material.map = this.skinTextures[i];
                            child.material.needsUpdate = true;
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                } else {
                    // Fallback: tint characters different colors
                    const colors = [0x4488FF, 0xFF6644];
                    clone.traverse((child) => {
                        if (child.isMesh) {
                            child.material = child.material.clone();
                            child.material.color = new THREE.Color(colors[i]);
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }

                clone.visible = false;
                this.scene.add(clone);
                this.characters[i] = clone;

                // Create animation mixer for each character
                this.mixers[i] = new THREE.AnimationMixer(clone);
            }

            this.loaded = true;
            console.log('DeliveryAnimator: Characters and animations loaded');
        } catch (error) {
            console.warn('DeliveryAnimator: Could not load animated characters:', error.message);
            this.loaded = false;
        }
    }

    loadFBX(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(path, resolve, undefined, reject);
        });
    }

    loadTexture(loader, path) {
        return new Promise((resolve, reject) => {
            loader.load(path, resolve, undefined, reject);
        });
    }

    // Play a named animation on a character, crossfading from current
    playAnimation(charIndex, animName, loop = true) {
        if (!this.loaded || !this.animations[animName]) return;

        const mixer = this.mixers[charIndex];
        const clip = this.animations[animName];
        const newAction = mixer.clipAction(clip);

        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        if (!loop) {
            newAction.clampWhenFinished = true;
        }

        // Crossfade from previous action
        const prevAction = this.activeActions[charIndex];
        if (prevAction && prevAction !== newAction) {
            newAction.reset();
            newAction.play();
            prevAction.crossFadeTo(newAction, 0.2, true);
        } else {
            newAction.reset();
            newAction.play();
        }

        this.activeActions[charIndex] = newAction;
    }

    // Start the delivery animation sequence
    // cartPos: {x, y} game coords, cartHeading: radians, stationPos: {x, y}
    startDelivery(cartPos, cartHeading, stationPos) {
        if (!this.loaded) return;

        this.active = true;
        this.cartPosition.set(cartPos.x, 0, cartPos.y);
        this.cartHeading = cartHeading;
        this.stationPosition.set(stationPos.x, 0, stationPos.y);

        // Compute exit positions (left and right side of cart)
        // Cart's right vector (perpendicular to heading)
        const rightX = -Math.sin(cartHeading);
        const rightZ = Math.cos(cartHeading);
        // Cart's forward vector
        const fwdX = Math.cos(cartHeading);
        const fwdZ = Math.sin(cartHeading);

        // Side offset from cart center
        const sideOffset = 20;
        const exitOffset = 10; // How far to step away from cart

        // Player 1 exits left side, Player 2 exits right side
        const p1ExitSide = {
            x: cartPos.x - rightX * sideOffset,
            z: cartPos.y - rightZ * sideOffset
        };
        const p2ExitSide = {
            x: cartPos.x + rightX * sideOffset,
            z: cartPos.y + rightZ * sideOffset
        };

        // Step further away from cart
        const p1ExitFinal = {
            x: p1ExitSide.x - rightX * exitOffset,
            z: p1ExitSide.z - rightZ * exitOffset
        };
        const p2ExitFinal = {
            x: p2ExitSide.x + rightX * exitOffset,
            z: p2ExitSide.z + rightZ * exitOffset
        };

        // Station approach points (slightly in front of station)
        const toStation1 = this.normalizeXZ(
            stationPos.x - p1ExitFinal.x,
            stationPos.y - p1ExitFinal.z
        );
        const toStation2 = this.normalizeXZ(
            stationPos.x - p2ExitFinal.x,
            stationPos.y - p2ExitFinal.z
        );

        const stationApproach = 25; // Stop this far from station center
        const p1StationPos = {
            x: stationPos.x - toStation1.x * stationApproach - rightX * 8,
            z: stationPos.y - toStation1.z * stationApproach - rightZ * 8
        };
        const p2StationPos = {
            x: stationPos.x - toStation2.x * stationApproach + rightX * 8,
            z: stationPos.y - toStation2.z * stationApproach + rightZ * 8
        };

        // After stocking, they swap sides to enter the cart
        // Player 1 enters right side (was left), Player 2 enters left side (was right)
        const p1EnterSide = {
            x: cartPos.x + rightX * sideOffset,
            z: cartPos.y + rightZ * sideOffset
        };
        const p2EnterSide = {
            x: cartPos.x - rightX * sideOffset,
            z: cartPos.y - rightZ * sideOffset
        };

        // Build waypoint sequences
        // Each waypoint: { x, z, anim, duration (optional, for timed phases) }
        this.waypoints[0] = [
            { x: p1ExitSide.x, z: p1ExitSide.z, anim: 'walk' },
            { x: p1ExitFinal.x, z: p1ExitFinal.z, anim: 'walk' },
            { x: p1StationPos.x, z: p1StationPos.z, anim: 'walk' },
            { x: p1StationPos.x, z: p1StationPos.z, anim: 'punch', hold: true }, // hold until stocking done
            { x: p1EnterSide.x, z: p1EnterSide.z, anim: 'walk' },
            { x: cartPos.x + rightX * 5, z: cartPos.y + rightZ * 5, anim: 'walk' }, // enter cart position
        ];

        this.waypoints[1] = [
            { x: p2ExitSide.x, z: p2ExitSide.z, anim: 'walk' },
            { x: p2ExitFinal.x, z: p2ExitFinal.z, anim: 'walk' },
            { x: p2StationPos.x, z: p2StationPos.z, anim: 'walk' },
            { x: p2StationPos.x, z: p2StationPos.z, anim: 'punch', hold: true }, // hold until stocking done
            { x: p2EnterSide.x, z: p2EnterSide.z, anim: 'walk' },
            { x: cartPos.x - rightX * 5, z: cartPos.y - rightZ * 5, anim: 'walk' }, // enter cart position
        ];

        this.waypointIndex = [0, 0];
        this.phase = PHASE.EXIT_CART;
        this.phaseTimer = 0;
        this.stockingComplete = false;

        // Position characters at cart center initially, make visible
        for (let i = 0; i < 2; i++) {
            if (this.characters[i]) {
                this.characters[i].position.set(cartPos.x, 0, cartPos.y);
                this.characters[i].visible = true;
                this.playAnimation(i, 'walk');
            }
        }
    }

    normalizeXZ(x, z) {
        const len = Math.sqrt(x * x + z * z);
        if (len < 0.001) return { x: 0, z: 0 };
        return { x: x / len, z: z / len };
    }

    // Called when delivery progress hits 100% - characters should finish stocking
    onStockingComplete() {
        this.stockingComplete = true;
    }

    // Update the animation each frame
    // Returns true if the full sequence is still running
    update(dt) {
        if (!this.active || !this.loaded) return false;

        // Update animation mixers
        for (let i = 0; i < 2; i++) {
            if (this.mixers[i]) {
                this.mixers[i].update(dt);
            }
        }

        // Move characters toward their current waypoint
        let allDone = true;
        for (let i = 0; i < 2; i++) {
            if (!this.characters[i]) continue;

            const wp = this.waypoints[i];
            const idx = this.waypointIndex[i];

            if (idx >= wp.length) {
                // This character is done
                continue;
            }

            allDone = false;
            const target = wp[idx];
            const char = this.characters[i];
            const pos = char.position;

            // If this is a hold waypoint (stocking), wait until stocking is complete
            if (target.hold && !this.stockingComplete) {
                // Keep playing the stocking animation, don't advance
                if (this.activeActions[i] === null ||
                    !this.animations.punch ||
                    this.activeActions[i]._clip !== this.animations.punch) {
                    this.playAnimation(i, 'punch', true);
                }
                // Face the station
                this.faceToward(char, this.stationPosition.x, this.stationPosition.z);
                continue;
            }

            // If hold waypoint and stocking is done, advance
            if (target.hold && this.stockingComplete) {
                this.waypointIndex[i]++;
                if (this.waypointIndex[i] < wp.length) {
                    this.playAnimation(i, wp[this.waypointIndex[i]].anim || 'walk');
                }
                continue;
            }

            // Move toward target position
            const dx = target.x - pos.x;
            const dz = target.z - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 3) {
                // Reached waypoint, advance
                pos.x = target.x;
                pos.z = target.z;
                this.waypointIndex[i]++;

                if (this.waypointIndex[i] < wp.length) {
                    const nextWp = wp[this.waypointIndex[i]];
                    this.playAnimation(i, nextWp.anim || 'walk', nextWp.hold || nextWp.anim === 'punch');
                }
            } else {
                // Walk toward target
                const moveSpeed = this.WALK_SPEED * dt;
                const moveX = (dx / dist) * Math.min(moveSpeed, dist);
                const moveZ = (dz / dist) * Math.min(moveSpeed, dist);
                pos.x += moveX;
                pos.z += moveZ;

                // Face movement direction
                this.faceToward(char, target.x, target.z);

                // Make sure walk animation is playing
                if (!this.activeActions[i] ||
                    !this.animations.walk ||
                    (this.activeActions[i]._clip !== this.animations.walk && target.anim === 'walk')) {
                    this.playAnimation(i, 'walk');
                }
            }
        }

        // Check if both characters have completed all waypoints
        const char0Done = this.waypointIndex[0] >= this.waypoints[0].length;
        const char1Done = this.waypointIndex[1] >= this.waypoints[1].length;

        if (char0Done && char1Done) {
            this.finish();
            return false;
        }

        return true;
    }

    faceToward(char, targetX, targetZ) {
        const dx = targetX - char.position.x;
        const dz = targetZ - char.position.z;
        if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
            char.rotation.y = Math.atan2(dx, dz);
        }
    }

    // End the animation, hide characters
    finish() {
        this.active = false;
        this.phase = PHASE.DONE;

        for (let i = 0; i < 2; i++) {
            if (this.characters[i]) {
                this.characters[i].visible = false;
            }
            if (this.activeActions[i]) {
                this.activeActions[i].stop();
                this.activeActions[i] = null;
            }
        }
    }

    // Abort the animation early (e.g., if player drives away)
    abort() {
        this.finish();
    }
}
