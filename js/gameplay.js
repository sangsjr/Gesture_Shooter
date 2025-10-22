// Constants for gameplay.js
const PLAYER_SPEED = 220; // pt/s
const PLAYER_RADIUS = 16; // pt
const PLAYER_MAX_HP = 3;
const PLAYER_IFRAME_DURATION = 0.8; // seconds
const ASSASSIN_SPEED = 150; // pt/s
const ASSASSIN_RADIUS = 15; // pt
const SHOOTER_SPEED = 120; // pt/s
const SHOOTER_RADIUS = 20; // pt
const SHOOTER_MOVE_DURATION = 2.0; // seconds
const SHOOTER_FIRE_RATE = 2.0; // seconds between shots
const SHOOTER_SPREAD_ANGLE = 4; // degrees
const SHOOTER_BULLET_SPEED = 400; // pt/s
const SHOOTER_BULLET_RADIUS = 4; // pt
const SHOOTER_BULLET_LIFETIME = 2.5; // seconds
const TANK_SPEED = 50; // pt/s
const TANK_RADIUS = 25; // pt
const TANK_HP = 3;
const TANK_CONTACT_COOLDOWN = 0.7; // seconds
const TANK_KNOCKBACK = 8; // pt
const TANK_FLASH_DURATION = 0.1; // seconds
const BULLET_SPEED = 600; // pt/s
const BULLET_RADIUS = 3; // pt
const PISTOL_FIRE_RATE = 1.0; // seconds between shots
const MACHINE_GUN_FIRE_RATE = 0.3; // seconds between shots
const MACHINE_GUN_AMMO = 100;
// Knife weapon constants
const KNIFE_ARC_DEG = 120;
const KNIFE_RANGE_PT = 120;
const KNIFE_COOLDOWN_S = 0.4;
// Grenade weapon constants
const GRENADE_SPEED_PT_S = 350; // Reduced from 420 for better collision detection
const GRENADE_FUSE_S = 0.7; // seconds before explosion
const GRENADE_RADIUS_PT = 6; // Increased from 6 for better collision detection
const GRENADE_EXPLOSION_RADIUS_PT = 120;
const GRENADE_COOLDOWN_S = 0.5;
const GRENADE_AMMO_INITIAL = 10;

import { Utils, CollisionSystem } from './core.js';

// Base Entity class
export class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.hp = 1;
        this.maxHp = 1;
        this.alive = true;
    }
    
    update(deltaTime) {
        // Apply velocity to position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }
    
    render(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.alive = false;
        }
    }
    
    isAlive() {
        return this.alive;
    }
    
    getBounds() {
        return {
            left: this.x - this.radius,
            right: this.x + this.radius,
            top: this.y - this.radius,
            bottom: this.y + this.radius
        };
    }
}

// Player class
export class Player extends Entity {
    constructor(x, y) {
        super(x, y, PLAYER_RADIUS);
        this.hp = PLAYER_MAX_HP;
        this.maxHp = PLAYER_MAX_HP;
        this.speed = PLAYER_SPEED;
        this.iframeTimer = 0;
        this.flashTimer = 0;
        this.weapon = null;

        // Circular animation setup
        this.anim = {
            frames: 6,             // Total number of frames in animation
            frame: 0,              // Current frame index
            timer: 0,
            frameDuration: 0.03,   // Frame duration (seconds)
            idleFrame: 0           // Display first frame when idle
        };

        this.isMoving = false;
        this._prevX = x;
        this._prevY = y;
    }
    
    update(deltaTime, inputManager, bounds) {
        // Handle movement
        const moveVector = inputManager.getMoveVector();
        this.vx = moveVector.x * this.speed;
        this.vy = moveVector.y * this.speed;
        
        // Update position with bounds checking
        let newX = this.x + this.vx * deltaTime;
        let newY = this.y + this.vy * deltaTime;
        
        // Clamp to arena bounds
        newX = Utils.clamp(newX, this.radius, bounds.width - this.radius);
        newY = Utils.clamp(newY, this.radius, bounds.height - this.radius);
        
        this.x = newX;
        this.y = newY;
        
        // Update timers
        if (this.iframeTimer > 0) {
            this.iframeTimer -= deltaTime;
        }
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
        }
        
        // Update weapon
        if (this.weapon) {
            this.weapon.update(deltaTime);
        }


        // Update animation
        const movedDist = Math.abs(this.x - this._prevX) + Math.abs(this.y - this._prevY);
        this.isMoving = movedDist > 0.1; // Check if player is moving

        if (this.isMoving) {
            this.anim.timer += deltaTime;
            if (this.anim.timer >= this.anim.frameDuration) {
                this.anim.timer = 0;
                this.anim.frame = (this.anim.frame + 1) % this.anim.frames;
            }
        } else {
            this.anim.frame = this.anim.idleFrame;
            this.anim.timer = 0;
        }

