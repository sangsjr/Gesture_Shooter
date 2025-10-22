// Constants for core.js
const COLLISION_EPSILON = 0.001;
const INPUT_DEADZONE = 0.1;
const IMG_DIR = 'assets/images/';

// Image loading system
export class ImageLoader {
    constructor() {
        this.images = new Map();
        this.loadPromises = new Map();
    }
    
    loadImage(name, filename) {
        if (this.images.has(name)) {
            return Promise.resolve(this.images.get(name));
        }
        
        if (this.loadPromises.has(name)) {
            return this.loadPromises.get(name);
        }
        
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(name, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${filename}`);
                reject(new Error(`Failed to load image: ${filename}`));
            };
            img.src = IMG_DIR + filename;
        });
        
        this.loadPromises.set(name, promise);
        return promise;
    }
    
    loadImages(imageMap) {
        const promises = Object.entries(imageMap).map(([name, filename]) => 
            this.loadImage(name, filename).catch(() => null) // Don't fail on individual image errors
        );
        return Promise.all(promises);
    }
    
    getImage(name) {
        return this.images.get(name) || null;
    }
    
    hasImage(name) {
        return this.images.has(name);
    }
}

// Utility functions
export const Utils = {
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    normalize(x, y) {
        const length = Math.sqrt(x * x + y * y);
        if (length === 0) return { x: 0, y: 0 };
        return { x: x / length, y: y / length };
    },
    
    randomRange(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

// Event Bus for decoupled communication
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }
    
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }
    
    clear() {
        this.listeners.clear();
    }
}

// Circle-vs-circle collision detection
export class CollisionSystem {
    static checkCircleCollision(obj1, obj2) {
        const dx = obj2.x - obj1.x;
        const dy = obj2.y - obj1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = obj1.radius + obj2.radius;
        
        return distance < minDistance + COLLISION_EPSILON;
    }
    
    static getCollisionInfo(obj1, obj2) {
        const dx = obj2.x - obj1.x;
        const dy = obj2.y - obj1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = obj1.radius + obj2.radius;
        
        if (distance >= minDistance + COLLISION_EPSILON) {
            return null;
        }
        
        const overlap = minDistance - distance;
        const normalX = distance > 0 ? dx / distance : 1;
        const normalY = distance > 0 ? dy / distance : 0;
        
        return {
            overlap,
            normalX,
            normalY,
            distance
        };
    }
}

// Input Manager with pluggable providers
export class InputManager {
    constructor() {
        this.providers = new Map();
        this.activeProvider = null;
        this.fallbackProvider = null;
        
        // Input state
        this.moveVector = { x: 0, y: 0 };
        this.fire = false;
        this.pickup = false; // Placeholder for Step 1
        this.switchWeapon = false;
        this.lastWeaponSwitchTime = 0;
        this.weaponSwitchCooldown = 0.2; // 200ms cooldown between switches
        this.creatorMode = false;
        this.lastCreatorModeToggleTime = 0;
        this.creatorModeToggleCooldown = 0.2; // 200ms cooldown between toggles
        
        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
    }
    
    registerProvider(name, provider, isFallback = false) {
        this.providers.set(name, provider);
        provider.inputManager = this;
        
        if (isFallback) {
            this.fallbackProvider = provider;
        }
        
        if (!this.activeProvider) {
            this.setActiveProvider(name);
        }
    }
    
    setActiveProvider(name) {
        const provider = this.providers.get(name);
        if (provider) {
            if (this.activeProvider) {
                this.activeProvider.deactivate?.();
            }
            this.activeProvider = provider;
            this.activeProvider.activate?.();
        }
    }
    
    update(deltaTime) {
        if (this.activeProvider) {
            try {
                this.activeProvider.update(deltaTime);
            } catch (error) {
                console.warn('Input provider failed, falling back:', error);
                this.fallbackToDefault();
            }
        }
    }
    
    clearWeaponSwitch() {
        console.log('🧹 InputManager.clearWeaponSwitch() called, was:', this.switchWeapon);
        this.switchWeapon = false;
        this.lastWeaponSwitchTime = Date.now() / 1000;
        console.log('🧹 Weapon switch cleared, lastSwitchTime updated to:', this.lastWeaponSwitchTime);
    }

    clearCreatorModeToggle() {
        this.creatorMode = false;
        this.lastCreatorModeToggleTime = Date.now() / 1000;
    }
    
    canSwitchWeapon() {
        const now = Date.now() / 1000;
        return (now - this.lastWeaponSwitchTime) >= this.weaponSwitchCooldown;
    }

    canToggleCreatorMode() {
        const now = Date.now() / 1000;
        return (now - this.lastCreatorModeToggleTime) >= this.creatorModeToggleCooldown;
    }
    
    fallbackToDefault() {
        if (this.fallbackProvider && this.activeProvider !== this.fallbackProvider) {
            this.setActiveProvider(this.fallbackProvider.name);
        }
    }
    
    // Public API for game logic
    getMoveVector() {
        return { ...this.moveVector };
    }
    
    isFiring() {
        return this.fire;
    }
    
    isPickingUp() {
        return this.pickup; // No-op placeholder for Step 1
    }
    
    getWeaponSwitch() {
        console.log('📊 InputManager.getWeaponSwitch() called, returning:', this.switchWeapon);
        return this.switchWeapon;
    }

    getCreatorModeToggle() {
        return this.creatorMode;
    }
    
    getMousePosition() {
        return { x: this.mouseX, y: this.mouseY };
    }
}

// Keyboard/Mouse Provider (implemented)
export class KeyboardMouseProvider {
    constructor(canvas) {
        this.name = 'keyboard-mouse';
        this.canvas = canvas;
        this.inputManager = null;
        
        this.keys = new Set();
        this.mouseButtons = new Set();
        
        // Key mappings
        this.keyMap = {
            'KeyW': 'up',
            'KeyS': 'down',
            'KeyA': 'left',
            'KeyD': 'right',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'KeyR': 'switchWeapon',
            'KeyG': 'creatorMode',
            'KeyF': 'pickup'
        };
        
        this.boundHandlers = {
            keydown: this.handleKeyDown.bind(this),
            keyup: this.handleKeyUp.bind(this),
            mousedown: this.handleMouseDown.bind(this),
            mouseup: this.handleMouseUp.bind(this),
            mousemove: this.handleMouseMove.bind(this),
            contextmenu: this.handleContextMenu.bind(this)
        };
    }
    
    activate() {
        console.log('=== ACTIVATING KeyboardMouseProvider ===');
        console.log('Canvas element:', this.canvas);
        console.log('Document ready state:', document.readyState);
        console.log('Key mappings:', this.keyMap);
        
        Object.entries(this.boundHandlers).forEach(([event, handler]) => {
            if (event === 'mousemove' || event === 'mousedown' || event === 'mouseup' || event === 'contextmenu') {
                this.canvas.addEventListener(event, handler);
                console.log('✓ Added canvas listener for:', event);
            } else {
                document.addEventListener(event, handler);
                console.log('✓ Added document listener for:', event);
            }
        });
        
        // Test canvas focus
        console.log('Canvas focused:', document.activeElement === this.canvas);
        console.log('Canvas tabIndex:', this.canvas.tabIndex);
        
        // Force focus on canvas
        if (this.canvas.tabIndex >= 0) {
            this.canvas.focus();
            console.log('Canvas focus forced');
        }
    }
    
    deactivate() {
        Object.entries(this.boundHandlers).forEach(([event, handler]) => {
            if (event === 'mousemove' || event === 'mousedown' || event === 'mouseup' || event === 'contextmenu') {
                this.canvas.removeEventListener(event, handler);
            } else {
                document.removeEventListener(event, handler);
            }
        });
    }
    
    update(deltaTime) {
        if (!this.inputManager) return;
        
        // Update move vector
        let x = 0, y = 0;
        if (this.keys.has('left')) x -= 1;
        if (this.keys.has('right')) x += 1;
        if (this.keys.has('up')) y -= 1;
        if (this.keys.has('down')) y += 1;
        
        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }
        
        this.inputManager.moveVector.x = x;
        this.inputManager.moveVector.y = y;
        this.inputManager.fire = this.mouseButtons.has(0); // Left mouse button
        // pickup action (F key)
        this.inputManager.pickup = this.keys.has('pickup');
    }
    
    handleKeyDown(event) {
        console.log('RAW KEY EVENT:', event.code, event.key, 'Target:', event.target.tagName);
        const action = this.keyMap[event.code];
        console.log('Key pressed:', event.code, 'Action:', action);
        if (action) {
            if (action === 'switchWeapon') {
                console.log('Switch weapon triggered, current state:', this.inputManager.switchWeapon, 'Can switch:', this.inputManager.canSwitchWeapon());
                // Only trigger if not already set and cooldown has passed
                if (!this.inputManager.switchWeapon && this.inputManager.canSwitchWeapon()) {
                    this.inputManager.switchWeapon = true;
                    console.log('Weapon switch flag set to true');
                }
            } else if (action === 'creatorMode') {
                // Only trigger if not already set and cooldown has passed
                if (!this.inputManager.creatorMode && this.inputManager.canToggleCreatorMode()) {
                    this.inputManager.creatorMode = true;
                    console.log('Creator mode toggle flag set to true');
                }
            } else {
                this.keys.add(action);
                // Immediate propagate pickup press for responsiveness
                if (action === 'pickup' && this.inputManager) {
                    this.inputManager.pickup = true;
                }
            }
            event.preventDefault();
        }
    }
    
    handleKeyUp(event) {
        const action = this.keyMap[event.code];
        if (action && action !== 'switchWeapon' && action !== 'creatorMode') {
            this.keys.delete(action);
            // Immediate clear pickup flag on release
            if (action === 'pickup' && this.inputManager) {
                this.inputManager.pickup = false;
            }
            event.preventDefault();
        }
    }
    
    handleMouseDown(event) {
        this.mouseButtons.add(event.button);
        event.preventDefault();
    }
    
    handleMouseUp(event) {
        this.mouseButtons.delete(event.button);
        event.preventDefault();
    }
    
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.inputManager.mouseX = (event.clientX - rect.left) * scaleX;
        this.inputManager.mouseY = (event.clientY - rect.top) * scaleY;
    }
    
    handleContextMenu(event) {
        event.preventDefault();
    }
}

// Gesture Provider (stub)
export class GestureProvider {
    constructor() {
        this.name = 'gesture';
        this.inputManager = null;
    }
    
    activate() {
        // TODO: Implement gesture recognition
        console.log('Gesture provider activated (stub)');
    }
    
    deactivate() {
        // TODO: Cleanup gesture listeners
        console.log('Gesture provider deactivated (stub)');
    }
    
    update(deltaTime) {
        // TODO: Process gesture input
        if (this.inputManager) {
            this.inputManager.moveVector.x = 0;
            this.inputManager.moveVector.y = 0;
            this.inputManager.fire = false;
        }
    }
}

// Voice Provider (stub)
export class VoiceProvider {
    constructor() {
        this.name = 'voice';
        this.inputManager = null;
    }
    
    activate() {
        // TODO: Initialize speech recognition
        console.log('Voice provider activated (stub)');
    }
    
    deactivate() {
        // TODO: Stop speech recognition
        console.log('Voice provider deactivated (stub)');
    }
    
    update(deltaTime) {
        // TODO: Process voice commands
        if (this.inputManager) {
            this.inputManager.moveVector.x = 0;
            this.inputManager.moveVector.y = 0;
            this.inputManager.fire = false;
        }
    }
}

// SOUND MANAGER
export class SoundManager {
    constructor() {
        this.sounds = {};
    }

    load(name, path, volume = 0.5) {
        const audio = new Audio(path);
        audio.volume = volume;
        this.sounds[name] = audio;
    }

    play(name) {
        const sound = this.sounds[name];
        if (sound) {
            const clone = sound.cloneNode(true);
            clone.volume = sound.volume;
            clone.play();
        } else {
            console.warn('Sound not found:', name);
        }
    }
}

// GestureInputManager: Controls player movement using left-hand index finger gestures.
// Works with Mediapipe Hands and supports mirrored webcam input.
export class GestureInputManager {
    constructor() {
        this.moveVector = { x: 0, y: 0 };
        this.initialized = false;
        this.videoElement = null;
        this.hands = null;

        // Normalized screen center (used as reference point)
        this.center = { x: 0.8, y: 0.6 };
        
        // Overlay for drawing movement vector
        this.overlayCanvas = null;
        this.overlayCtx = null;
        
        // Track left hand presence independently
        this.leftHandPresent = false;
        this.arenaWidth = null;
        this.arenaHeight = null;
        
        // Gesture aiming smooth parameters
        this.aimSmoothingAlpha = 0.4;
        this.aimDeadzonePx = 6;
        this.aimMaxStepPx = 10000;
        this.gestureAimSmoothed = null;
        
        // Right hand pinch judgment (index finger and thumb)
        this.rightPinchActive = false;
        this.rightPinchOnThreshold = 0.04;   // Enter the Molding Threshold (Normalized Distance)
        this.rightPinchOffThreshold = 0.055;  // Exit the Molding Threshold (Normalized Distance), forming hysteresis
        // Left hand pinch judgment (index finger and thumb)
        this.leftPinchActive = false;
        this.leftPinchOnThreshold = 0.04;   // Enter the Molding Threshold (Normalized Distance)
        this.leftPinchOffThreshold = 0.06;  // Exit the Molding Threshold (Normalized Distance), forming hysteresis
    }

    async init() {
        console.log('Initializing GestureInputManager...');

        this.videoElement = document.getElementById('gesture-cam');
        if (!this.videoElement) {
            console.error('gesture-cam element not found!');
            return;
        }

        // Initialize Mediapipe Hands
        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        this.hands.setOptions({
            maxNumHands: 2,             // detect both hands independently
            modelComplexity: 0,         // lightweight model
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
        });

        // Callback when results are available
        this.hands.onResults((results) => this.onResults(results));

        // Initialize camera
        const camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: this.videoElement });
            },
            width: 640,
            height: 480,
        });

        camera.start();

        // Setup overlay canvas
        this.overlayCanvas = document.getElementById('gesture-overlay');
        if (this.overlayCanvas) {
            this.overlayCtx = this.overlayCanvas.getContext('2d');
            this.syncOverlaySize();
        } else {
            console.warn('gesture-overlay canvas not found; arrow overlay disabled');
        }

        this.initialized = true;
        console.log('GestureInputManager initialized');
    }

    onResults(results) {
        // Iterate all detected hands; keep right-hand logic independent
        let rightFingerTip = null;
        let rightThumbTip = null; // Right hand index finger tip and thumb tip
        let leftFingerTip = null;
        let leftThumbTip = null; // Left hand index finger tip and thumb tip
        this.leftHandPresent = false;
        this.gestureShootingActive = false;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const handsCount = Math.min(results.multiHandLandmarks.length, results.multiHandedness?.length || 0);
            for (let i = 0; i < handsCount; i++) {
                const handedness = results.multiHandedness?.[i]?.label; // "Left" or "Right"
                const landmarks = results.multiHandLandmarks[i];
                if (handedness === 'Left') {
                    this.leftHandPresent = true;
                    leftFingerTip = landmarks[8];
                    leftThumbTip = landmarks[4];
                } else if (handedness === 'Right') {
                    rightFingerTip = landmarks[8];
                    rightThumbTip = landmarks[4];
                }
            }
        }
        
        // Right hand pinch judgment (index finger and thumb)
        if (rightFingerTip && rightThumbTip) {
            const dxn = rightThumbTip.x - rightFingerTip.x;
            const dyn = rightThumbTip.y - rightFingerTip.y;
            const distNorm = Math.hypot(dxn, dyn);
            if (this.rightPinchActive) {
                if (distNorm > this.rightPinchOffThreshold) {
                    this.rightPinchActive = false;
                }
            } else {
                if (distNorm < this.rightPinchOnThreshold) {
                    this.rightPinchActive = true;
                }
            }
        } else {
            // No right hand or missing key points → not pinching
            this.rightPinchActive = false;
        }
        
        // Left hand pinch judgment (index finger and thumb)
        if (leftFingerTip && leftThumbTip) {
            const dxnL = leftThumbTip.x - leftFingerTip.x;
            const dynL = leftThumbTip.y - leftFingerTip.y;
            const distNormL = Math.hypot(dxnL, dynL);
            if (this.leftPinchActive) {
                if (distNormL > this.leftPinchOffThreshold) {
                    this.leftPinchActive = false;
                }
            } else {
                if (distNormL < this.leftPinchOnThreshold) {
                    this.leftPinchActive = true;
                }
            }
        } else {
            this.leftPinchActive = false;
        }
        
        // Update movement only based on right hand
        if (rightFingerTip) {
            // Mirror correction (Mediapipe camera is mirrored horizontally)
            const centerX = this.center.x;
            const centerY = this.center.y;
            let dx = -(rightFingerTip.x - centerX);  // invert X axis
            let dy = -(rightFingerTip.y - centerY);  // invert Y axis here; final output will flip Y

            const magnitude = Math.sqrt(dx * dx + dy * dy);
            if (magnitude > 0.05) {
                this.moveVector.x = dx / magnitude;
                this.moveVector.y = dy / magnitude;
            } else {
                this.moveVector.x = 0;
                this.moveVector.y = 0;
            }
        } else {
            // No right hand → stop movement
            this.moveVector.x = 0;
            this.moveVector.y = 0;
        }

        // Render overlay: clear once, then draw left-hand region and right-hand arrow
        if (this.overlayCtx && this.overlayCanvas) {
            this.syncOverlaySize();
            const w = this.overlayCanvas.width;
            const h = this.overlayCanvas.height;
            const ctx = this.overlayCtx;

            ctx.clearRect(0, 0, w, h);
            ctx.save();
            ctx.imageSmoothingEnabled = true;

            // Draw blue region in bottom-left if left hand present
            if (this.leftHandPresent) {
                const totalArea = w * h;
                const targetArea = totalArea * 0.15; // Keep existing ratio setting
                const mapRatio = (this.arenaWidth && this.arenaHeight)
                    ? (this.arenaWidth / this.arenaHeight)
                    : (w / h);
                const rectW = Math.sqrt(targetArea * mapRatio);
                const rectH = Math.sqrt(targetArea / mapRatio);
                // Keep existing center position setting
                const desiredCenterX = 0.25 * w;
                const leftX = Math.round(desiredCenterX - rectW / 2);
                const dx = Math.max(0, Math.min(leftX, Math.round(w - rectW)));
                const desiredCenterY = 0.6 * h;
                const topY = Math.round(desiredCenterY - rectH / 2);
                const dy = Math.max(0, Math.min(topY, Math.round(h - rectH)));
                ctx.fillStyle = 'rgba(0, 122, 255, 0.35)';
                ctx.fillRect(dx, dy, Math.round(rectW), Math.round(rectH));
                // Compute gesture aim mapping only if fingertip within region
                if (leftFingerTip) {
                    const fx = leftFingerTip.x * w;
                    const fy = leftFingerTip.y * h;
                    const withinRegion = (fx >= dx && fx <= dx + rectW && fy >= dy && fy <= dy + rectH);
                    if (withinRegion) {
                        const localX = rectW - (fx - dx);
                        const localY = fy - dy;
                        const rawX = (localX / rectW) * (this.arenaWidth || w);
                        const rawY = (localY / rectH) * (this.arenaHeight || h);

                        // Smooth/Denoise processing
                        const prev = this.gestureAimSmoothed || { x: rawX, y: rawY };
                        const dxAim = rawX - prev.x;
                        const dyAim = rawY - prev.y;
                        const dist = Math.hypot(dxAim, dyAim);
                        if (dist < this.aimDeadzonePx) {
                            // Small motion → ignore, keep previous smoothed value
                            this.gestureAimSmoothed = prev;
                        } else {
                            // Limit single step to avoid abrupt changes
                            const cappedDx = Utils.clamp(dxAim, -this.aimMaxStepPx, this.aimMaxStepPx);
                            const cappedDy = Utils.clamp(dyAim, -this.aimMaxStepPx, this.aimMaxStepPx);
                            const cappedRawX = prev.x + cappedDx;
                            const cappedRawY = prev.y + cappedDy;
                            const a = this.aimSmoothingAlpha;
                            this.gestureAimSmoothed = {
                                x: prev.x * (1 - a) + cappedRawX * a,
                                y: prev.y * (1 - a) + cappedRawY * a
                            };
                        }

                        // Output smoothed target for game use (round to integer)
                        this.gestureAimTargetGame = {
                            x: Math.round(this.gestureAimSmoothed.x),
                            y: Math.round(this.gestureAimSmoothed.y)
                        };
                        this.gestureShootingActive = true;
                    } else {
                        this.gestureShootingActive = false;
                        this.gestureAimTargetGame = null;
                        // Keep gestureAimSmoothed for next time
                    }
                } else {
                    this.gestureShootingActive = false;
                    this.gestureAimTargetGame = null;
                    // Do not clear gestureAimSmoothed, avoid sudden jump when re-enter
                }
            }

            // Draw right-hand arrow if we have a right finger tip
            if (rightFingerTip) {
                this.drawOverlayVector(this.center, rightFingerTip);
            }

            ctx.restore();
        } else {
            // If overlay not available and no right hand, ensure cleared state
            if (!rightFingerTip) {
                this.clearOverlay();
            }
        }
    }

    drawOverlayVector(centerNorm, fingerNorm) {
        if (!this.overlayCtx || !this.overlayCanvas) return;
        // this.syncOverlaySize(); // removed to avoid clearing mid-frame

        const w = this.overlayCanvas.width;
        const h = this.overlayCanvas.height;

        const cx = centerNorm.x * w;
        const cy = centerNorm.y * h;
        const fx = fingerNorm.x * w;
        const fy = fingerNorm.y * h;

        const ctx = this.overlayCtx;
        // Do not clear here; overlay cleared once in onResults
        ctx.save();

        // Center point
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Vector line
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(fx, fy);
        ctx.stroke();

        // Arrowhead at finger tip
        const angle = Math.atan2(fy - cy, fx - cx);
        const headLen = 10;
        const arrowAngle = Math.PI / 6; // 30 degrees
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - headLen * Math.cos(angle - arrowAngle), fy - headLen * Math.sin(angle - arrowAngle));
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - headLen * Math.cos(angle + arrowAngle), fy - headLen * Math.sin(angle + arrowAngle));
        ctx.stroke();

        // Tip point
        ctx.fillStyle = 'rgba(0,255,0,0.9)';
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Provide normalized movement vector for Player.update()
    getMoveVector() {
        return { x: this.moveVector.x, y: -this.moveVector.y };
    }

    // Expose gesture shooting status and target
    isGestureShootingActive() {
        return !!this.gestureShootingActive;
    }

    getGestureAimTargetGame() {
        return this.gestureAimTargetGame ? { x: this.gestureAimTargetGame.x, y: this.gestureAimTargetGame.y } : null;
    }

    // Expose the state of pinching (picking up) of the right hand
    isRightPinchActive() {
        return !!this.rightPinchActive;
    }

    // Expose the state of pinching (picking up) of the left hand
    isLeftPinchActive() {
        return !!this.leftPinchActive;
    }

    // Set game canvas size to map gestures uniformly to game coordinates
    setArenaSize(width, height) {
        this.arenaWidth = width;
        this.arenaHeight = height;
    }

    // Overlay helpers
    syncOverlaySize() {
        if (!this.overlayCanvas || !this.videoElement) return;
        const w = this.videoElement.clientWidth || 0;
        const h = this.videoElement.clientHeight || 0;
        if (w > 0 && h > 0) {
            // Only resize if dimensions actually changed to avoid clearing
            if (this.overlayCanvas.width !== w || this.overlayCanvas.height !== h) {
                this.overlayCanvas.width = w;
                this.overlayCanvas.height = h;
                // Ensure CSS size matches too
                this.overlayCanvas.style.width = w + 'px';
                this.overlayCanvas.style.height = h + 'px';
            }
        }
    }

    clearOverlay() {
        if (!this.overlayCtx || !this.overlayCanvas) return;
        const w = this.overlayCanvas.width;
        const h = this.overlayCanvas.height;
        if (w === 0 || h === 0) this.syncOverlaySize();
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
}

