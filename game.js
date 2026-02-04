// ============================================
// DINO RUNNER - UMBRELLA EDITION
// Chrome Dino-style game with asteroid defense
// ============================================

// Canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const currentScoreEl = document.getElementById('currentScore');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const gameContainer = document.getElementById('game-container');

// ============================================
// GAME CONSTANTS
// ============================================
const GROUND_Y = 325;           // Ground level (canvas is 375 tall)
const GRAVITY = 0.8;            // Gravity strength
const JUMP_FORCE = -15;         // Jump velocity
const BASE_SPEED = 5;           // Starting game speed
const MAX_SPEED = 18;           // Maximum game speed
const SPEED_INCREMENT = 0.002;  // Speed increase per frame (faster ramp up)

// ============================================
// GAME STATE
// ============================================
let gameState = 'start'; // 'start', 'playing', 'paused', 'gameover', 'victory'
let score = 0;
let highScore = parseInt(localStorage.getItem('dinoHighScore')) || 0;
let gameSpeed = BASE_SPEED;
let frameCount = 0;

// Era system based on levels
// Level 1: Normal
// Level 2-3: Volcano Era
// Level 4-5: Ice Age (Iceberg)
// Level 6-7: Beach (Palm Tree)
// Level 8-10: Civilization (Empire State Building)
let currentEra = 'normal'; // 'normal', 'volcano', 'ice', 'beach', 'civilization'

// Level system
let currentLevel = 1;
const POINTS_PER_LEVEL = 250;
const MAX_LEVEL = 10;
const WIN_SCORE = (MAX_LEVEL * POINTS_PER_LEVEL) + POINTS_PER_LEVEL; // 2750 points to win
let freePlayMode = false;
let levelUpAnimation = 0; // Timer for level up animation

// Bonus text popups
const bonusTexts = [];

// ============================================
// SOUND SYSTEM (Web Audio API)
// ============================================
let audioCtx = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency, duration, type = 'square', volume = 0.3) {
    if (isMuted || !audioCtx) return;
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

// Sound effects
function playJumpSound() {
    if (isMuted || !audioCtx) return;
    playTone(400, 0.1, 'square', 0.2);
    setTimeout(() => playTone(600, 0.1, 'square', 0.15), 50);
}

function playBonusSound() {
    if (isMuted || !audioCtx) return;
    playTone(880, 0.08, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.15), 60);
}

function playLevelUpSound() {
    if (isMuted || !audioCtx) return;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.15, 'square', 0.2), i * 100);
    });
}

function playGameOverSound() {
    if (isMuted || !audioCtx) return;
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, 'square', 0.25), i * 150);
    });
}

function playVictorySound() {
    if (isMuted || !audioCtx) return;
    const notes = [523, 659, 784, 1047, 1047, 784, 1047]; // Fanfare
    const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.15, 0.4];
    let time = 0;
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, durations[i], 'square', 0.25), time);
        time += durations[i] * 700;
    });
}

function playStartSound() {
    if (isMuted || !audioCtx) return;
    playTone(440, 0.1, 'square', 0.2);
    setTimeout(() => playTone(550, 0.1, 'square', 0.2), 80);
    setTimeout(() => playTone(660, 0.15, 'square', 0.2), 160);
}

function playShootSound() {
    if (isMuted || !audioCtx) return;
    // Quick gunshot sound - low thud followed by sharp crack
    playTone(150, 0.08, 'square', 0.4);
    setTimeout(() => playTone(800, 0.05, 'sawtooth', 0.2), 20);
}

function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('btn-mute');
    btn.textContent = '♪';
    btn.style.textDecoration = isMuted ? 'line-through' : 'none';
}

// ============================================
// INPUT STATE
// ============================================
const keys = {
    jump: false,     // Space or J
    shoot: false     // O key
};

// Bullets array
const bullets = [];
let shootCooldown = 0;
const SHOOT_COOLDOWN = 20; // Frames between shots