        this._prevX = this.x;
        this._prevY = this.y;
    }
    
    render(ctx, imageLoader = null, mouseX = 0, mouseY = 0) {
        ctx.save();

        const playerSprite = imageLoader?.getImage('player');
        if (!playerSprite) {
            // Fallback: Replace with circular.
            ctx.fillStyle = '#00FF00';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // Calculate rotation angle towards mouse
        const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);

        // Calculate source position in sprite sheet
        const fw = playerSprite.width / this.anim.frames;
        const fh = playerSprite.height;
        const sx = this.anim.frame * fw;
        const sy = 0;

        // Set size
        const scale = 5; // Size
        const drawW = fw * scale;
        const drawH = fh * scale;

        // Apply flash effect if invulnerable
        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.6;
            ctx.filter = 'brightness(1.8)';
        }

        ctx.drawImage(
            playerSprite,
            sx, sy, fw, fh,              // Source position in sprite sheet
            -drawW / 2, -drawH / 2,      // Draw position (center)
            drawW, drawH                 // Draw size
        );

        ctx.restore();
        
        // Render weapon effects (like knife slash animation)
        if (this.weapon && this.weapon.render) {
            this.weapon.render(ctx, imageLoader, this.x, this.y, mouseX, mouseY);
        }
    }

    
    takeDamage(damage) {
        if (this.iframeTimer > 0) return false;

        if (this.creatorMode) {
            this.iframeTimer = PLAYER_IFRAME_DURATION;
            this.flashTimer = 0.1;
            return true;
        }

        super.takeDamage(damage);
        this.iframeTimer = PLAYER_IFRAME_DURATION;
        this.flashTimer = 0.1;

        if (window.game && window.game.soundManager) {
            window.game.soundManager.play('hurt_player');
        }

        return true;
    }

    
    canTakeDamage() {
        return this.iframeTimer <= 0;
    }
    
    setWeapon(weapon) {
        this.weapon = weapon;
        if (weapon) {
            weapon.owner = this;
        }
    }
    
    fire(targetX, targetY, projectiles, enemies = []) {
        if (this.weapon) {
            // For knife weapon, pass additional parameters for damage detection
            if (this.weapon.constructor.name === 'Knife') {
                return this.weapon.fire(this.x, this.y, targetX, targetY, projectiles, enemies, this);
            } else {
                return this.weapon.fire(this.x, this.y, targetX, targetY, projectiles);
            }
        }
        return false;
    }
}

// Base Enemy class
export class Enemy extends Entity {
    constructor(x, y, radius, hp = 1) {
        super(x, y, radius);
        this.hp = hp;
        this.maxHp = hp;
        this.damage = 1;
        this.color = '#FF0000'; // Default red color

        // Initialize hit animation state
        this.hit = {
            active: false,
            timer: 0,
            duration: 0.25,
            frame: 0,
            frameCount: 4,
            frameDuration: 0.06
        };

        // Initialize dying state
        this.isDying = false;
        this.deathTimer = 0;
        this.deathDuration = 0.3; // Match the duration of hit animation
    }
    
    update(deltaTime, player, bounds) {
        // Call parent Entity update to apply velocity to position
        super.update(deltaTime);
        // Override in subclasses for specific behavior

        // Update hit animation
        if (this.hit.active) {
            this.hit.timer += deltaTime;

            // Update frame if within duration
            if (this.hit.timer < this.hit.duration) {
                const frameIndex = Math.floor(this.hit.timer / this.hit.frameDuration);
                this.hit.frame = Math.min(frameIndex, this.hit.frameCount - 1);
            } else {
                this.hit.active = false; // Reset animation
            }
        }

        if (this.isDying) {
            this.deathTimer += deltaTime;
            if (this.deathTimer >= this.deathDuration) {
                this.alive = false;
            }
        }
    }

    takeDamage(damage) {
        const wasAlive = this.alive;
        const prevHp = this.hp;
        this.hp -= damage;

        if (this.hit) {
            this.hit.active = true;
            this.hit.timer = 0;
            this.hit.frame = 0;
        }

        // Enemy dead
        if (this.hp <= 0 && !this.isDying) {
            this.hp = 0;
            this.isDying = true;
            this.deathTimer = 0;

            // Play death sound
            if (window.game && window.game.soundManager) {
                let soundKey = 'hurt_enemy1';
                if (this.constructor.name === 'Tank') soundKey = 'hurt_enemy1';
                else if (this.constructor.name === 'Assassin') soundKey = 'hurt_enemy2';
                else if (this.constructor.name === 'Shooter') soundKey = 'hurt_enemy3';
                window.game.soundManager.play(soundKey);
            }
        }
    }
    
