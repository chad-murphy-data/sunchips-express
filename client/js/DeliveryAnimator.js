// DeliveryAnimator.js - Manages animated characters during delivery sequence
// Characters sit in cart while driving, exit cart, walk to station,
// stock chips (punch), walk to opposite side, get back in (role swap)

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class DeliveryAnimator {
    constructor(scene) {
        this.scene = scene;

        // Character meshes and animation mixers
        this.characters = [null, null]; // [player1, player2]
        this.mixers = [null, null];
        this.animations = {}; // { idle, walk, punch, racingIdle } clip references
        this.activeActions = [null, null];

        // The cart group reference (set externally after cart is built)
        this.cartGroup = null;

        // Delivery animation state
        this.active = false; // true when delivery walk sequence is running
        this.stockingComplete = false;

        // Positions computed per-delivery
        this.cartPosition = new THREE.Vector3();
        this.cartHeading = 0;
        this.stationPosition = new THREE.Vector3();

        // Character waypoints (computed when delivery starts)
        this.waypoints = [[], []]; // per character
        this.waypointIndex = [0, 0];

        // Constants
        this.WALK_SPEED = 80; // units per second
        this.CHARACTER_SCALE = 30;

        // Seat positions in cart local space
        // Cart faces -Z; left seat is -X, right seat is +X
        // GLB cart: seat height ~45% of cart height, seat Z ~ forward area
        this.seatPositions = [
            new THREE.Vector3(-6, 11, 4),  // Player 1 - left seat (driver side)
            new THREE.Vector3(6, 11, 4),   // Player 2 - right seat (passenger side)
        ];
        // Which seat each player is in (swaps after each delivery)
        this.seatAssignment = [0, 1]; // player 0 in seat 0, player 1 in seat 1

        // Skin textures for player differentiation
        this.skinTextures = [null, null];

        // Loaded state
        this.loaded = false;
    }

    async loadCharacter(fbxLoader, textureLoader) {
        try {
            // Load the character model
            const charModel = await this.loadFBX(fbxLoader, 'assets/kenney-animated/Models/characterMedium.fbx');

            // Load animation clips
            const [idleClip, walkClip, punchClip, racingIdleClip] = await Promise.all([
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/idle.fbx'),
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/walk.fbx'),
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/punch.fbx'),
                this.loadFBX(fbxLoader, 'assets/kenney-animated/Animations/racingIdle.fbx'),
            ]);

            // Store animation clips
            if (idleClip.animations.length > 0) this.animations.idle = idleClip.animations[0];
            if (walkClip.animations.length > 0) this.animations.walk = walkClip.animations[0];
            if (punchClip.animations.length > 0) this.animations.punch = punchClip.animations[0];
            if (racingIdleClip.animations.length > 0) this.animations.racingIdle = racingIdleClip.animations[0];

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

                clone.visible = true;
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

    // Called after the cart group is built — attaches characters as children of the cart
    attachToCart(cartGroup) {
        if (!this.loaded) return;

        this.cartGroup = cartGroup;

        for (let i = 0; i < 2; i++) {
            if (!this.characters[i]) continue;

            // Add as child of cart group so they move/rotate with the cart
            cartGroup.add(this.characters[i]);

            // Position on their assigned seat
            const seatIdx = this.seatAssignment[i];
            const seat = this.seatPositions[seatIdx];
            this.characters[i].position.copy(seat);

            // Face forward in the cart
            this.characters[i].rotation.y = 0;

            // Play seated animation
            this.playAnimation(i, 'racingIdle');
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

    // Detach a character from cart group into world (scene) space
    detachFromCart(charIndex) {
        const char = this.characters[charIndex];
        if (!char || !this.cartGroup) return;

        // Get world position & rotation before detaching
        const worldPos = new THREE.Vector3();
        char.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        char.getWorldQuaternion(worldQuat);

        // Remove from cart, add to scene
        this.cartGroup.remove(char);
        this.scene.add(char);

        // Restore world transform
        char.position.copy(worldPos);
        char.quaternion.copy(worldQuat);
    }

    // Re-attach a character from world space back into the cart group
    reattachToCart(charIndex, seatIdx) {
        const char = this.characters[charIndex];
        if (!char || !this.cartGroup) return;

        // Remove from scene, add to cart
        this.scene.remove(char);
        this.cartGroup.add(char);

        // Position on the assigned seat
        const seat = this.seatPositions[seatIdx];
        char.position.copy(seat);
        char.rotation.set(0, 0, 0); // face forward

        // Update seat assignment
        this.seatAssignment[charIndex] = seatIdx;
    }

    // Start the delivery animation sequence
    // cartPos: {x, y} game coords, cartHeading: radians, stationPos: {x, y}
    startDelivery(cartPos, cartHeading, stationPos) {
        if (!this.loaded) return;

        this.active = true;
        this.cartPosition.set(cartPos.x, 0, cartPos.y);
        this.cartHeading = cartHeading;
        this.stationPosition.set(stationPos.x, 0, stationPos.y);
        this.stockingComplete = false;

        // Detach both characters from cart into world space
        for (let i = 0; i < 2; i++) {
            this.detachFromCart(i);
        }

        // Compute exit positions (left and right side of cart)
        const rightX = -Math.sin(cartHeading);
        const rightZ = Math.cos(cartHeading);

        const sideOffset = 20;
        const exitOffset = 10;

        // Player in left seat (seat 0) exits left, player in right seat (seat 1) exits right
        const exitSides = [];
        for (let i = 0; i < 2; i++) {
            const onLeft = this.seatAssignment[i] === 0;
            const sign = onLeft ? -1 : 1;
            exitSides.push({
                x: cartPos.x + sign * rightX * sideOffset,
                z: cartPos.y + sign * rightZ * sideOffset
            });
        }

        const exitFinals = exitSides.map((side, i) => {
            const onLeft = this.seatAssignment[i] === 0;
            const sign = onLeft ? -1 : 1;
            return {
                x: side.x + sign * rightX * exitOffset,
                z: side.z + sign * rightZ * exitOffset
            };
        });

        // Station approach points
        const stationApproach = 25;
        const stationPositions = exitFinals.map((ef, i) => {
            const dir = this.normalizeXZ(stationPos.x - ef.x, stationPos.y - ef.z);
            const lateralSign = (i === 0) ? -1 : 1;
            return {
                x: stationPos.x - dir.x * stationApproach + lateralSign * rightX * 8,
                z: stationPos.y - dir.z * stationApproach + lateralSign * rightZ * 8
            };
        });

        // After stocking, they swap sides!
        // Player who was in seat 0 goes to seat 1's side, and vice versa
        const enterSides = [];
        for (let i = 0; i < 2; i++) {
            const newSeat = this.seatAssignment[i] === 0 ? 1 : 0; // SWAP
            const sign = newSeat === 0 ? -1 : 1;
            enterSides.push({
                x: cartPos.x + sign * rightX * sideOffset,
                z: cartPos.y + sign * rightZ * sideOffset,
                newSeat: newSeat
            });
        }

        // Build waypoint sequences
        for (let i = 0; i < 2; i++) {
            this.waypoints[i] = [
                { x: exitSides[i].x, z: exitSides[i].z, anim: 'walk' },
                { x: exitFinals[i].x, z: exitFinals[i].z, anim: 'walk' },
                { x: stationPositions[i].x, z: stationPositions[i].z, anim: 'walk' },
                { x: stationPositions[i].x, z: stationPositions[i].z, anim: 'punch', hold: true },
                { x: enterSides[i].x, z: enterSides[i].z, anim: 'walk' },
                { x: cartPos.x + (enterSides[i].newSeat === 0 ? -1 : 1) * rightX * 5,
                  z: cartPos.y + (enterSides[i].newSeat === 0 ? -1 : 1) * rightZ * 5,
                  anim: 'walk', enterSeat: enterSides[i].newSeat },
            ];
        }

        this.waypointIndex = [0, 0];

        // Start walk animation
        for (let i = 0; i < 2; i++) {
            if (this.characters[i]) {
                this.playAnimation(i, 'walk');
            }
        }
    }

    normalizeXZ(x, z) {
        const len = Math.sqrt(x * x + z * z);
        if (len < 0.001) return { x: 0, z: 0 };
        return { x: x / len, z: z / len };
    }

    // Called when delivery progress hits 100%
    onStockingComplete() {
        this.stockingComplete = true;
    }

    // Update the animation each frame — always call this (handles seated animation too)
    update(dt) {
        if (!this.loaded) return false;

        // Always update animation mixers (for seated idle animation)
        for (let i = 0; i < 2; i++) {
            if (this.mixers[i]) {
                this.mixers[i].update(dt);
            }
        }

        // If no delivery is active, nothing else to do
        if (!this.active) return false;

        // Move characters toward their current waypoint
        for (let i = 0; i < 2; i++) {
            if (!this.characters[i]) continue;

            const wp = this.waypoints[i];
            const idx = this.waypointIndex[i];

            if (idx >= wp.length) continue; // done

            const target = wp[idx];
            const char = this.characters[i];
            const pos = char.position;

            // Hold waypoint (stocking) — wait until complete
            if (target.hold && !this.stockingComplete) {
                if (this.activeActions[i] === null ||
                    !this.animations.punch ||
                    this.activeActions[i]._clip !== this.animations.punch) {
                    this.playAnimation(i, 'punch', true);
                }
                this.faceToward(char, this.stationPosition.x, this.stationPosition.z);
                continue;
            }

            if (target.hold && this.stockingComplete) {
                this.waypointIndex[i]++;
                if (this.waypointIndex[i] < wp.length) {
                    this.playAnimation(i, wp[this.waypointIndex[i]].anim || 'walk');
                }
                continue;
            }

            // Move toward target
            const dx = target.x - pos.x;
            const dz = target.z - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 3) {
                pos.x = target.x;
                pos.z = target.z;
                this.waypointIndex[i]++;

                if (this.waypointIndex[i] < wp.length) {
                    const nextWp = wp[this.waypointIndex[i]];
                    this.playAnimation(i, nextWp.anim || 'walk', nextWp.hold || nextWp.anim === 'punch');
                }
            } else {
                const moveSpeed = this.WALK_SPEED * dt;
                const moveX = (dx / dist) * Math.min(moveSpeed, dist);
                const moveZ = (dz / dist) * Math.min(moveSpeed, dist);
                pos.x += moveX;
                pos.z += moveZ;

                this.faceToward(char, target.x, target.z);

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
            this.finishDelivery();
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

    // Finish delivery: re-attach characters to cart at swapped seats
    finishDelivery() {
        this.active = false;

        for (let i = 0; i < 2; i++) {
            if (!this.characters[i]) continue;

            // Determine the new seat from the last waypoint
            const lastWp = this.waypoints[i][this.waypoints[i].length - 1];
            const newSeat = lastWp && lastWp.enterSeat !== undefined ? lastWp.enterSeat : this.seatAssignment[i];

            // Re-attach to cart at the new (swapped) seat
            this.reattachToCart(i, newSeat);

            // Play seated animation
            this.playAnimation(i, 'racingIdle');
        }
    }

    // Abort the animation early
    abort() {
        this.active = false;

        for (let i = 0; i < 2; i++) {
            if (!this.characters[i]) continue;

            // If currently in world space, re-attach to cart
            if (this.characters[i].parent === this.scene) {
                this.reattachToCart(i, this.seatAssignment[i]);
            }

            this.playAnimation(i, 'racingIdle');
        }
    }
}