// ============================================
// PLAYER (DINOSAUR)
// ============================================
const player = {
    x: 80,
    y: GROUND_Y,
    width: 40,
    height: 50,
    velocityY: 0,
    isJumping: false,
    isShooting: false,
    shootAnimFrame: 0,
    
    reset() {
        this.y = GROUND_Y;
        this.velocityY = 0;
        this.isJumping = false;
        this.isShooting = false;
        this.shootAnimFrame = 0;
    },
    
    update() {
        // Handle jump
        if (keys.jump && !this.isJumping) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            playJumpSound();
        }
        
        // Handle shooting - cowboy draw style!
        if (keys.shoot && shootCooldown <= 0) {
            this.isShooting = true;
            this.shootAnimFrame = 15; // Animation frames
            shootCooldown = SHOOT_COOLDOWN;
            spawnBullet();
            playShootSound();
        }
        
        // Update shooting animation
        if (this.shootAnimFrame > 0) {
            this.shootAnimFrame--;
            if (this.shootAnimFrame === 0) {
                this.isShooting = false;
            }
        }
        
        // Apply gravity
        this.velocityY += GRAVITY;
        this.y += this.velocityY;
        
        // Ground collision
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.velocityY = 0;
            this.isJumping = false;
        }
    },
    
    draw() {
        ctx.fillStyle = '#535353';
        
        // Draw dinosaur body
        const drawY = this.y - this.height;
        
        // === COWBOY HAT with curled brim and pinched crown ===
        ctx.fillStyle = '#535353';
        
        // Hat crown (top part) - with curved inward top like a real cowboy hat
        ctx.beginPath();
        ctx.moveTo(this.x + 12, drawY - 8);          // Bottom left of crown
        ctx.lineTo(this.x + 12, drawY - 16);         // Left side up
        ctx.quadraticCurveTo(this.x + 14, drawY - 22, this.x + 22, drawY - 18); // Left pinch curve inward
        ctx.quadraticCurveTo(this.x + 30, drawY - 22, this.x + 32, drawY - 16); // Right pinch curve inward
        ctx.lineTo(this.x + 32, drawY - 8);          // Right side down
        ctx.closePath();
        ctx.fill();
        
        // Crown crease detail (the indentation on top)
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(this.x + 16, drawY - 17);
        ctx.quadraticCurveTo(this.x + 22, drawY - 14, this.x + 28, drawY - 17);
        ctx.stroke();
        ctx.fillStyle = '#535353';
        
        // Hat band
        ctx.fillStyle = '#888';
        ctx.fillRect(this.x + 12, drawY - 10, 20, 3);
        ctx.fillStyle = '#535353';
        
        // Hat brim with curled up ends
        ctx.beginPath();
        ctx.moveTo(this.x + 2, drawY - 5);           // Left curl start
        ctx.quadraticCurveTo(this.x + 5, drawY - 12, this.x + 10, drawY - 7);  // Left curl up
        ctx.lineTo(this.x + 34, drawY - 7);          // Flat middle
        ctx.quadraticCurveTo(this.x + 39, drawY - 12, this.x + 42, drawY - 5); // Right curl up
        ctx.lineTo(this.x + 40, drawY - 3);          // Right edge down
        ctx.lineTo(this.x + 4, drawY - 3);           // Bottom of brim
        ctx.lineTo(this.x + 2, drawY - 5);           // Back to start
        ctx.fill();
        
        // Body
        ctx.fillRect(this.x, drawY + 15, 30, 35);
        
        // Head
        ctx.fillRect(this.x + 15, drawY, 25, 20);
        
        // Eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + 32, drawY + 5, 5, 5);
        
        ctx.fillStyle = '#535353';
        
        // Legs (animated)
        const legOffset = Math.sin(frameCount * 0.3) * 5;
        if (!this.isJumping) {
            ctx.fillRect(this.x + 5, drawY + 45, 8, 10 + legOffset);
            ctx.fillRect(this.x + 18, drawY + 45, 8, 10 - legOffset);
        } else {
            // Tucked legs when jumping
            ctx.fillRect(this.x + 5, drawY + 42, 8, 8);
            ctx.fillRect(this.x + 18, drawY + 42, 8, 8);
        }
        
        // Tail
        ctx.fillRect(this.x - 15, drawY + 20, 18, 10);
        
        // === GUN & SHOOTING ===
        if (this.isShooting || this.shootAnimFrame > 0) {
            this.drawGun(drawY);
        }
    },
    
    drawGun(dinoY) {
        const gunX = this.x + 38;
        const gunY = dinoY + 14;
        
        ctx.fillStyle = '#535353';
        
        // Arm extended forward
        ctx.fillRect(this.x + 25, dinoY + 18, 15, 6);
        
        // === COWBOY REVOLVER ===
        
        // Grip/Handle - curved cowboy style
        ctx.beginPath();
        ctx.moveTo(gunX + 2, gunY + 8);
        ctx.lineTo(gunX + 8, gunY + 8);
        ctx.lineTo(gunX + 10, gunY + 18);
        ctx.quadraticCurveTo(gunX + 6, gunY + 22, gunX - 2, gunY + 20);
        ctx.quadraticCurveTo(gunX - 2, gunY + 14, gunX + 2, gunY + 8);
        ctx.fill();
        
        // Grip detail lines
        ctx.fillStyle = '#888';
        ctx.fillRect(gunX + 2, gunY + 12, 5, 1);
        ctx.fillRect(gunX + 1, gunY + 15, 5, 1);
        
        ctx.fillStyle = '#535353';
        
        // Frame/body of revolver
        ctx.fillRect(gunX, gunY + 2, 14, 7);
        
        // Cylinder (the round part that holds bullets)
        ctx.beginPath();
        ctx.arc(gunX + 8, gunY + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Cylinder detail - bullet chambers hint
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(gunX + 8, gunY + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#535353';
        ctx.beginPath();
        ctx.arc(gunX + 8, gunY + 5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel - long cowboy style
        ctx.fillRect(gunX + 12, gunY + 3, 18, 4);
        
        // Barrel top ridge
        ctx.fillStyle = '#888';
        ctx.fillRect(gunX + 12, gunY + 2, 18, 1);
        ctx.fillStyle = '#535353';
        
        // Front sight
        ctx.fillRect(gunX + 28, gunY, 2, 3);
        
        // Trigger guard
        ctx.beginPath();
        ctx.moveTo(gunX + 4, gunY + 8);
        ctx.quadraticCurveTo(gunX + 4, gunY + 14, gunX + 10, gunY + 12);
        ctx.lineTo(gunX + 10, gunY + 8);
        ctx.stroke();
        
        // Trigger
        ctx.fillRect(gunX + 6, gunY + 9, 2, 4);
        
        // Hammer (cocked back)
        ctx.fillRect(gunX - 2, gunY + 1, 4, 4);
        ctx.fillRect(gunX - 3, gunY - 1, 3, 3);
        
        // Muzzle flash when shooting
        if (this.shootAnimFrame > 12) {
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.moveTo(gunX + 30, gunY + 5);
            ctx.lineTo(gunX + 45, gunY - 2);
            ctx.lineTo(gunX + 40, gunY + 5);
            ctx.lineTo(gunX + 45, gunY + 12);
            ctx.lineTo(gunX + 30, gunY + 5);
            ctx.fill();
            
            // Inner flash
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.moveTo(gunX + 30, gunY + 5);
            ctx.lineTo(gunX + 38, gunY + 1);
            ctx.lineTo(gunX + 36, gunY + 5);
            ctx.lineTo(gunX + 38, gunY + 9);
            ctx.lineTo(gunX + 30, gunY + 5);
            ctx.fill();
        }
    },
    
    // Get player hitbox
    getHitbox() {
        return {
            x: this.x,
            y: this.y - this.height + 10,
            width: this.width - 5,
            height: this.height - 10
        };
    }
};

// ============================================
// BULLETS
// ============================================
function spawnBullet() {
    const bulletY = player.y - player.height + 19; // Gun barrel height
    bullets.push({
        x: player.x + 68, // End of revolver barrel
        y: bulletY,
        width: 10,
        height: 4,
        speed: 16
    });
}

function updateBullets() {
    // Update cooldown
    if (shootCooldown > 0) {
        shootCooldown--;
    }
    
    // Move bullets and check collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].speed;
        
        // Check collision with cacti
        let hitCactus = false;
        for (let j = 0; j < cacti.length; j++) {
            const cactus = cacti[j];
            if (bullets[i].x + bullets[i].width > cactus.x &&
                bullets[i].x < cactus.x + cactus.width &&
                bullets[i].y + bullets[i].height > cactus.y &&
                bullets[i].y < cactus.y + cactus.height) {
                hitCactus = true;
                // Create impact particles
                for (let k = 0; k < 5; k++) {
                    particles.push({
                        x: bullets[i].x + bullets[i].width,
                        y: bullets[i].y + bullets[i].height / 2,
                        vx: -Math.random() * 3 - 1,
                        vy: (Math.random() - 0.5) * 4,
                        life: 20 + Math.random() * 10,
                        size: 2 + Math.random() * 2
                    });
                }
                break;
            }
        }
        
        // Remove bullet if hit cactus or off-screen
        if (hitCactus || bullets[i].x > canvas.width + 20) {
            bullets.splice(i, 1);
        }
    }
}

function drawBullets() {
    bullets.forEach(bullet => {
        // Bullet body - revolver round shape
        ctx.fillStyle = '#535353';
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x + bullet.width - 3, bullet.y);
        ctx.quadraticCurveTo(bullet.x + bullet.width + 2, bullet.y + bullet.height / 2, 
                            bullet.x + bullet.width - 3, bullet.y + bullet.height);
        ctx.lineTo(bullet.x, bullet.y + bullet.height);
        ctx.closePath();
        ctx.fill();
        
        // Bullet casing back
        ctx.fillStyle = '#888';
        ctx.fillRect(bullet.x - 2, bullet.y, 3, bullet.height);
        
        // Smoke trail
        ctx.fillStyle = 'rgba(136, 136, 136, 0.5)';
        ctx.fillRect(bullet.x - 12, bullet.y + 1, 10, 2);
    });
}