    render(ctx, imageLoader = null) {
        ctx.save();
        
        // Calculate rotation angle based on velocity direction
        const angle = Math.atan2(this.vy, this.vx);
        
        // Try to use sprite first
        const assassinSprite = imageLoader?.getImage('assassin');
        if (assassinSprite) {
            // Translate to center and rotate
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            
            // Draw sprite with size = 2 * radius
            const size = this.radius * 2;
            ctx.drawImage(assassinSprite, -size/2, -size/2, size, size);
        } else {
            // Fallback to geometry rendering
            ctx.fillStyle = this.color || '#FF0000';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Assassin enemy (implemented)
export class Assassin extends Enemy {
    constructor(x, y) {
        super(x, y, ASSASSIN_RADIUS, 1);
        this.speed = ASSASSIN_SPEED;

        // Circular animation setup
        this.anim = {
            frame: 0,
            timer: 0,
            frameCount: 4,
            frameDuration: 0.15
        };

        // Death animation setup
        this.deathAnim = {
            frame: 0,
            frameCount: 4,
            frameDuration: 0.08 // 4*0.08=0.32s
        };
        this.deathDuration = this.deathAnim.frameCount * this.deathAnim.frameDuration;

    }
    
    update(deltaTime, player, bounds) {
        if (!player.isAlive()) return;
        
        // Move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Utils.distance(this.x, this.y, player.x, player.y);
        
        if (distance > 0) {
            // Normalize direction and apply speed
            this.vx = (dx / distance) * this.speed;
            this.vy = (dy / distance) * this.speed;
        }
        
        // Call parent update to apply velocity
        super.update(deltaTime, player, bounds);

        if (this.isDying) {
            this.vx = 0; this.vy = 0;

            const idx = Math.floor(this.deathTimer / this.deathAnim.frameDuration);
            this.deathAnim.frame = Math.min(idx, this.deathAnim.frameCount - 1);
        }
        
        // Keep within bounds
        this.x = Utils.clamp(this.x, this.radius, bounds.width - this.radius);
        this.y = Utils.clamp(this.y, this.radius, bounds.height - this.radius);

        // Update animation frame
        this.anim.timer += deltaTime;
        if (this.anim.timer >= this.anim.frameDuration) {
            this.anim.timer = 0;
            this.anim.frame = (this.anim.frame + 1) % this.anim.frameCount;
        }
    }
    
    render(ctx, imageLoader = null) {
        ctx.save();

        if (this.isDying) {
            // Draw death animation
            const sprite = imageLoader?.getImage('assassin_death');
            if (sprite) {
            const frames = this.deathAnim.frameCount;
            const fw = (sprite.width / frames) | 0;
            const fh = sprite.height | 0;
            const sx = this.deathAnim.frame * fw;
            const sy = 0;
            const scale = 3; // Scale to match size before death
            const dw = fw * scale;
            const dh = fh * scale;
            ctx.drawImage(sprite, sx, sy, fw, fh, Math.round(this.x - dw/2), Math.round(this.y - dh/2), dw, dh);
        } else {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#FF0000';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        }
            ctx.restore();
            return;
        }

        const sprite = imageLoader?.getImage('assassin');
        if (!sprite) {
            ctx.fillStyle = '#FF0000';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
            ctx.restore(); return;
        }

        const fw = sprite.width / this.anim.frameCount;
        const fh = sprite.height;
        const sx = fw * this.anim.frame;
        const sy = 0;

        const angle = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle + Math.PI / 2);

        const scale = 3;
        const dw = fw * scale;
        const dh = fh * scale;
        ctx.drawImage(sprite, sx, sy, fw, fh, -dw/2, -dh/2, dw, dh);

        ctx.restore();
    }
}

// Shooter enemy
export class Shooter extends Enemy {
    constructor(x, y) {
        super(x, y, SHOOTER_RADIUS, 1);
        this.speed = SHOOTER_SPEED;
        this.moveTimer = 0;
        this.fireTimer = 0;
        this.isMoving = true;
        this.centerX = 0; // Will be set when bounds are available
        this.centerY = 0;

        this.anim = {
            frame: 0,
            timer: 0,
            frameCount: 5,
            frameDuration: 0.12
        };

        // Towards：-1=left, +1=right
        this.facing = 1;

        // hitted animation
        this.hit.frameCount = 4;
        this.hit.frameDuration = 0.06;
        this.hit.duration = this.hit.frameCount * this.hit.frameDuration;

    }
    
    update(deltaTime, player, bounds, projectiles) {
        if (!player.isAlive()) return;
        
        // Set center coordinates if not set
        if (this.centerX === 0 && this.centerY === 0) {
            this.centerX = bounds.width / 2;
            this.centerY = bounds.height / 2;
        }
        
        this.moveTimer += deltaTime;
        this.fireTimer += deltaTime;
        
        // Move toward center for first 2 seconds
        if (this.isMoving && this.moveTimer < SHOOTER_MOVE_DURATION) {
            const dx = this.centerX - this.x;
            const dy = this.centerY - this.y;
            const distance = Utils.distance(this.x, this.y, this.centerX, this.centerY);
            
            if (distance > 5) { // Small threshold to avoid jittering
                const normalized = Utils.normalize(dx, dy);
                this.vx = normalized.x * this.speed;
                this.vy = normalized.y * this.speed;
            } else {
                this.vx = 0;
                this.vy = 0;
                this.isMoving = false;
            }
        } else {
            // Stop moving after 2 seconds
            this.isMoving = false;
            this.vx = 0;
            this.vy = 0;
        }
        
        // Fire at player every 2 seconds
        if (this.fireTimer >= SHOOTER_FIRE_RATE) {
            this.fireAtPlayer(player, projectiles);
            this.fireTimer = 0;
        }
        
        super.update(deltaTime, player, bounds);
        
        // Keep in bounds
        this.x = Utils.clamp(this.x, this.radius, bounds.width - this.radius);
        this.y = Utils.clamp(this.y, this.radius, bounds.height - this.radius);

        // Update facing direction
        this.facing = (player && player.x < this.x) ? -1 : 1;

        // Update animation frame
        this.anim.timer += deltaTime;
        if (this.anim.timer >= this.anim.frameDuration) {
            this.anim.timer = 0;
            this.anim.frame = (this.anim.frame + 1) % this.anim.frameCount;
        }

    }
    
    fireAtPlayer(player, projectiles) {
        // Calculate angle to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);
        
        // Add random spread (±4 degrees)
        const spreadRadians = (SHOOTER_SPREAD_ANGLE * Math.PI / 180);
        const randomSpread = (Math.random() - 0.5) * 2 * spreadRadians;
        const finalAngle = baseAngle + randomSpread;
        
        // Create bullet
        const bulletVx = Math.cos(finalAngle) * SHOOTER_BULLET_SPEED;
        const bulletVy = Math.sin(finalAngle) * SHOOTER_BULLET_SPEED;
        
        const bullet = new ShooterBullet(
            this.x, this.y, 
            bulletVx, bulletVy, 
            SHOOTER_BULLET_RADIUS, 
            1, // damage
            '#FF3B30', // red color
            this
        );
        
        projectiles.push(bullet);
    }
    
    render(ctx, imageLoader = null, player = null) {
        ctx.save();

        const facingLeft = (this.facing < 0);

        const useHit = this.hit.active;

        let baseKey = facingLeft ? 'shooter_left' : 'shooter_right';
        let hitKey  = facingLeft ? 'shooter_hit_left' : 'shooter_hit_right';
        const sprite = imageLoader?.getImage(useHit ? hitKey : baseKey);

        if (!sprite) {
            ctx.fillStyle = '#FF8800';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        const frames = useHit ? this.hit.frameCount : this.anim.frameCount;
        const frameIndex = useHit ? this.hit.frame : this.anim.frame;

        const fw = (sprite.width / frames) | 0;
        const fh = sprite.height | 0;
        const sx = frameIndex * fw;
        const sy = 0;

        const scale = 4; // Size
        const dw = fw * scale;
        const dh = fh * scale;
        const dx = Math.round(this.x - dw / 2);
        const dy = Math.round(this.y - dh / 2);

        if (useHit) {
            ctx.globalAlpha = 0.95;
            ctx.filter = 'brightness(1.2)';
        }

        ctx.drawImage(sprite, sx, sy, fw, fh, dx, dy, dw, dh);

        if (useHit) {
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
        }

}

// Tank enemy
export class Tank extends Enemy {
    constructor(x, y) {
        super(x, y, TANK_RADIUS, TANK_HP);
        this.speed = TANK_SPEED;
        this.contactCooldown = 0;
        this.flashTimer = 0;
        this.isFlashing = false;
        this.lastContactTime = 0;

        this.anim = {
            frame: 0,
            timer: 0,
            frameCount: 6,
            frameDuration: 0.2
        };

        this.deathAnim = {
            frame: 0,
            frameCount: 8,
            frameDuration: 0.08 // 8*0.08=0.64s
        };
        this.deathDuration = this.deathAnim.frameCount * this.deathAnim.frameDuration;

    }
    
    update(deltaTime, player, bounds) {
        if (!player.isAlive()) return;
        
        this.contactCooldown -= deltaTime;
        this.flashTimer -= deltaTime;
        
        if (this.flashTimer <= 0) {
            this.isFlashing = false;
        }
        
        // Move towards player (slow pursuit)
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Utils.distance(this.x, this.y, player.x, player.y);
        
        if (distance > 0) {
            const normalized = Utils.normalize(dx, dy);
            this.vx = normalized.x * this.speed;
            this.vy = normalized.y * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }
        
        super.update(deltaTime, player, bounds);

        if (this.isDying) {
            this.vx = 0; this.vy = 0;
            const idx = Math.floor(this.deathTimer / this.deathAnim.frameDuration);
            this.deathAnim.frame = Math.min(idx, this.deathAnim.frameCount - 1);
        }
        
        // Keep in bounds
        this.x = Utils.clamp(this.x, this.radius, bounds.width - this.radius);
        this.y = Utils.clamp(this.y, this.radius, bounds.height - this.radius);
        
        // Update animation frame
        this.anim.timer += deltaTime;
        if (this.anim.timer >= this.anim.frameDuration) {
            this.anim.timer = 0;
            this.anim.frame = (this.anim.frame + 1) % this.anim.frameCount;
        }
        
        // Check for contact damage
        if (this.contactCooldown <= 0 && player.canTakeDamage()) {
            const playerDistance = Utils.distance(this.x, this.y, player.x, player.y);
            if (playerDistance < this.radius + player.radius) {
                this.dealContactDamage(player);
            }
        }
    }
    
    dealContactDamage(player) {
        player.takeDamage(1);
        this.contactCooldown = TANK_CONTACT_COOLDOWN;
        
        // Apply knockback to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Utils.distance(this.x, this.y, player.x, player.y);
        
        if (distance > 0) {
            const normalized = Utils.normalize(dx, dy);
            player.x += normalized.x * TANK_KNOCKBACK;
            player.y += normalized.y * TANK_KNOCKBACK;
        }
    }
    
    takeDamage(damage) {
        super.takeDamage(damage);
        
        // Flash white when hit
        this.isFlashing = true;
        this.flashTimer = TANK_FLASH_DURATION;
    }
    
    render(ctx, imageLoader = null) {
        ctx.save();

        if (this.isDying) {
            const sprite = imageLoader?.getImage('tank_death');
            if (sprite) {
                const frames = this.deathAnim.frameCount;
                const fw = (sprite.width / frames) | 0;
                const fh = sprite.height | 0;
                const sx = this.deathAnim.frame * fw;
                const sy = 0;
                const scale = 3.5;
                const dw = fw * scale;
                const dh = fh * scale;
                ctx.drawImage(sprite, sx, sy, fw, fh, Math.round(this.x - dw/2), Math.round(this.y - dh/2), dw, dh);
            } else {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#880000';
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
            return;
        }

        const sprite = imageLoader?.getImage('tank');
        if (!sprite) {
            ctx.fillStyle = this.isFlashing ? '#FFFFFF' : '#880000';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
            ctx.restore(); return;
        }

        const fw = sprite.width / this.anim.frameCount;
        const fh = sprite.height;
        const sx = this.anim.frame * fw;
        const sy = 0;

        const angle = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle + Math.PI / 2);

        const scale = 3.5;
        const dw = fw * scale;
        const dh = fh * scale;

        if (this.isFlashing) {
            ctx.globalAlpha = 0.6;
            ctx.filter = 'brightness(1.8)';
        }

        ctx.drawImage(sprite, sx, sy, fw, fh, -dw/2, -dh/2, dw, dh);
        ctx.restore();
        }

}

// Base Weapon class
export class Weapon {
    constructor(fireRate, ammo = -1) {
        this.fireRate = fireRate; // seconds between shots
        this.ammo = ammo; // -1 for infinite
        this.currentAmmo = ammo;
        this.lastFireTime = 0;
        this.owner = null;
    }
    
    update(deltaTime) {
        // Override in subclasses if needed
    }
    
    canFire() {
        const now = Date.now() / 1000;
        const timeSinceLastFire = now - this.lastFireTime;
        return timeSinceLastFire >= this.fireRate && 
               (this.ammo === -1 || this.currentAmmo > 0);
    }
    
    fire(fromX, fromY, targetX, targetY, projectiles) {
        if (!this.canFire()) return false;
        
        const projectile = this.createProjectile(fromX, fromY, targetX, targetY);
        if (projectile) {
            projectiles.push(projectile);
            this.lastFireTime = Date.now() / 1000;
            
            if (this.ammo > 0) {
                this.currentAmmo--;
            }
            
            return true;
        }
        
        return false;
    }
    
    createProjectile(fromX, fromY, targetX, targetY) {
        // Override in subclasses
        return null;
    }
    
    getAmmoDisplay() {
        return this.ammo === -1 ? '∞' : this.currentAmmo.toString();
    }
    
    reload() {
        if (this.ammo > 0) {
            this.currentAmmo = this.ammo;
        }
    }
}

// Pistol weapon (implemented)
export class Pistol extends Weapon {
    constructor() {
        super(PISTOL_FIRE_RATE, -1); // 1 second fire rate, infinite ammo
    }
    
    createProjectile(fromX, fromY, targetX, targetY) {
        const dx = targetX - fromX;
        const dy = targetY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return null;
        
        const normalized = Utils.normalize(dx, dy);
        
        return new Projectile(
            fromX, fromY,
            normalized.x * BULLET_SPEED,
            normalized.y * BULLET_SPEED,
            BULLET_RADIUS,
            1, // damage
            '#FFFF00', // color
            'player'
        );
    }
}

// Machine Gun weapon
export class MachineGun extends Weapon {
    constructor() {
        super(MACHINE_GUN_FIRE_RATE, MACHINE_GUN_AMMO);
    }
    
    canFire() {
        const now = Date.now() / 1000;
        const canFireByTime = (now - this.lastFireTime) >= this.fireRate;
        const hasAmmo = this.currentAmmo > 0;
        return canFireByTime && hasAmmo;
    }
    
    createProjectile(fromX, fromY, targetX, targetY) {
        // Calculate direction
        const dx = targetX - fromX;
        const dy = targetY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return null;
        
        // Normalize and apply speed
        const vx = (dx / distance) * BULLET_SPEED;
        const vy = (dy / distance) * BULLET_SPEED;
        
        return new Projectile(
            fromX, fromY,
            vx, vy,
            BULLET_RADIUS,
            1, // damage
            '#4A90E2', // blue color to distinguish from pistol
            'player'
        );
    }
    
    getAmmoDisplay() {
        return this.currentAmmo.toString();
    }
}

// Knife weapon
export class Knife extends Weapon {
    constructor() {
        super(KNIFE_COOLDOWN_S, -1); // Infinite ammo
        this.slashStartTime = 0;
        this.slashDuration = 0.5; // seconds to show slash effect - strictly 0.5s as required
    }
    
    get name() {
        return 'Knife';
    }
    
    fire(fromX, fromY, targetX, targetY, projectiles, enemies = [], player = null) {
        if (!this.canFire()) return false;
        
        const now = Date.now() / 1000;
        this.lastFireTime = now;
        this.slashStartTime = now;
        
        // Calculate player facing direction
        const dx = targetX - fromX;
        const dy = targetY - fromY;
        const facingAngle = Math.atan2(dy, dx);
        
        // Kill all enemies in the sector
        if (enemies && player) {
            enemies.forEach(enemy => {
                if (!enemy.isAlive()) return;
                
                // Calculate distance to enemy
                const enemyDx = enemy.x - fromX;
                const enemyDy = enemy.y - fromY;
                const distance = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
                
                // Check if enemy is within range
                if (distance <= (KNIFE_RANGE_PT + enemy.radius)) {
                    // Calculate angle to enemy
                    const enemyAngle = Math.atan2(enemyDy, enemyDx);
                    
                    // Calculate angle difference
                    let angleDiff = Math.abs(enemyAngle - facingAngle);
                    if (angleDiff > Math.PI) {
                        angleDiff = 2 * Math.PI - angleDiff;
                    }
                    
                    // Check if enemy is within the arc
                    const halfArcRad = (KNIFE_ARC_DEG / 2) * (Math.PI / 180);
                    if (angleDiff <= halfArcRad) {
                        enemy.takeDamage(1); // Same damage as bullets
                    }
                }
            });
        }
        
        return true;
    }
    
    render(ctx, imageLoader, fromX, fromY, targetX, targetY) {
        const now = Date.now() / 1000;
        if (now - this.slashStartTime < this.slashDuration) {
            // Calculate facing direction
            const dx = targetX - fromX;
            const dy = targetY - fromY;
            const angle = Math.atan2(dy, dx);
            
            // Render 120-degree arc attack area for visual feedback
            const halfArcRad = (KNIFE_ARC_DEG / 2) * (Math.PI / 180);
            const animationProgress = (now - this.slashStartTime) / this.slashDuration;
            
            ctx.save();
            ctx.translate(fromX, fromY);
            
            // Draw the 120-degree attack arc
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, KNIFE_RANGE_PT, angle - halfArcRad, angle + halfArcRad);
            ctx.closePath();
            
            // Visual effect that fades out over time
            const alpha = (1 - animationProgress) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`; // Yellow semi-transparent
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 2})`; // Golden border
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Render slash effect if available
            if (imageLoader && imageLoader.getImage('slash')) {
                const slashImage = imageLoader.getImage('slash');
                const scale = KNIFE_RANGE_PT / 40; // Scale to match range
                
                ctx.rotate(angle);
                ctx.globalAlpha = 1 - animationProgress;
                ctx.drawImage(
                    slashImage,
                    -slashImage.width * scale / 2,
                    -slashImage.height * scale / 2,
                    slashImage.width * scale,
                    slashImage.height * scale
                );
            }
            
            ctx.restore();
        }
    }
    
    getAmmoDisplay() {
        return '∞';
    }
}

// Grenade weapon
export class Grenade extends Weapon {
    constructor() {
        super(GRENADE_COOLDOWN_S, GRENADE_AMMO_INITIAL);
        this.explosions = []; // Track active explosions
    }
    
    get name() {
        return 'Grenade';
    }
    
    canFire() {
        const now = Date.now() / 1000;
        const canFireByTime = (now - this.lastFireTime) >= this.fireRate;
        const hasAmmo = this.currentAmmo > 0;
        return canFireByTime && hasAmmo;
    }
    
    fire(fromX, fromY, targetX, targetY, projectiles) {
        if (!this.canFire()) return false;
        
        const now = Date.now() / 1000;
        this.lastFireTime = now;
        this.currentAmmo--;
        
        // Create grenade projectile
        const dx = targetX - fromX;
        const dy = targetY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return false;
        
        const vx = (dx / distance) * GRENADE_SPEED_PT_S;
        const vy = (dy / distance) * GRENADE_SPEED_PT_S;
        
        const grenadeProjectile = new GrenadeProjectile(
            fromX, fromY,
            vx, vy,
            GRENADE_RADIUS_PT,
            0, // No direct damage
            '#4A4A4A',
            'player',
            now + GRENADE_FUSE_S,
            this
        );
        
        projectiles.push(grenadeProjectile);
        return true;
    }
    
    explode(x, y, enemies) {
        console.log('🔥 Explode function called at:', x, y, 'with enemies:', enemies ? enemies.length : 0);
        
        // Create explosion effect
        const explosion = {
            x: x,
            y: y,
            startTime: Date.now() / 1000,
            duration: 0.3
        };
        this.explosions.push(explosion);
        console.log('💥 Explosion effect created at:', x, y, 'Explosions count:', this.explosions.length);
        
        // Damage all enemies in explosion radius
        if (enemies) {
            let enemiesHit = 0;
            enemies.forEach(enemy => {
                if (!enemy.isAlive()) {
                    console.log('⚰️ Enemy already dead, skipping');
                    return;
                }
                
                const dx = enemy.x - x;
                const dy = enemy.y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const explosionRange = GRENADE_EXPLOSION_RADIUS_PT + enemy.radius;
                
                console.log(`🎯 Enemy at (${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}): distance=${distance.toFixed(1)}, range=${explosionRange.toFixed(1)}`);
                
                if (distance <= explosionRange) {
                    console.log('💀 Enemy in explosion range, dealing damage!');
                    const prevHp = enemy.hp;
                    enemy.takeDamage(999); // Instant kill
                    console.log(`⚡ Enemy HP: ${prevHp} -> ${enemy.hp}, alive: ${enemy.isAlive()}`);
                    enemiesHit++;
                } else {
                    console.log('🚫 Enemy outside explosion range');
                }
            });
            console.log(`🎆 Explosion complete! Enemies hit: ${enemiesHit}`);
        } else {
            console.log('❌ No enemies array provided to explode function');
        }
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        // Clean up expired explosions
        const now = Date.now() / 1000;
        this.explosions = this.explosions.filter(explosion => 
            now - explosion.startTime < explosion.duration
        );
    }
    
    render(ctx, imageLoader) {
        // Render explosion effects
        console.log('🎨 Rendering grenade explosions, count:', this.explosions.length);
        
        // Debug imageLoader status
        if (!imageLoader) {
            console.log('❌ ImageLoader is null/undefined');
            return;
        }
        
        console.log('🔍 ImageLoader available, checking explosion image...');
        const explosionImage = imageLoader.getImage('explosion');
        console.log('🔍 Explosion image:', explosionImage ? 'LOADED' : 'NOT FOUND');
        
        if (explosionImage) {
            console.log('🔍 Explosion image dimensions:', explosionImage.width, 'x', explosionImage.height);
            const now = Date.now() / 1000;
            
            this.explosions.forEach((explosion, index) => {
                const elapsed = now - explosion.startTime;
                const progress = elapsed / explosion.duration;
                
                if (progress >= 1.0) {
                    console.log(`⏰ Explosion ${index} finished, removing...`);
                    return; // Skip expired explosions
                }
                
                const scale = (GRENADE_EXPLOSION_RADIUS_PT * 2) / explosionImage.width;
                
                console.log(`🎨 Rendering explosion ${index}: progress=${progress.toFixed(2)}, alpha=${(1 - progress).toFixed(2)}, scale=${scale.toFixed(2)}`);
                
                ctx.save();
                ctx.translate(explosion.x, explosion.y);
                ctx.globalAlpha = 1 - progress;
                ctx.drawImage(
                    explosionImage,
                    -explosionImage.width * scale / 2,
                    -explosionImage.height * scale / 2,
                    explosionImage.width * scale,
                    explosionImage.height * scale
                );
                ctx.restore();
            });
        } else {
            console.log('❌ No explosion image available');
            // Fallback rendering for debugging
            if (this.explosions.length > 0) {
                console.log('🎨 Using fallback circle rendering for explosions');
                const now = Date.now() / 1000;
                
                this.explosions.forEach((explosion, index) => {
                    const elapsed = now - explosion.startTime;
                    const progress = elapsed / explosion.duration;
                    
                    if (progress < 1.0) {
                        ctx.save();
                        ctx.globalAlpha = 1 - progress;
                        ctx.fillStyle = '#FF6600';
                        ctx.beginPath();
                        ctx.arc(explosion.x, explosion.y, GRENADE_EXPLOSION_RADIUS_PT * (0.5 + progress * 0.5), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                });
            }
        }
    }
    
    getAmmoDisplay() {
        return this.currentAmmo.toString();
    }
}

// Projectile class
export class Projectile extends Entity {
    constructor(x, y, vx, vy, radius, damage, color, owner) {
        super(x, y, radius);
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.color = color;
        this.owner = owner;
        this.lifetime = 3.0; // seconds
        this.age = 0;
    }
    
    update(deltaTime, bounds) {
        super.update(deltaTime);
        this.age += deltaTime;
        
        // Remove if too old or out of bounds
        if (this.age >= this.lifetime ||
            this.x < -this.radius || this.x > bounds.width + this.radius ||
            this.y < -this.radius || this.y > bounds.height + this.radius) {
            this.alive = false;
        }
    }
    
    render(ctx, imageLoader = null) {
        ctx.save();
        
        // Try sprite rendering first
        if (imageLoader) {
            let spriteKey = null;
            
            // Determine sprite based on owner and color
            if (this.owner === 'player') {
                spriteKey = 'bullet_player';
            } else if (this.owner === 'shooter' || this.color === '#FF3B30') {
                spriteKey = 'bullet_shooter';
            }
            
            if (spriteKey) {
                const sprite = imageLoader.getImage(spriteKey);
                if (sprite) {
                    const size = 2 * this.radius;
                    
                    // Calculate rotation based on velocity
                    const angle = Math.atan2(this.vy, this.vx);
                    
                    ctx.translate(this.x, this.y);
                    ctx.rotate(angle);
                    ctx.drawImage(sprite, -size/2, -size/2, size, size);
                    ctx.restore();
                    return;
                }
            }
        }
        
        // Fallback to geometry rendering
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Enemy Registry
export const ENEMY_REGISTRY = {
    'assassin': Assassin,
    'shooter': Shooter,
    'tank': Tank
};

// Weapon Registry
export const WEAPON_REGISTRY = {
    'pistol': Pistol,
    'machine_gun': MachineGun,
    'knife': Knife,
    'grenade': Grenade
};

// Grenade projectile
export class GrenadeProjectile extends Projectile {
    constructor(x, y, vx, vy, radius, damage, color, owner, explodeTime, grenadeWeapon) {
        super(x, y, vx, vy, radius, damage, color, owner);
        this.explodeTime = explodeTime;
        this.grenadeWeapon = grenadeWeapon;
        this.hasExploded = false;
    }
    
    update(deltaTime, bounds, enemies = null) {
        if (this.hasExploded) return;
        
        const now = Date.now() / 1000;
        
        console.log(`🎯 Grenade update: pos(${this.x.toFixed(1)}, ${this.y.toFixed(1)}), alive: ${this.alive}, bounds: ${bounds.width}x${bounds.height}, enemies: ${enemies ? enemies.length : 0}, timeLeft: ${(this.explodeTime - now).toFixed(2)}s`);
        
        // Check collision with enemies first
        if (enemies) {
            for (let enemy of enemies) {
                if (!enemy.isAlive()) continue;
                
                const dx = this.x - enemy.x;
                const dy = this.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Increase collision threshold for better detection
                const collisionThreshold = Math.max(this.radius + enemy.radius + 10, 40); // Minimum 40px detection radius with extra buffer
                
                console.log(`🔍 Checking enemy at (${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}): distance=${distance.toFixed(1)}, threshold=${collisionThreshold.toFixed(1)}`);
                
                // If grenade hits an enemy, explode immediately
                if (distance <= collisionThreshold) {
                    console.log('💥 Grenade hit enemy, exploding immediately!');
                    this.grenadeWeapon.explode(this.x, this.y, enemies);
                    this.hasExploded = true;
                    this.alive = false; // Mark for removal
                    return;
                }
            }
        }
        
        // Check if it's time to explode (original timer logic)
        if (now >= this.explodeTime) {
            console.log('⏰ Grenade timer expired, exploding!');
            this.grenadeWeapon.explode(this.x, this.y, enemies);
            this.hasExploded = true;
            this.alive = false; // Mark for removal
            return;
        }
        
        // Check bounds before calling super.update to avoid premature removal
        const isOutOfBounds = this.x < -this.radius || this.x > bounds.width + this.radius ||
                             this.y < -this.radius || this.y > bounds.height + this.radius;
        
        if (isOutOfBounds) {
            console.log('🚫 Grenade went out of bounds, removing without explosion');
            this.alive = false;
            return;
        }
        
        // Normal projectile movement (but skip the bounds check in parent)
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.age += deltaTime;
        
        console.log(`🚀 Grenade moved to (${this.x.toFixed(1)}, ${this.y.toFixed(1)}), age: ${this.age.toFixed(2)}s`);
    }
    
    render(ctx, imageLoader = null) {
        if (this.hasExploded) return;
        
        if (imageLoader && imageLoader.getImage('grenade')) {
            const grenadeImage = imageLoader.getImage('grenade');
            const scale = (this.radius * 2) / grenadeImage.width;
            
            // Calculate rotation based on velocity
            const angle = Math.atan2(this.vy, this.vx);
            
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            ctx.drawImage(
                grenadeImage,
                -grenadeImage.width * scale / 2,
                -grenadeImage.height * scale / 2,
                grenadeImage.width * scale,
                grenadeImage.height * scale
            );
            ctx.restore();
        } else {
            // Fallback to geometry rendering
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
        }
    }
}

// ShooterBullet - enemy projectile with lifetime
export class ShooterBullet extends Projectile {
    constructor(x, y, vx, vy, radius, damage, color, owner) {
        super(x, y, vx, vy, radius, damage, color, owner);
        this.lifetime = SHOOTER_BULLET_LIFETIME; // Override parent's lifetime
        // Remove redundant age tracking - parent class handles it
    }
    
    // No need to override update - parent class handles lifetime properly
}

// Pickup System
const PICKUP_RADIUS = 28;

export const PICKUP_TYPES = {
    MG_AMMO: 'mg_ammo',
    GRENADE: 'grenade',
    HEAL: 'heal',
    PISTOL_HASTE: 'pistol_haste'
};

export class Pickup extends Entity {
    constructor(x, y, type) {
        super(x, y, PICKUP_RADIUS);
        this.type = type;
    }

    update(deltaTime) {
        // Static pickups for now; room for future animations
    }

    getSpriteKey() {
        switch (this.type) {
            case PICKUP_TYPES.MG_AMMO: return 'pickup_mg';
            case PICKUP_TYPES.GRENADE: return 'pickup_grenade';
            case PICKUP_TYPES.HEAL: return 'pickup_heal';
            case PICKUP_TYPES.PISTOL_HASTE: return 'pickup_haste';
            default: return null;
        }
    }

    render(ctx, imageLoader = null) {
        const key = this.getSpriteKey();
        const img = imageLoader?.getImage(key);
        const size = this.radius * 2;

        if (img) {
            ctx.save();
            ctx.drawImage(img, Math.round(this.x - size/2), Math.round(this.y - size/2), size, size);
            ctx.restore();
            return;
        }

        // Fallback: distinct simple icons
        ctx.save();
        const scale = this.radius / 14; // base glyph sizes tuned to radius=14
        // Outer base
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = '#777';
        ctx.stroke();

        // Inner glyph by type (scaled proportionally)
        switch (this.type) {
            case PICKUP_TYPES.MG_AMMO: {
                // Three yellow bullets
                ctx.fillStyle = '#FFD54F';
                const bw = 4 * scale, bh = 10 * scale; // bullet width/height
                const spacing = 6 * scale;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.roundRect(this.x + i * spacing - bw/2, this.y - bh/2, bw, bh, 2 * scale);
                    ctx.fill();
                }
                break;
            }
            case PICKUP_TYPES.GRENADE: {
                // Green grenade body + handle
                ctx.fillStyle = '#2E7D32';
                ctx.beginPath();
                ctx.arc(this.x, this.y + 2 * scale, 7 * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#66BB6A';
                ctx.fillRect(this.x - 5 * scale, this.y - 8 * scale, 10 * scale, 3 * scale);
                break;
            }
            case PICKUP_TYPES.HEAL: {
                // Red heart
                ctx.fillStyle = '#E53935';
                ctx.beginPath();
                const r = 4 * scale;
                ctx.arc(this.x - r, this.y - r, r, 0, Math.PI * 2);
                ctx.arc(this.x + r, this.y - r, r, 0, Math.PI * 2);
                ctx.moveTo(this.x - r * 2, this.y - r);
                ctx.lineTo(this.x, this.y + r * 2);
                ctx.lineTo(this.x + r * 2, this.y - r);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case PICKUP_TYPES.PISTOL_HASTE: {
                // Orange clock
                ctx.strokeStyle = '#FFB300';
                ctx.lineWidth = 2 * scale;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 8 * scale, 0, Math.PI * 2);
                ctx.stroke();
                // Hands
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + 5 * scale, this.y);
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x, this.y - 3 * scale);
                ctx.stroke();
                break;
            }
        }
        ctx.restore();
    }
}