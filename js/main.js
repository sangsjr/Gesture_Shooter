// Constants for main.js
const ARENA_WIDTH = 1200;
const ARENA_HEIGHT = 800;
const TARGET_FPS = 60;
const MIN_FPS = 55;
const ENEMY_SPAWN_INTERVAL = 2.0; // seconds
const SPAWN_SAFETY_DISTANCE = 150; // ptd
// Add pickup constants
const PICKUP_SPAWN_INTERVAL = 8.0; // seconds
const PICKUP_SAFE_DISTANCE = 50; // pt
const PICKUP_RADIUS = 28; // pt
import { EventBus, InputManager, KeyboardMouseProvider, GestureProvider, VoiceProvider, CollisionSystem, Utils, ImageLoader, SoundManager } from './core.js';
import { Player, ENEMY_REGISTRY, WEAPON_REGISTRY, Projectile, Pickup, PICKUP_TYPES } from './gameplay.js';
import { GestureInputManager } from './core.js';

// Game States
export const GAME_STATES = {
    BOOT: 'boot',
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    UPGRADE_PICK: 'upgrade_pick',
    GAME_OVER: 'game_over'
};

// State Machine
class GameStateMachine {
    constructor() {
        this.currentState = GAME_STATES.BOOT;
        this.previousState = null;
        this.eventBus = new EventBus();
    }
    
    setState(newState) {
        if (this.currentState === newState) return;
        
        this.previousState = this.currentState;
        this.currentState = newState;
        this.eventBus.emit('stateChanged', { from: this.previousState, to: newState });
    }
    
    getState() {
        return this.currentState;
    }
    
    isState(state) {
        return this.currentState === state;
    }
}