// ============================================
// OBSTACLES - CACTUS
// ============================================
const cacti = [];

let cactusIdCounter = 0;

function spawnCactus() {
    const types = [
        { width: 20, height: 40 },  // Small
        { width: 25, height: 50 },  // Medium
        { width: 35, height: 45 }   // Wide
    ];
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    cacti.push({
        id: cactusIdCounter++,
        x: canvas.width + 50,
        y: GROUND_Y - type.height,
        width: type.width,
        height: type.height
    });
}

function updateCacti() {
    for (let i = cacti.length - 1; i >= 0; i--) {
        cacti[i].x -= gameSpeed;
        
        // Remove off-screen cacti
        if (cacti[i].x + cacti[i].width < 0) {
            cacti.splice(i, 1);
        }
    }
}

function drawCacti() {
    cacti.forEach(obstacle => {
        // Draw different obstacles based on current era
        if (currentEra === 'ice') {
            drawSpikyIceberg(obstacle);
        } else if (currentEra === 'beach') {
            drawCoconutPile(obstacle);
        } else if (currentEra === 'civilization') {
            drawFireHydrant(obstacle);
        } else {
            drawCactus(obstacle);
        }
    });
}

function drawCactus(cactus) {
    ctx.fillStyle = '#535353';
    // Main trunk
    ctx.fillRect(cactus.x, cactus.y, cactus.width, cactus.height);
    
    // Arms
    if (cactus.width > 22) {
        // Left arm
        ctx.fillRect(cactus.x - 8, cactus.y + 10, 10, 5);
        ctx.fillRect(cactus.x - 8, cactus.y + 5, 5, 15);
        
        // Right arm
        ctx.fillRect(cactus.x + cactus.width - 2, cactus.y + 15, 10, 5);
        ctx.fillRect(cactus.x + cactus.width + 3, cactus.y + 10, 5, 15);
    }
}

function drawSpikyIceberg(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    
    // Main iceberg body (darker grey)
    ctx.fillStyle = '#5a6a70';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w * 0.2, y + h * 0.3);
    ctx.lineTo(x + w * 0.4, y + h * 0.5);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.6, y + h * 0.4);
    ctx.lineTo(x + w * 0.8, y + h * 0.2);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    
    // Ice highlights (medium grey)
    ctx.fillStyle = '#7a8a90';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.55, y + h * 0.25);
    ctx.lineTo(x + w * 0.45, y + h * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Dark edges for spiky look
    ctx.fillStyle = '#3a4a50';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.8, y + h * 0.2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w * 0.85, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
}

function drawCoconutPile(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    
    ctx.fillStyle = '#5a4a3a';
    
    // Bottom row of coconuts
    const coconutR = Math.min(w / 3, h / 3);
    ctx.beginPath();
    ctx.arc(x + coconutR, y + h - coconutR, coconutR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - coconutR, coconutR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - coconutR, y + h - coconutR, coconutR, 0, Math.PI * 2);
    ctx.fill();
    
    // Top coconut
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - coconutR * 2.5, coconutR * 0.9, 0, Math.PI * 2);
    ctx.fill();
    
    // Coconut details (three dots on each)
    ctx.fillStyle = '#3a2a1a';
    const dots = [[x + coconutR, y + h - coconutR], [x + w / 2, y + h - coconutR], [x + w - coconutR, y + h - coconutR], [x + w / 2, y + h - coconutR * 2.5]];
    dots.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + 3, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFireHydrant(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    
    // Main body (dark grey for monochrome theme)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.7);
    
    // Top dome
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.3, w * 0.3, Math.PI, 0, false);
    ctx.fill();
    
    // Top cap
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + w * 0.25, y, w * 0.5, h * 0.15);
    
    // Side nozzles
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(x, y + h * 0.4, w * 0.25, h * 0.15);
    ctx.fillRect(x + w * 0.75, y + h * 0.4, w * 0.25, h * 0.15);
    
    // Base
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + w * 0.1, y + h * 0.85, w * 0.8, h * 0.15);
    
    // Center bolt
    ctx.fillStyle = '#6a6a6a';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.55, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
}


// ============================================
// BACKGROUND ELEMENTS
// ============================================
const clouds = [];
const groundLines = [];

// Era landmarks - all at same X position, rise/fall based on era
const LANDMARK_X = 700;

// Volcano (Level 2-3)
const volcano = {
    x: LANDMARK_X,
    baseY: GROUND_Y,
    width: 80,
    height: 100,
    currentHeight: 0,
    targetHeight: 0,
    eruptionParticles: [],
    lavaGlow: 0
};

// Iceberg (Level 4-5 - Ice Age)
const iceberg = {
    x: LANDMARK_X,
    baseY: GROUND_Y,
    width: 90,
    height: 120,
    currentHeight: 0,
    targetHeight: 0
};

// Palm Tree (Level 6-7 - Beach)
const palmTree = {
    x: LANDMARK_X + 20,
    baseY: GROUND_Y,
    width: 50,
    height: 110,
    currentHeight: 0,
    targetHeight: 0
};

// Empire State Building (Level 8-10 - Civilization)
const empireState = {
    x: LANDMARK_X,
    baseY: GROUND_Y,
    width: 60,
    height: 140,
    currentHeight: 0,
    targetHeight: 0
};


function initBackground() {
    // Initialize clouds
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: 30 + Math.random() * 50,
            width: 40 + Math.random() * 30
        });
    }
    
    // Initialize ground texture lines
    for (let i = 0; i < 20; i++) {
        groundLines.push({
            x: Math.random() * canvas.width,
            width: 10 + Math.random() * 30
        });
    }
}

function updateBackground() {
    // Update clouds
    clouds.forEach(cloud => {
        cloud.x -= gameSpeed * 0.2;
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width + 50;
            cloud.y = 30 + Math.random() * 50;
        }
    });
    
    // Update ground lines
    groundLines.forEach(line => {
        line.x -= gameSpeed;
        if (line.x + line.width < 0) {
            line.x = canvas.width + Math.random() * 100;
        }
    });
    
    // Update all landmarks (they rise/fall based on era)
    updateLandmarks();
}