// Main Game Class
class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.stateMachine = new GameStateMachine();
        this.inputManager = new InputManager();
        this.eventBus = new EventBus();
        this.imageLoader = new ImageLoader();
        this.soundManager = new SoundManager();
        this.gestureInput = new GestureInputManager();
        
        // Game objects
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        
        // Game state
        this.killCount = 0;
        this.enemySpawnTimer = 0;
        this.pickupSpawnTimer = 0;
        this.creatorMode = false;
        
        // Pistol haste state
        this.pistolHasteActive = false;
        this.pistolHasteRemaining = 0;
        this.originalPistolFireRate = null;
        this.pistolBaseFireRate = null;
        
        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.fpsCounter = 0;
        this.fpsTimer = 0;
        
        // HUD elements
        this.hudElements = {
            healthHearts: null,
            pistolSlot: null,
            machinegunSlot: null,
            gameOverScreen: null,
            restartButton: null,
            toast: null,
            pistolHasteCountdown: null
        };
        
        // track nearest pickup in range for prompt and interaction
        this.pickupCandidate = null;
        
        this.isRunning = false;
        
        // Track the last state of the left hand pinch, used for edge triggering.
        this.prevLeftPinchActive = false;
    }
    
    async init() {
        console.log('Initializing game...');

        // Load Sounds
        this.soundManager.load('hurt_enemy1', 'assets/sounds/hurt_enemy1.ogg', 0.6);
        this.soundManager.load('hurt_enemy2', 'assets/sounds/hurt_enemy2.ogg', 0.6);
        this.soundManager.load('hurt_enemy3', 'assets/sounds/hurt_enemy3.ogg', 0.6);
        this.soundManager.load('hurt_player', 'assets/sounds/hurt_player.ogg', 0.7);
        this.soundManager.load('shoot_pistol', 'assets/sounds/shoot_pistol.ogg', 0.5);

        
        // Get canvas and context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.canvas || !this.ctx) {
            throw new Error('Failed to get canvas or context');
        }
        
        // Setup canvas
        this.setupCanvas();
        
        // Load images
        await this.loadImages();

        // Initialize gesture input
        await this.gestureInput.init();
        // Map the unified coordinate space to the game canvas size
        this.gestureInput.setArenaSize(ARENA_WIDTH, ARENA_HEIGHT);
        
        // Get HUD elements
        this.setupHUD();
        
        // Setup input
        this.setupInput();
        
        // Initialize game objects
        this.initGameObjects();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Set initial state to PLAYING
        this.stateMachine.setState(GAME_STATES.PLAYING);
        
        console.log('Game initialized successfully');
    }
    
    setupCanvas() {
        // Set canvas size
        this.canvas.width = ARENA_WIDTH;
        this.canvas.height = ARENA_HEIGHT;
        
        // Set CSS size to match
        this.canvas.style.width = ARENA_WIDTH + 'px';
        this.canvas.style.height = ARENA_HEIGHT + 'px';
        
        // Setup context
        this.ctx.imageSmoothingEnabled = false;
        
        // Add resize listener
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }
    
    async loadImages() {
        const imageMap = {
            'player': 'player.png',
            'bullet_player': 'bullet_player.svg',
            'bullet_shooter': 'bullet_shooter.svg',
            'assassin': 'enemy2.png',
            'assassin_death': 'hittedenemy2.png',
            'shooter_left':  'enemy3left.png',
            'shooter_right': 'enemy3right.png',
            'shooter_hit_left':  'hittedenemy3left.png',
            'shooter_hit_right': 'hittedenemy3right.png',
            'tank': 'enemy1.png',
            'tank_death':     'hittedenemy1.png',
            'ui_weapon_pistol': 'ui_weapon_pistol.svg',
            'ui_weapon_mg': 'ui_weapon_mg.svg',
            'ui_weapon_knife': 'ui_weapon_knife.png',
            'ui_weapon_grenade': 'ui_weapon_grenade.png',
            'grenade': 'grenade.png',
            'explosion': 'explosion.png',
            'slash': 'slash.png',
            'ui_heart': 'ui_heart.svg',
            'bg': 'bg.png',
            // Pickups (optional assets; fallback shapes used if missing)
            'pickup_mg': 'pickup_mg.png',
            'pickup_grenade': 'pickup_grenade.png',
            'pickup_heal': 'pickup_heal.png',
            'pickup_haste': 'pickup_haste.png'
        };
        
        try {
            await this.imageLoader.loadImages(imageMap);
            console.log('Images loaded successfully');
        } catch (error) {
            console.warn('Some images failed to load, will use fallback rendering:', error);
        }
    }
    
    resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const containerRect = container.getBoundingClientRect();
        
        const scaleX = containerRect.width / ARENA_WIDTH;
        const scaleY = containerRect.height / ARENA_HEIGHT;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin
        
        this.canvas.style.width = (ARENA_WIDTH * scale) + 'px';
        this.canvas.style.height = (ARENA_HEIGHT * scale) + 'px';
    }
    
    setupHUD() {
        this.hudElements.healthHearts = document.getElementById('healthHearts');
        this.hudElements.pistolSlot = document.getElementById('pistol-slot');
        this.hudElements.machinegunSlot = document.getElementById('machinegun-slot');
        this.hudElements.knifeSlot = document.getElementById('knife-slot');
        this.hudElements.grenadeSlot = document.getElementById('grenade-slot');
        this.hudElements.gameOverScreen = document.getElementById('gameOverScreen');
        this.hudElements.restartButton = document.getElementById('restartButton');
        this.hudElements.toast = document.getElementById('toast');
        this.hudElements.pistolHasteCountdown = document.getElementById('pistol-haste-countdown');
    }
    
    setupInput() {
        // Register input providers
        const keyboardMouse = new KeyboardMouseProvider(this.canvas);
        const gesture = new GestureProvider();
        const voice = new VoiceProvider();
        
        this.inputManager.registerProvider('keyboard-mouse', keyboardMouse, true); // fallback
        this.inputManager.registerProvider('gesture', gesture);
        this.inputManager.registerProvider('voice', voice);
        
        // Set keyboard-mouse as active
        this.inputManager.setActiveProvider('keyboard-mouse');
    }
    
    initGameObjects() {
        // Create player at center
        this.player = new Player(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
        
        // Initialize weapons
        this.weapons = {
            pistol: new WEAPON_REGISTRY.pistol(),
            machine_gun: new WEAPON_REGISTRY.machine_gun(),
            knife: new WEAPON_REGISTRY.knife(),
            grenade: new WEAPON_REGISTRY.grenade()
        };
        this.currentWeaponKey = 'pistol';
        
        // Give player the current weapon
        this.player.setWeapon(this.weapons[this.currentWeaponKey]);
        
        // Reset game state
        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        this.killCount = 0;
        this.enemySpawnTimer = 0;
        this.pickupSpawnTimer = 0;
        
        // Initialize pistol fire rate baseline and haste state
        this.originalPistolFireRate = this.weapons.pistol.fireRate;
        this.pistolBaseFireRate = this.originalPistolFireRate;
        this.pistolHasteActive = false;
        this.pistolHasteRemaining = 0;
        this.recomputePistolFireRate();
    }
    
    setupEventListeners() {
        // Restart button
        this.hudElements.restartButton?.addEventListener('click', () => this.restart());
        
        // Keyboard restart
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && this.stateMachine.isState(GAME_STATES.GAME_OVER)) {
                this.restart();
            }
        });
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
        
        console.log('Game started');
    }
    
    stop() {
        this.isRunning = false;
        console.log('Game stopped');
    }
    
    restart() {
        console.log('Restarting game...');
        this.initGameObjects();
        this.stateMachine.setState(GAME_STATES.PLAYING);
        this.hudElements.gameOverScreen?.classList.add('hidden');

        this.start();
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Cap delta time to prevent large jumps
        this.deltaTime = Math.min(this.deltaTime, 1/30); // Max 30 FPS minimum
        
        this.update(this.deltaTime);
        this.render();
        this.updateFPS();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update(deltaTime) {
        // Update input
        this.inputManager.update(deltaTime);
        
        // Update based on current state
        switch (this.stateMachine.getState()) {
            case GAME_STATES.PLAYING:
                this.updatePlaying(deltaTime);
                break;
            case GAME_STATES.GAME_OVER:
                this.updateGameOver(deltaTime);
                break;
            // Other states would have their own update methods
        }
        
        // Handle collisions
        this.handleCollisions();
        
        // Update HUD
        this.updateHUD();
        
        // Check game over condition
        if (this.player && !this.player.isAlive() && this.stateMachine.getState() === GAME_STATES.PLAYING) {
            this.stateMachine.setState(GAME_STATES.GAME_OVER);
            this.showToast('Game Over! Press R to restart');
        }
    }
    
    updatePlaying(deltaTime) {
        const bounds = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
        
        // Update player with creator mode state
        this.player.creatorMode = this.creatorMode;
        // this.player.update(deltaTime, this.inputManager, bounds);
        const keyboardVector = this.inputManager.getMoveVector();
        const gestureVector = (this.gestureInput && this.gestureInput.initialized)
            ? this.gestureInput.getMoveVector()
            : { x: 0, y: 0 };

        const keyboardActive = Math.abs(keyboardVector.x) > 0.01 || Math.abs(keyboardVector.y) > 0.01;

        const finalVector = keyboardActive ? keyboardVector : gestureVector;

        const hybridInput = {
            getMoveVector: () => finalVector,
            isFiring: () => this.inputManager.isFiring(),
            getWeaponSwitch: () => this.inputManager.getWeaponSwitch(),
            clearWeaponSwitch: () => this.inputManager.clearWeaponSwitch(),
            getCreatorModeToggle: () => this.inputManager.getCreatorModeToggle(),
            clearCreatorModeToggle: () => this.inputManager.clearCreatorModeToggle(),
            getMousePosition: () => this.inputManager.getMousePosition()
        };

        this.player.creatorMode = this.creatorMode;
        this.player.update(deltaTime, hybridInput, bounds);


        
        // Handle player firing
        const gestureActive = this.gestureInput && this.gestureInput.isGestureShootingActive();
        const aim = gestureActive ? this.gestureInput.getGestureAimTargetGame() : null;
        console.log(`[GestureShoot] active=${gestureActive}, aim=(${aim ? Math.round(aim.x) : 'null'}, ${aim ? Math.round(aim.y) : 'null'})`);
        if (gestureActive) {
            if (aim) {
                // Override mouse coords for aim/render while in gesture mode
                this.inputManager.mouseX = aim.x;
                this.inputManager.mouseY = aim.y;
                // Continuous firing toward mapped aim point
                this.player.fire(aim.x, aim.y, this.projectiles, this.enemies);
            }
        } else {
            if (this.inputManager.isFiring()) {
                const mousePos = this.inputManager.getMousePosition();
                this.player.fire(mousePos.x, mousePos.y, this.projectiles, this.enemies);
            }
        }
        
        // Track the last state of the left hand pinch, used for edge triggering.
        const leftPinchActive = this.gestureInput && this.gestureInput.isLeftPinchActive && this.gestureInput.isLeftPinchActive();
        if (leftPinchActive && !this.prevLeftPinchActive) {
            if (this.inputManager.canSwitchWeapon()) {
                this.inputManager.switchWeapon = true;
            }
        }
        this.prevLeftPinchActive = !!leftPinchActive;
        
        // Handle weapon switching
        const weaponSwitch = this.inputManager.getWeaponSwitch();
        console.log('🎮 Weapon switch check in updatePlaying:', weaponSwitch);
        if (weaponSwitch) {
            console.log('🎮 Weapon switch detected, calling toggleWeapon()');
            this.toggleWeapon();
            this.inputManager.clearWeaponSwitch(); // Clear the switch flag after processing
        }

        // Handle creator mode toggle
        const creatorModeToggle = this.inputManager.getCreatorModeToggle();
        if (creatorModeToggle) {
            this.toggleCreatorMode();
            this.inputManager.clearCreatorModeToggle(); // Clear the toggle flag after processing
        }
        
        // Spawn enemies
        this.enemySpawnTimer += deltaTime;
        if (this.enemySpawnTimer >= ENEMY_SPAWN_INTERVAL) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }
        
        // Spawn pickups on fixed cadence
        this.pickupSpawnTimer += deltaTime;
        if (this.pickupSpawnTimer >= PICKUP_SPAWN_INTERVAL) {
            this.spawnPickup();
            this.pickupSpawnTimer = 0;
        }
        
        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.constructor.name === 'Shooter') {
                enemy.update(deltaTime, this.player, bounds, this.projectiles);
            } else {
                enemy.update(deltaTime, this.player, bounds);
            }
        });
        
        // Update projectiles
        this.projectiles.forEach(projectile => {
            if (projectile.constructor.name === 'GrenadeProjectile') {
                projectile.update(deltaTime, bounds, this.enemies);
            } else {
                projectile.update(deltaTime, bounds);
            }
        });
        
        // Update weapons (for effects like grenade explosions)
        Object.values(this.weapons).forEach(weapon => {
            if (weapon && weapon.update) {
                weapon.update(deltaTime);
            }
        });
        
        // Update pistol haste countdown and expiry
        if (this.pistolHasteActive) {
            this.pistolHasteRemaining = Math.max(0, this.pistolHasteRemaining - deltaTime);
            if (this.pistolHasteRemaining <= 0) {
                this.pistolHasteActive = false;
                this.recomputePistolFireRate();
            }
        }
        
        // Handle collisions
        this.handleCollisions();
        
        // Remove dead objects
        this.enemies = this.enemies.filter(enemy => enemy.isAlive());
        this.projectiles = this.projectiles.filter(projectile => projectile.isAlive());
        // Pickups persist until collected, no age-out
        
        // Check game over
        if (!this.player.isAlive()) {
            this.stateMachine.setState(GAME_STATES.GAME_OVER);
            this.hudElements.gameOverScreen?.classList.remove('hidden');
            const finalScore = this.hudElements.gameOverScreen?.querySelector('#finalScore');
            if (finalScore) finalScore.textContent = this.killCount.toString();
        }
    }
    
    toggleWeapon() {
        console.log('🔄 toggleWeapon() called');
        console.log('🔄 Current weapon key:', this.currentWeaponKey);
        console.log('🔄 Available weapons:', Object.keys(this.weapons));
        
        // Cycle through all 4 weapons: pistol -> machine_gun -> knife -> grenade -> pistol
        const weaponOrder = ['pistol', 'machine_gun', 'knife', 'grenade'];
        const currentIndex = weaponOrder.indexOf(this.currentWeaponKey);
        const nextIndex = (currentIndex + 1) % weaponOrder.length;
        this.currentWeaponKey = weaponOrder[nextIndex];
        
        console.log('🔄 New weapon key:', this.currentWeaponKey);
        
        this.player.setWeapon(this.weapons[this.currentWeaponKey]);
        console.log('🔄 Weapon set on player:', this.weapons[this.currentWeaponKey]);
        
        // Show toast notification
        const weaponNames = {
            'pistol': 'Pistol',
            'machine_gun': 'Machine Gun',
            'knife': 'Knife',
            'grenade': 'Grenade'
        };
        const weaponName = weaponNames[this.currentWeaponKey];
        this.showToast(`Switched to ${weaponName}`);
        console.log('🔄 Toast shown:', weaponName);
    }

    toggleCreatorMode() {
        this.creatorMode = !this.creatorMode;
        console.log('🎨 Creator mode toggled:', this.creatorMode);
        
        if (this.creatorMode) {
            // Apply creator mode modifications
            this.applyCreatorModeModifications();
        } else {
            // Revert creator mode modifications
            this.revertCreatorModeModifications();
        }
    }

    applyCreatorModeModifications() {
        // Store original pistol fire rate for restoration
        if (!this.originalPistolFireRate) {
            this.originalPistolFireRate = this.weapons.pistol.fireRate;
        }
        
        // Set 5x faster pistol base fire rate (seconds between shots divided by 5)
        this.pistolBaseFireRate = this.originalPistolFireRate / 5;
        this.recomputePistolFireRate();
        console.log('🎨 Pistol base fire rate (creator mode) set to:', this.pistolBaseFireRate);
    }

    revertCreatorModeModifications() {
        // Restore original pistol base fire rate
        if (this.originalPistolFireRate) {
            this.pistolBaseFireRate = this.originalPistolFireRate;
            this.recomputePistolFireRate();
            console.log('🎨 Pistol base fire rate restored to:', this.pistolBaseFireRate);
        }
    }

    recomputePistolFireRate() {
        const base = this.pistolBaseFireRate ?? this.weapons.pistol.fireRate;
        const effective = base / (this.pistolHasteActive ? 3 : 1);
        this.weapons.pistol.fireRate = effective;
    }

    updateGameOver(deltaTime) {
        // Game over state - waiting for restart
    }
    
    spawnEnemy() {
        // Randomly choose between all three enemy types
        const enemyTypes = ['assassin', 'shooter', 'tank'];
        const enemyType = enemyTypes[Utils.randomInt(0, enemyTypes.length - 1)];
        
        // Choose a random edge to spawn from (0=top, 1=right, 2=bottom, 3=left)
        const edge = Utils.randomInt(0, 3);
        let x, y;
        
        const margin = 50; // Distance from the edge
        
        switch (edge) {
            case 0: // Top edge
                x = Utils.randomRange(margin, ARENA_WIDTH - margin);
                y = -margin;
                break;
            case 1: // Right edge
                x = ARENA_WIDTH + margin;
                y = Utils.randomRange(margin, ARENA_HEIGHT - margin);
                break;
            case 2: // Bottom edge
                x = Utils.randomRange(margin, ARENA_WIDTH - margin);
                y = ARENA_HEIGHT + margin;
                break;
            case 3: // Left edge
                x = -margin;
                y = Utils.randomRange(margin, ARENA_HEIGHT - margin);
                break;
        }
        
        // Ensure minimum distance from player (safety check)
        if (Utils.distance(x, y, this.player.x, this.player.y) < SPAWN_SAFETY_DISTANCE) {
            // If too close, try a different edge
            const alternativeEdge = (edge + 2) % 4; // Opposite edge
            switch (alternativeEdge) {
                case 0: // Top edge
                    x = Utils.randomRange(margin, ARENA_WIDTH - margin);
                    y = -margin;
                    break;
                case 1: // Right edge
                    x = ARENA_WIDTH + margin;
                    y = Utils.randomRange(margin, ARENA_HEIGHT - margin);
                    break;
                case 2: // Bottom edge
                    x = Utils.randomRange(margin, ARENA_WIDTH - margin);
                    y = ARENA_HEIGHT + margin;
                    break;
                case 3: // Left edge
                    x = -margin;
                    y = Utils.randomRange(margin, ARENA_HEIGHT - margin);
                    break;
            }
        }
        
        // Create enemy
        const EnemyClass = ENEMY_REGISTRY[enemyType];
        if (EnemyClass) {
            const enemy = new EnemyClass(x, y);
            this.enemies.push(enemy);
        }
    }
    
    // New: spawn a pickup inside arena and ≥ 50 pt from player
    spawnPickup() {
        const types = [PICKUP_TYPES.MG_AMMO, PICKUP_TYPES.GRENADE, PICKUP_TYPES.HEAL, PICKUP_TYPES.PISTOL_HASTE];
        const type = types[Utils.randomInt(0, types.length - 1)];
        let x = this.player.x, y = this.player.y;
    
        for (let i = 0; i < 40; i++) {
            x = Utils.randomRange(PICKUP_RADIUS, ARENA_WIDTH - PICKUP_RADIUS);
            y = Utils.randomRange(PICKUP_RADIUS, ARENA_HEIGHT - PICKUP_RADIUS);
            if (Utils.distance(x, y, this.player.x, this.player.y) >= PICKUP_SAFE_DISTANCE) break;
        }
    
        this.pickups.push(new Pickup(x, y, type));
    }
    
    handleCollisions() {
        // Player vs enemies
        this.enemies.forEach(enemy => {
            if (CollisionSystem.checkCircleCollision(this.player, enemy)) {
                if (this.player.canTakeDamage()) {
                    this.player.takeDamage(enemy.damage);
                }
            }
        });
        
        // Projectiles vs enemies (player bullets hitting enemies)
        this.projectiles.forEach(projectile => {
            if (projectile.owner === 'player') {
                this.enemies.forEach(enemy => {
                    if (CollisionSystem.checkCircleCollision(projectile, enemy)) {
                        const prevHp = enemy.hp;
                        enemy.takeDamage(projectile.damage);
                        projectile.alive = false;
                        if (prevHp > enemy.hp && enemy.isAlive() && projectile.owner === 'player') {
                            if (window.game && window.game.soundManager) {
                                window.game.soundManager.play('shoot_pistol');
                            }
                        }

                        if (!enemy.isAlive()) {
                            this.killCount++;
                        }
                    }
                });
            }
        });
        
        // Enemy projectiles vs player (enemy bullets hitting player)
        this.projectiles.forEach(projectile => {
            if (projectile.owner !== 'player' && projectile.owner !== null) {
                if (CollisionSystem.checkCircleCollision(projectile, this.player)) {
                    if (this.player.canTakeDamage()) {
                        this.player.takeDamage(projectile.damage);
                        projectile.alive = false;
                    }
                }
            }
        });
        
        // Player vs pickups: require F key to confirm pickup
        this.pickupCandidate = null;
        let nearestIndex = -1;
        let nearestDist = Infinity;
        for (let i = 0; i < this.pickups.length; i++) {
            const pickup = this.pickups[i];
            if (CollisionSystem.checkCircleCollision(this.player, pickup)) {
                const d = Utils.distance(this.player.x, this.player.y, pickup.x, pickup.y);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIndex = i;
                }
            }
        }
        if (nearestIndex >= 0) {
            this.pickupCandidate = this.pickups[nearestIndex];
            const pinchActive = this.gestureInput && this.gestureInput.isRightPinchActive();
            if (this.inputManager.isPickingUp() || pinchActive) {
                // Confirm pickup on F key or right-hand pinch
                this.applyPickupEffect(this.pickupCandidate.type);
                this.pickups.splice(nearestIndex, 1);
                this.pickupCandidate = null;
                this.updateHUD();
            }
        }
    }
    
    render() {
        // Clear canvas
        const bgImage = this.imageLoader.getImage('bg');
        if (bgImage) {
            this.ctx.drawImage(bgImage, 0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        } else {
            this.ctx.fillStyle = '#111111';
            this.ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        }

        // Draw arena border
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(2, 2, ARENA_WIDTH - 4, ARENA_HEIGHT - 4);
        
        // Render game objects based on state
        switch (this.stateMachine.getState()) {
            case GAME_STATES.PLAYING:
            case GAME_STATES.GAME_OVER:
                this.renderPlaying();
                break;
            // Other states would have their own rendering
        }
        
        // Debug info
        if (this.fps < MIN_FPS) {
            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`FPS: ${this.fps.toFixed(1)}`, 10, ARENA_HEIGHT - 20);
        }
    }
    
    renderPlaying() {
        // Render pickups first so they sit under player/enemies
        this.pickups.forEach(pickup => pickup.render(this.ctx, this.imageLoader));
        
        // If a pickup is in range, render prompt above it
        if (this.pickupCandidate) {
            const msg = 'Press F Pick Up';
            this.ctx.save();
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            const px = Math.round(this.pickupCandidate.x);
            const py = Math.round(this.pickupCandidate.y - this.pickupCandidate.radius - 12);
            this.ctx.strokeText(msg, px, py);
            this.ctx.fillText(msg, px, py);
            this.ctx.restore();
        }
        
        // Render player
        this.player.render(this.ctx, this.imageLoader, this.inputManager.mouseX, this.inputManager.mouseY);
        
        // Render enemies
        this.enemies.forEach(enemy => {
            enemy.render(this.ctx, this.imageLoader, this.player);
        });
        
        // Render projectiles
        this.projectiles.forEach(projectile => {
            projectile.render(this.ctx, this.imageLoader);
        });
        
        // Gesture Aim Indicator (only drawn when gesture shooting is activated)
        if (this.gestureInput && this.gestureInput.isGestureShootingActive()) {
            const aim = this.gestureInput.getGestureAimTargetGame();
            if (aim) {
                const ax = Math.round(Utils.clamp(aim.x, 0, ARENA_WIDTH));
                const ay = Math.round(Utils.clamp(aim.y, 0, ARENA_HEIGHT));
                this.ctx.save();
                this.ctx.translate(ax, ay);
                const r = 14;
                this.ctx.strokeStyle = '#00BFFF';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, r, 0, Math.PI * 2);
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.moveTo(-r - 3, 0); this.ctx.lineTo(-4, 0);
                this.ctx.moveTo(r + 3, 0); this.ctx.lineTo(4, 0);
                this.ctx.moveTo(0, -r - 3); this.ctx.lineTo(0, -4);
                this.ctx.moveTo(0, r + 3); this.ctx.lineTo(0, 4);
                this.ctx.stroke();

                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }
        }
        
        // Render weapon effects (like grenade explosions)
        if (this.weapons.grenade) {
            this.weapons.grenade.render(this.ctx, this.imageLoader);
        }
    }
    
    updateHUD() {
        // Update health display
        if (this.hudElements.healthHearts) {
            const hearts = '♥'.repeat(Math.max(0, this.player.hp));
            const emptyHearts = '♡'.repeat(Math.max(0, this.player.maxHp - this.player.hp));
            this.hudElements.healthHearts.textContent = hearts + emptyHearts;
        }
        
        // Update weapon display
        const weaponSlots = {
            'pistol': this.hudElements.pistolSlot,
            'machine_gun': this.hudElements.machinegunSlot,
            'knife': this.hudElements.knifeSlot,
            'grenade': this.hudElements.grenadeSlot
        };
        
        // Update active weapon highlighting
        Object.entries(weaponSlots).forEach(([weaponKey, slot]) => {
            if (slot) {
                if (weaponKey === this.currentWeaponKey) {
                    slot.classList.add('active');
                } else {
                    slot.classList.remove('active');
                }
            }
        });
        
        // Update ammo displays
        if (this.hudElements.pistolSlot) {
            const pistolAmmo = this.hudElements.pistolSlot.querySelector('div:last-child');
            if (pistolAmmo) pistolAmmo.textContent = '∞';
        }
        
        if (this.hudElements.machinegunSlot) {
            const machinegunAmmo = this.hudElements.machinegunSlot.querySelector('div:last-child');
            if (machinegunAmmo) machinegunAmmo.textContent = this.weapons.machine_gun.getAmmoDisplay();
        }
        
        if (this.hudElements.knifeSlot) {
            const knifeAmmo = this.hudElements.knifeSlot.querySelector('div:last-child');
            if (knifeAmmo) knifeAmmo.textContent = '∞';
        }
        
        if (this.hudElements.grenadeSlot) {
            const grenadeAmmo = this.hudElements.grenadeSlot.querySelector('div:last-child');
            if (grenadeAmmo) grenadeAmmo.textContent = this.weapons.grenade.getAmmoDisplay();
        }
        // Pistol Haste countdown (visible only while active)
        if (this.hudElements.pistolHasteCountdown) {
            if (this.pistolHasteActive) {
                this.hudElements.pistolHasteCountdown.style.display = 'inline';
                this.hudElements.pistolHasteCountdown.textContent = `⚡ ${Math.ceil(this.pistolHasteRemaining)}s`;
            } else {
                this.hudElements.pistolHasteCountdown.style.display = 'none';
            }
        }
    }

    applyPickupEffect(type) {
        switch (type) {
            case PICKUP_TYPES.MG_AMMO: {
                this.weapons.machine_gun.currentAmmo += 20;
                this.showToast('Machine Gun +20');
                break;
            }
            case PICKUP_TYPES.GRENADE: {
                this.weapons.grenade.currentAmmo += 5;
                this.showToast('Grenade +5');
                break;
            }
            case PICKUP_TYPES.HEAL: {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                this.showToast('Heal +1');
                break;
            }
            case PICKUP_TYPES.PISTOL_HASTE: {
                this.pistolHasteActive = true;
                this.pistolHasteRemaining = 10.0;
                this.recomputePistolFireRate();
                this.showToast('Pistol Haste ×3 (10s)');
                break;
            }
        }
    }
    
    updateFPS() {
        this.fpsCounter++;
        this.fpsTimer += this.deltaTime;
        
        if (this.fpsTimer >= 1.0) {
            this.fps = this.fpsCounter / this.fpsTimer;
            this.fpsCounter = 0;
            this.fpsTimer = 0;
        }
    }
    
    showToast(message, duration = 2000) {
        if (!this.hudElements.toast) return;
        
        this.hudElements.toast.textContent = message;
        this.hudElements.toast.style.display = 'block';
        
        setTimeout(() => {
            if (this.hudElements.toast) {
                this.hudElements.toast.style.display = 'none';
            }
        }, duration);
    }
}

// Initialize and start the game
async function startGame() {
    try {
        const game = new Game();
        await game.init();
        game.start();
        
        // Make game globally accessible for debugging
        window.game = game;
        
    } catch (error) {
        console.error('Failed to start game:', error);
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    startGame();
}