function updateLandmarks() {
    const riseSpeed = 0.8;
    const fallSpeed = 1.2;
    
    // Update volcano height
    if (volcano.currentHeight < volcano.targetHeight) {
        volcano.currentHeight = Math.min(volcano.targetHeight, volcano.currentHeight + riseSpeed);
    } else if (volcano.currentHeight > volcano.targetHeight) {
        volcano.currentHeight = Math.max(volcano.targetHeight, volcano.currentHeight - fallSpeed);
    }
    
    // Update iceberg height
    if (iceberg.currentHeight < iceberg.targetHeight) {
        iceberg.currentHeight = Math.min(iceberg.targetHeight, iceberg.currentHeight + riseSpeed);
    } else if (iceberg.currentHeight > iceberg.targetHeight) {
        iceberg.currentHeight = Math.max(iceberg.targetHeight, iceberg.currentHeight - fallSpeed);
    }
    
    // Update palm tree height
    if (palmTree.currentHeight < palmTree.targetHeight) {
        palmTree.currentHeight = Math.min(palmTree.targetHeight, palmTree.currentHeight + riseSpeed);
    } else if (palmTree.currentHeight > palmTree.targetHeight) {
        palmTree.currentHeight = Math.max(palmTree.targetHeight, palmTree.currentHeight - fallSpeed);
    }
    
    // Update empire state height
    if (empireState.currentHeight < empireState.targetHeight) {
        empireState.currentHeight = Math.min(empireState.targetHeight, empireState.currentHeight + riseSpeed);
    } else if (empireState.currentHeight > empireState.targetHeight) {
        empireState.currentHeight = Math.max(empireState.targetHeight, empireState.currentHeight - fallSpeed);
    }
    
    // Volcano eruption particles (only when visible)
    if (volcano.currentHeight > volcano.height * 0.8) {
        volcano.lavaGlow = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
        
        if (Math.random() < 0.15) {
            volcano.eruptionParticles.push({
                x: volcano.x + volcano.width / 2 + (Math.random() - 0.5) * 20,
                y: volcano.baseY - volcano.currentHeight,
                vx: (Math.random() - 0.5) * 3,
                vy: -3 - Math.random() * 4,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                size: 4 + Math.random() * 6,
                type: Math.random() < 0.7 ? 'fire' : 'rock'
            });
        }
    }
    
    // Update eruption particles
    for (let i = volcano.eruptionParticles.length - 1; i >= 0; i--) {
        const p = volcano.eruptionParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        if (p.life <= 0 || p.y > GROUND_Y) {
            volcano.eruptionParticles.splice(i, 1);
        }
    }
}


function drawVolcano() {
    if (volcano.currentHeight <= 0) return;
    
    // Draw volcano mountain
    ctx.fillStyle = '#3d3d3d';
    ctx.beginPath();
    ctx.moveTo(volcano.x, volcano.baseY);
    ctx.lineTo(volcano.x + volcano.width / 2 - 15, volcano.baseY - volcano.currentHeight);
    ctx.lineTo(volcano.x + volcano.width / 2 + 15, volcano.baseY - volcano.currentHeight);
    ctx.lineTo(volcano.x + volcano.width, volcano.baseY);
    ctx.closePath();
    ctx.fill();
    
    // Draw crater glow
    if (volcano.currentHeight >= volcano.height * 0.8) {
        const gradient = ctx.createRadialGradient(
            volcano.x + volcano.width / 2, volcano.baseY - volcano.currentHeight + 5, 5,
            volcano.x + volcano.width / 2, volcano.baseY - volcano.currentHeight + 5, 25
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${volcano.lavaGlow})`);
        gradient.addColorStop(0.5, `rgba(200, 200, 200, ${volcano.lavaGlow * 0.5})`);
        gradient.addColorStop(1, 'rgba(150, 150, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(volcano.x + volcano.width / 2, volcano.baseY - volcano.currentHeight + 5, 25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw eruption particles
    volcano.eruptionParticles.forEach(p => {
        const alpha = p.life / p.maxLife;
        const grey = p.type === 'fire' ? 180 + Math.floor(Math.random() * 50) : 60;
        ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawIceberg() {
    if (iceberg.currentHeight <= 0) return;
    
    const h = iceberg.currentHeight;
    const x = iceberg.x;
    const y = iceberg.baseY;
    
    // Main iceberg body (jagged shape)
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 15, y - h * 0.7);
    ctx.lineTo(x + 30, y - h * 0.5);
    ctx.lineTo(x + 45, y - h);
    ctx.lineTo(x + 60, y - h * 0.6);
    ctx.lineTo(x + 75, y - h * 0.8);
    ctx.lineTo(x + 90, y);
    ctx.closePath();
    ctx.fill();
    
    // Ice highlights
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.moveTo(x + 45, y - h);
    ctx.lineTo(x + 50, y - h * 0.7);
    ctx.lineTo(x + 40, y - h * 0.75);
    ctx.closePath();
    ctx.fill();
    
    // Darker ice shadows
    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.moveTo(x + 60, y - h * 0.6);
    ctx.lineTo(x + 75, y - h * 0.8);
    ctx.lineTo(x + 80, y - h * 0.3);
    ctx.lineTo(x + 70, y - h * 0.4);
    ctx.closePath();
    ctx.fill();
}

function drawPalmTree() {
    if (palmTree.currentHeight <= 0) return;
    
    const h = palmTree.currentHeight;
    const x = palmTree.x;
    const y = palmTree.baseY;
    
    // Trunk
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x + 28, y - h * 0.85);
    ctx.lineTo(x + 22, y - h * 0.85);
    ctx.closePath();
    ctx.fill();
    
    // Trunk texture lines
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
        const ty = y - (h * 0.85 * i / 8);
        ctx.beginPath();
        ctx.moveTo(x + 20, ty);
        ctx.lineTo(x + 30, ty);
        ctx.stroke();
    }
    
    // Palm fronds (grey leaves)
    ctx.fillStyle = '#707070';
    const leafY = y - h;
    
    // Left fronds
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x - 10, leafY - 10, x - 20, leafY + 20);
    ctx.quadraticCurveTo(x, leafY + 5, x + 25, leafY + 15);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x - 5, leafY - 25, x - 15, leafY - 5);
    ctx.quadraticCurveTo(x + 5, leafY, x + 25, leafY + 15);
    ctx.fill();
    
    // Right fronds
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x + 60, leafY - 10, x + 70, leafY + 20);
    ctx.quadraticCurveTo(x + 50, leafY + 5, x + 25, leafY + 15);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x + 55, leafY - 25, x + 65, leafY - 5);
    ctx.quadraticCurveTo(x + 45, leafY, x + 25, leafY + 15);
    ctx.fill();
    
    // Top frond
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x + 25, leafY - 30, x + 30, leafY - 20);
    ctx.quadraticCurveTo(x + 25, leafY - 10, x + 25, leafY + 15);
    ctx.fill();
}

function drawEmpireState() {
    if (empireState.currentHeight <= 0) return;
    
    const h = empireState.currentHeight;
    const x = empireState.x;
    const y = empireState.baseY;
    
    // Main building body
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 10, y - h * 0.65, 40, h * 0.65);
    
    // Middle section (narrower)
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(x + 15, y - h * 0.8, 30, h * 0.15);
    
    // Upper section (even narrower)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 20, y - h * 0.9, 20, h * 0.1);
    
    // Spire
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.moveTo(x + 27, y - h * 0.9);
    ctx.lineTo(x + 30, y - h);
    ctx.lineTo(x + 33, y - h * 0.9);
    ctx.closePath();
    ctx.fill();
    
    // Windows (grid pattern)
    ctx.fillStyle = '#707070';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
            const wx = x + 14 + col * 9;
            const wy = y - h * 0.6 + row * (h * 0.07);
            ctx.fillRect(wx, wy, 5, 4);
        }
    }
}

function drawLandmarks() {
    drawVolcano();
    drawIceberg();
    drawPalmTree();
    drawEmpireState();
}


function drawBackground() {
    // Draw all landmarks behind everything
    drawLandmarks();
    
    // Draw clouds
    ctx.fillStyle = '#e0e0e0';
    clouds.forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 15, 0, Math.PI * 2);
        ctx.arc(cloud.x + 20, cloud.y - 5, 18, 0, Math.PI * 2);
        ctx.arc(cloud.x + 40, cloud.y, 15, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw ground line
    ctx.fillStyle = '#535353';
    ctx.fillRect(0, GROUND_Y, canvas.width, 2);
    
    // Draw ground texture
    ctx.fillStyle = '#c0c0c0';
    groundLines.forEach(line => {
        ctx.fillRect(line.x, GROUND_Y + 5, line.width, 2);
    });
}

// ============================================
// COLLISION DETECTION
// ============================================
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Track cacti that have been checked for near miss (to avoid double bonus)
const passedCacti = new Set();

function checkCollisions() {
    const playerHitbox = player.getHitbox();
    
    // Check cactus collisions and near misses
    for (let i = cacti.length - 1; i >= 0; i--) {
        const cactus = cacti[i];
        
        // Check for collision
        if (checkCollision(playerHitbox, cactus)) {
            return true; // Game over
        }
        
        // Check for near miss bonus (player just cleared the cactus)
        if (player.isJumping && !passedCacti.has(cactus.id)) {
            const playerBottom = playerHitbox.y + playerHitbox.height;
            const cactusTop = cactus.y;
            const horizontalOverlap = playerHitbox.x < cactus.x + cactus.width && 
                                      playerHitbox.x + playerHitbox.width > cactus.x;
            
            // If player is directly above cactus with small clearance (within 25 pixels)
            if (horizontalOverlap && playerBottom < cactusTop && cactusTop - playerBottom < 25) {
                passedCacti.add(cactus.id);
                score += 25;
                createBonusText(cactus.x + cactus.width / 2, cactus.y - 20, 'CLOSE! +25', '#333');
                playBonusSound();
            }
        }
        
        // Clean up passed cacti tracking when cactus goes off screen
        if (cactus.x + cactus.width < 0) {
            passedCacti.delete(cactus.id);
        }
    }
    
    return false;
}

// ============================================
// VISUAL EFFECTS
// ============================================
const particles = [];

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vy += 0.3; // Gravity on particles
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    ctx.fillStyle = '#535353';
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 20;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

function screenShake() {
    gameContainer.classList.add('shake');
    setTimeout(() => gameContainer.classList.remove('shake'), 300);
}

// ============================================
// BONUS TEXT POPUPS
// ============================================
function createBonusText(x, y, text, color) {
    bonusTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 60,
        vy: -2
    });
}

function updateBonusTexts() {
    for (let i = bonusTexts.length - 1; i >= 0; i--) {
        const bt = bonusTexts[i];
        bt.y += bt.vy;
        bt.vy *= 0.95;
        bt.life--;
        
        if (bt.life <= 0) {
            bonusTexts.splice(i, 1);
        }
    }
}

function drawBonusTexts() {
    bonusTexts.forEach(bt => {
        const alpha = Math.min(1, bt.life / 30);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = bt.color;
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bt.text, bt.x, bt.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

// ============================================
// SCORING
// ============================================
function updateScore() {
    score++;
    
    // Check for level up
    const newLevel = Math.min(MAX_LEVEL, Math.floor(score / POINTS_PER_LEVEL) + 1);
    if (newLevel > currentLevel && currentLevel < MAX_LEVEL) {
        currentLevel = newLevel;
        levelUpAnimation = 120; // 2 seconds of animation
        createBonusText(canvas.width / 2, 80, 'LEVEL ' + currentLevel, '#222');
        playLevelUpSound();
        updateLevelDisplay();
        updateEra();
    }
    
    // Check for victory (after completing level 10)
    if (!freePlayMode && score >= WIN_SCORE) {
        victory();
        return;
    }
    
    // Format score with leading zeros
    currentScoreEl.textContent = score.toString().padStart(5, '0');
    
    // Update high score if beaten
    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore.toString().padStart(5, '0');
        localStorage.setItem('dinoHighScore', highScore);
    }
}

function updateLevelDisplay() {
    const levelEl = document.getElementById('levelDisplay');
    if (levelEl) {
        if (freePlayMode) {
            levelEl.textContent = 'FREE PLAY';
        } else {
            levelEl.textContent = 'LV ' + currentLevel;
        }
    }
}

function updateEra() {
    // Determine era based on current level
    let newEra = 'normal';
    if (currentLevel >= 8) {
        newEra = 'civilization';
    } else if (currentLevel >= 6) {
        newEra = 'beach';
    } else if (currentLevel >= 4) {
        newEra = 'ice';
    } else if (currentLevel >= 2) {
        newEra = 'volcano';
    }
    
    if (newEra !== currentEra) {
        currentEra = newEra;
        
        // Set target heights based on era
        // Previous era landmarks go down, new one rises
        volcano.targetHeight = (currentEra === 'volcano') ? volcano.height : 0;
        iceberg.targetHeight = (currentEra === 'ice') ? iceberg.height : 0;
        palmTree.targetHeight = (currentEra === 'beach') ? palmTree.height : 0;
        empireState.targetHeight = (currentEra === 'civilization') ? empireState.height : 0;
    }
}

// ============================================
// SPAWN MANAGEMENT
// ============================================
let lastCactusSpawn = 0;

function manageSpawns() {
    // Early game (first 20 seconds / 1200 frames) - easier spawning
    const isEarlyGame = frameCount < 1200;
    
    // Spawn cacti - interval decreases as speed increases
    // In early game, add extra spacing between cacti
    let cactusInterval = Math.max(50, 140 - gameSpeed * 6);
    if (isEarlyGame) {
        cactusInterval += 40; // Extra spacing in first 20 seconds
    }
    if (frameCount - lastCactusSpawn > cactusInterval + Math.random() * 80) {
        spawnCactus();
        lastCactusSpawn = frameCount;
    }
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        frameCount++;
        
        // Update level up animation
        if (levelUpAnimation > 0) {
            levelUpAnimation--;
        }
        
        // Increase difficulty over time
        gameSpeed = Math.min(MAX_SPEED, BASE_SPEED + frameCount * SPEED_INCREMENT);
        
        // Update game objects
        player.update();
        updateBullets();
        updateCacti();
        updateBackground();
        updateParticles();
        updateBonusTexts();
        manageSpawns();
        
        // Check for collisions
        if (checkCollisions()) {
            gameOver();
        }
        
        // Update score every 5 frames
        if (frameCount % 5 === 0) {
            updateScore();
        }
    }
    
    // Draw everything
    drawBackground();
    drawCacti();
    drawBullets();
    player.draw();
    drawParticles();
    drawBonusTexts();
    drawLevelUpAnimation();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

function drawLevelUpAnimation() {
    if (levelUpAnimation <= 0) return;
    
    // Flash effect for level up
    const alpha = Math.sin(levelUpAnimation * 0.2) * 0.3;
    if (alpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================
function startGame() {
    initAudio();
    playStartSound();
    gameState = 'playing';
    score = 0;
    gameSpeed = BASE_SPEED;
    frameCount = 0;
    lastCactusSpawn = 0;
    currentEra = 'normal';
    currentLevel = 1;
    freePlayMode = false;
    levelUpAnimation = 0;
    
    // Clear obstacles
    cacti.length = 0;
    bullets.length = 0;
    particles.length = 0;
    bonusTexts.length = 0;
    passedCacti.clear();
    cactusIdCounter = 0;
    shootCooldown = 0;
    
    // Reset all landmarks
    volcano.eruptionParticles.length = 0;
    volcano.currentHeight = 0;
    volcano.targetHeight = 0;
    volcano.lavaGlow = 0;
    iceberg.currentHeight = 0;
    iceberg.targetHeight = 0;
    palmTree.currentHeight = 0;
    palmTree.targetHeight = 0;
    empireState.currentHeight = 0;
    empireState.targetHeight = 0;
    
    // Reset player
    player.reset();
    
    // Update UI
    currentScoreEl.textContent = '00000';
    highScoreEl.textContent = highScore.toString().padStart(5, '0');
    updateLevelDisplay();
    
    // Hide all screens
    startScreen.style.display = 'none';
    gameOverScreen.classList.add('hidden');
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.add('hidden');
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) victoryScreen.classList.add('hidden');
}

function gameOver() {
    gameState = 'gameover';
    screenShake();
    playGameOverSound();
    
    // Show game over screen
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    startGame();
}

function victory() {
    gameState = 'victory';
    playVictorySound();
    
    // Show victory screen
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) {
        document.getElementById('victoryScore').textContent = score;
        victoryScreen.classList.remove('hidden');
    }
}

function continueFreePlay() {
    freePlayMode = true;
    gameState = 'playing';
    updateLevelDisplay();
    
    // Hide victory screen
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) {
        victoryScreen.classList.add('hidden');
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) {
            pauseScreen.classList.remove('hidden');
        }
    } else if (gameState === 'paused') {
        gameState = 'playing';
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) {
            pauseScreen.classList.add('hidden');
        }
    }
}

// ============================================
// INPUT HANDLING
// ============================================
document.addEventListener('keydown', (e) => {
    // Ignore key presses when typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Jump keys: Space or J
    if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        keys.jump = true;
        
        // Handle game state transitions
        if (gameState === 'start') {
            startGame();
        } else if (gameState === 'paused') {
            togglePause(); // Unpause with space
        }
    }
    
    // Y key to play again from game over
    if (e.code === 'KeyY') {
        if (gameState === 'gameover') {
            restartGame();
        }
    }
    
    // Pause key: P
    if (e.code === 'KeyP') {
        if (gameState === 'playing' || gameState === 'paused') {
            togglePause();
        }
    }
    
    // Mute key: M
    if (e.code === 'KeyM') {
        toggleMute();
    }
    
    // Shoot key: O
    if (e.code === 'KeyO') {
        keys.shoot = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'KeyJ') {
        keys.jump = false;
    }
    if (e.code === 'KeyO') {
        keys.shoot = false;
    }
});

// Prevent spacebar from scrolling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
    }
});

// ============================================
// INITIALIZATION
// ============================================
function init() {
    // Load high score
    highScoreEl.textContent = highScore.toString().padStart(5, '0');
    
    // Initialize background
    initBackground();
    
    // Initialize touch controls if on touch device
    initTouchControls();
    
    // Start game loop
    gameLoop();
}

// ============================================
// MOBILE TOUCH CONTROLS
// ============================================
function initTouchControls() {
    const btnJump = document.getElementById('btn-jump');
    const btnStart = document.getElementById('btn-start');
    const btnRestart = document.getElementById('btn-restart');
    
    // START button - tap to start game
    if (btnStart) {
        btnStart.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'start') {
                startGame();
            }
        }, { passive: false });
        
        btnStart.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'start') {
                startGame();
            }
        });
    }
    
    // RESTART button - tap to restart game
    if (btnRestart) {
        btnRestart.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'gameover') {
                restartGame();
            }
        }, { passive: false });
        
        btnRestart.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'gameover') {
                restartGame();
            }
        });
    }
    
    if (!btnJump) return;
    
    // JUMP button - tap to jump (same as Space/J)
    btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.jump = true;
        initAudio();
        
        // Handle game state transitions (same as keyboard)
        if (gameState === 'start') {
            startGame();
        } else if (gameState === 'gameover') {
            restartGame();
        }
    }, { passive: false });
    
    btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.jump = false;
    }, { passive: false });
    
    btnJump.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys.jump = false;
    }, { passive: false });
    
    // SHOOT button - tap to shoot (same as O key)
    const btnShoot = document.getElementById('btn-shoot');
    if (btnShoot) {
        btnShoot.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys.shoot = true;
            initAudio();
        }, { passive: false });
        
        btnShoot.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys.shoot = false;
        }, { passive: false });
        
        btnShoot.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys.shoot = false;
        }, { passive: false });
    }
    
    // PAUSE button
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
        btnPause.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'playing' || gameState === 'paused') {
                togglePause();
            }
        }, { passive: false });
        
        btnPause.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'playing' || gameState === 'paused') {
                togglePause();
            }
        });
    }
    
    // RESUME button (on pause screen)
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
        btnResume.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'paused') {
                togglePause();
            }
        }, { passive: false });
        
        btnResume.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'paused') {
                togglePause();
            }
        });
    }
    
    // FREE PLAY button (on victory screen)
    const btnFreePlay = document.getElementById('btn-freeplay');
    if (btnFreePlay) {
        btnFreePlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            continueFreePlay();
        }, { passive: false });
        
        btnFreePlay.addEventListener('click', (e) => {
            e.preventDefault();
            continueFreePlay();
        });
    }
    
    // PLAY AGAIN button (on victory screen)
    const btnPlayAgain = document.getElementById('btn-playagain');
    if (btnPlayAgain) {
        btnPlayAgain.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startGame();
        }, { passive: false });
        
        btnPlayAgain.addEventListener('click', (e) => {
            e.preventDefault();
            startGame();
        });
    }
    
    // MUTE button
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
        btnMute.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMute();
        });
    }
}

// Start the game
init();
