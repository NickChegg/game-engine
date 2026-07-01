// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const gameHud = document.getElementById("game-hud");

const modeSelect = document.getElementById("game-mode");
const diffSelect = document.getElementById("game-diff");

const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");
const btnMenu = document.getElementById("btn-menu");
const btnPushEnd = document.getElementById("btn-push-end");

const ammoUI = document.getElementById("ammo-ui");
const reloadUI = document.getElementById("reload-ui");
const hudWave = document.getElementById("hud-wave");
const hudKills = document.getElementById("hud-kills");
const hudLives = document.getElementById("hud-lives");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

const canvas = document.getElementById("gun-canvas");
const ctx = canvas.getContext("2d");

// Game Constants & Configuration
const W = canvas.width;
const H = canvas.height;
const MAX_AMMO = 13;
const RELOAD_TIME = 1000;
const FIRE_DELAY = 150; // ms between shots

const diffConfig = {
    "easy": { speedMult: 0.7, fireDelayMult: 1.5 },
    "medium": { speedMult: 1.0, fireDelayMult: 1.0 },
    "hard": { speedMult: 1.3, fireDelayMult: 0.6 }
};

// Types: knife, pistol, shotgun, rifle
const enemyData = {
    knife:   { color: "#e0af68", speed: 120, hp: 1, range: 0, fireRate: 0 },
    pistol:  { color: "#7aa2f7", speed: 70, hp: 2, range: 250, fireRate: 1500 },
    shotgun: { color: "#9ece6a", speed: 50, hp: 3, range: 180, fireRate: 2000 },
    rifle:   { color: "#bb9af7", speed: 60, hp: 2, range: 300, fireRate: 2500 }
};

// Input State
let keys = {};
let mouse = { x: W/2, y: H/2, down: false };

window.addEventListener("keydown", e => keys[e.code] = true);
window.addEventListener("keyup", e => keys[e.code] = false);
canvas.addEventListener("mousemove", e => {
    let rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
canvas.addEventListener("mousedown", () => mouse.down = true);
window.addEventListener("mouseup", () => mouse.down = false);

// Game State
let gameState = { active: false, mode: "waves", diff: "medium", timeElapsed: 0, kills: 0, wave: 1, won: false };
let player = { x: W/2, y: H/2, radius: 14, speed: 200, lives: 3, ammo: MAX_AMMO, reloading: false, reloadTimer: 0, fireTimer: 0, iframes: 0 };
let bullets = [];
let enemies = [];
let particles = [];
let waveController = { active: false, spawnQueue: [], timer: 0 };

let lastTime = 0;
let animationId;

// ==========================================
// 1. GAME SETUP & WAVES
// ==========================================
btnStart.addEventListener("click", () => {
    gameState.mode = modeSelect.value;
    gameState.diff = diffSelect.value;
    gameState.active = true;
    gameState.timeElapsed = 0;
    gameState.kills = 0;
    gameState.wave = 1;
    gameState.won = false;
    
    player = { x: W/2, y: H/2, radius: 14, speed: 200, lives: gameState.mode === "waves" ? 3 : 1, ammo: MAX_AMMO, reloading: false, reloadTimer: 0, fireTimer: 0, iframes: 0 };
    bullets = [];
    enemies = [];
    particles = [];
    
    setupPhase.style.display = "none";
    endPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    gameHud.style.display = "flex";
    
    startWave(1);
    
    cancelAnimationFrame(animationId);
    lastTime = performance.now();
    gameLoop(lastTime);
});

function startWave(waveNum) {
    waveController.active = true;
    waveController.timer = 0;
    waveController.spawnQueue = [];
    
    let k = 0, p = 0, s = 0, r = 0;
    
    if (gameState.mode === "waves") {
        if (waveNum === 1) { k = 6; p = 2; }
        if (waveNum === 2) { k = 5; p = 3; s = 2; }
        if (waveNum === 3) { k = 4; p = 4; s = 3; r = 2; }
    } else {
        // Endless scaling
        let total = 5 + (waveNum * 2);
        k = Math.floor(total * 0.4);
        p = Math.floor(total * 0.3);
        if (waveNum >= 2) s = Math.floor(total * 0.2);
        if (waveNum >= 3) r = Math.floor(total * 0.1);
    }
    
    for(let i=0; i<k; i++) waveController.spawnQueue.push("knife");
    for(let i=0; i<p; i++) waveController.spawnQueue.push("pistol");
    for(let i=0; i<s; i++) waveController.spawnQueue.push("shotgun");
    for(let i=0; i<r; i++) waveController.spawnQueue.push("rifle");
    
    // Shuffle spawns
    waveController.spawnQueue.sort(() => Math.random() - 0.5);
    updateHUD();
}

// ==========================================
// 2. CORE ENGINE LOOP
// ==========================================
function gameLoop(time) {
    if (!gameState.active) return;
    let dt = (time - lastTime) / 1000; // Delta time in seconds
    lastTime = time;
    gameState.timeElapsed += dt;
    
    updatePlayer(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
    checkCollisions();
    
    drawFrame();
    
    animationId = requestAnimationFrame(gameLoop);
}

function updateHUD() {
    hudWave.innerText = `Wave: ${gameState.wave}`;
    hudKills.innerText = `Kills: ${gameState.kills}`;
    hudLives.innerText = `Lives: ${player.lives}`;
    ammoUI.innerText = `${player.ammo} / ${MAX_AMMO}`;
    
    if (player.reloading) {
        ammoUI.innerText = "RELOADING...";
        ammoUI.style.color = "#f7768e";
        reloadUI.innerText = "Swapping mag...";
    } else {
        ammoUI.style.color = player.ammo <= 3 ? "#f7768e" : "#89ddff";
        reloadUI.innerText = player.ammo === 0 ? "OUT OF AMMO! Press R" : "Press R or SPACE to reload.";
    }
}

// ==========================================
// 3. UPDATES & PHYSICS
// ==========================================
function updatePlayer(dt) {
    // Movement
    let dx = 0, dy = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) dy -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) dy += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) dx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) dx += 1;
    
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; } // Normalize diagonal
    
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    
    // Bounds clamp
    player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));
    
    // Timers
    if (player.iframes > 0) player.iframes -= dt;
    if (player.fireTimer > 0) player.fireTimer -= dt;
    
    // Reloading
    if ((keys["KeyR"] || keys["Space"]) && !player.reloading && player.ammo < MAX_AMMO) {
        player.reloading = true;
        player.reloadTimer = RELOAD_TIME / 1000;
        updateHUD();
    }
    
    if (player.reloading) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) {
            player.reloading = false;
            player.ammo = MAX_AMMO;
            updateHUD();
        }
    }
    
    // Shooting
    if (mouse.down && player.fireTimer <= 0 && !player.reloading && player.ammo > 0) {
        let angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        bullets.push({ x: player.x, y: player.y, vx: Math.cos(angle)*600, vy: Math.sin(angle)*600, isEnemy: false, damage: 1, radius: 4 });
        
        player.ammo--;
        player.fireTimer = FIRE_DELAY / 1000;
        updateHUD();
        
        // Auto-reload on empty
        if (player.ammo === 0) {
            player.reloading = true;
            player.reloadTimer = RELOAD_TIME / 1000;
            updateHUD();
        }
    }
}

function updateWaves(dt) {
    if (!waveController.active) return;
    
    waveController.timer -= dt;
    if (waveController.timer <= 0 && waveController.spawnQueue.length > 0) {
        let type = waveController.spawnQueue.shift();
        spawnEnemy(type);
        waveController.timer = 1.0; // 1 second between spawns
    }
    
    if (waveController.spawnQueue.length === 0 && enemies.length === 0) {
        waveController.active = false;
        
        // Check Victory
        if (gameState.mode === "waves" && gameState.wave === 3) {
            gameState.won = true;
            endMatch();
            return;
        }
        
        // Next Wave Delay
        setTimeout(() => {
            if (gameState.active) {
                gameState.wave++;
                startWave(gameState.wave);
            }
        }, 2000);
    }
}

function spawnEnemy(type) {
    let data = enemyData[type];
    let mult = diffConfig[gameState.diff];
    
    // Spawn at edges
    let ex, ey;
    if (Math.random() < 0.5) {
        ex = Math.random() < 0.5 ? -20 : W + 20;
        ey = Math.random() * H;
    } else {
        ex = Math.random() * W;
        ey = Math.random() < 0.5 ? -20 : H + 20;
    }
    
    enemies.push({
        x: ex, y: ey, radius: 14, type: type, color: data.color,
        hp: data.hp, speed: data.speed * mult.speedMult,
        range: data.range, fireRate: (data.fireRate * mult.fireDelayMult) / 1000, fireTimer: 0,
        burstCount: 0, burstTimer: 0
    });
}

function updateEnemies(dt) {
    enemies.forEach(e => {
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let dist = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx);
        
        // Movement AI
        if (e.type === "knife" || dist > e.range) {
            e.x += Math.cos(angle) * e.speed * dt;
            e.y += Math.sin(angle) * e.speed * dt;
        } else if (dist < e.range - 50) {
            // Back away slightly if player rushes them
            e.x -= Math.cos(angle) * (e.speed * 0.5) * dt;
            e.y -= Math.sin(angle) * (e.speed * 0.5) * dt;
        }
        
        // Shooting AI
        if (e.type !== "knife" && dist <= e.range + 50) {
            e.fireTimer -= dt;
            
            // Rifle Burst Logic
            if (e.type === "rifle" && e.burstCount > 0) {
                e.burstTimer -= dt;
                if (e.burstTimer <= 0) {
                    fireEnemyBullet(e, angle);
                    e.burstCount--;
                    e.burstTimer = 0.15; // Fast burst delay
                }
            } 
            // Main Fire Trigger
            else if (e.fireTimer <= 0) {
                if (e.type === "pistol") {
                    fireEnemyBullet(e, angle);
                } else if (e.type === "shotgun") {
                    for(let i=-2; i<=2; i++) {
                        fireEnemyBullet(e, angle + (i * 0.15)); // Spread
                    }
                } else if (e.type === "rifle") {
                    e.burstCount = 3;
                    e.burstTimer = 0; // Starts burst immediately
                }
                e.fireTimer = e.fireRate;
            }
        }
    });
}

function fireEnemyBullet(e, angle) {
    bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle)*300, vy: Math.sin(angle)*300, isEnemy: true, radius: 4 });
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        
        // Remove if off screen
        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
            bullets.splice(i, 1);
        }
    }
}

function checkCollisions() {
    // 1. Player Bullets vs Enemies
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
        let b = bullets[bi];
        if (b.isEnemy) continue;
        
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            let e = enemies[ei];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
                e.hp -= b.damage;
                bullets.splice(bi, 1);
                
                // Blood particles
                spawnParticles(e.x, e.y, e.color, 5);
                
                if (e.hp <= 0) {
                    enemies.splice(ei, 1);
                    gameState.kills++;
                    updateHUD();
                }
                break;
            }
        }
    }
    
    if (player.iframes > 0) return; // Invincible
    
    // 2. Enemy Bullets vs Player
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
        let b = bullets[bi];
        if (!b.isEnemy) continue;
        
        if (Math.hypot(b.x - player.x, b.y - player.y) < player.radius + b.radius) {
            bullets.splice(bi, 1);
            damagePlayer();
            break;
        }
    }
    
    // 3. Knifemen Touch Damage
    if (player.iframes <= 0) {
        for (let e of enemies) {
            if (e.type === "knife" && Math.hypot(e.x - player.x, e.y - player.y) < player.radius + e.radius) {
                damagePlayer();
                break;
            }
        }
    }
}

function damagePlayer() {
    player.lives--;
    updateHUD();
    spawnParticles(player.x, player.y, "#89ddff", 15);
    
    if (player.lives <= 0) {
        endMatch();
    } else {
        player.iframes = 1.5; // 1.5 seconds invincibility
        // Screen flash
        ctx.fillStyle = "rgba(247, 118, 142, 0.4)";
        ctx.fillRect(0, 0, W, H);
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 150 + 50;
        particles.push({
            x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
            color, life: Math.random() * 0.3 + 0.2
        });
    }
}

// ==========================================
// 4. DRAWING
// ==========================================
function drawFrame() {
    ctx.clearRect(0, 0, W, H); // CSS background handles the grid
    
    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 2;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1.0;
    
    // Bullets
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fillStyle = b.isEnemy ? "#f7768e" : "#89ddff";
        ctx.fill();
        ctx.shadowBlur = 5;
        ctx.shadowColor = ctx.fillStyle;
    });
    ctx.shadowBlur = 0;
    
    // Enemies
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(Math.atan2(player.y - e.y, player.x - e.x));
        
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI*2);
        ctx.fill();
        
        // Draw distinct weapons
        ctx.fillStyle = (e.type === "knife") ? "#a9b1d6" : "#111"; // Silver for knife, black for guns
        if (e.type === "knife") ctx.fillRect(e.radius, -2, 10, 4); // Small front box
        if (e.type === "pistol") ctx.fillRect(e.radius, -3, 8, 6);
        if (e.type === "shotgun") ctx.fillRect(e.radius-5, 8, 20, 5); // Long side box
        if (e.type === "rifle") ctx.fillRect(e.radius-2, 6, 22, 4); // Long side-front
        
        ctx.restore();
    });
    
    // Player
    if (player.iframes <= 0 || Math.floor(gameState.timeElapsed * 10) % 2 === 0) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(Math.atan2(mouse.y - player.y, mouse.x - player.x));
        
        ctx.fillStyle = "#89ddff"; // Player color
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, Math.PI*2);
        ctx.fill();
        
        // Gun
        ctx.fillStyle = "#111";
        ctx.fillRect(player.radius, -4, 15, 8);
        
        ctx.restore();
    }
}

// ==========================================
// 5. RESOLUTION & PUSH
// ==========================================
function endMatch() {
    gameState.active = false;
    cancelAnimationFrame(animationId);
    
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    gameHud.style.display = "none";
    
    let timeStr = `${Math.floor(gameState.timeElapsed / 60)}m ${Math.floor(gameState.timeElapsed % 60)}s`;
    
    if (gameState.mode === "waves") {
        if (gameState.won) {
            if (player.lives < 3) {
                endStats.innerHTML = `<span style="color: #e0af68; font-size: 1.5em;">Mission Accomplished!</span><br>You were wounded but cleared all 3 waves in ${timeStr}!<br><span style="font-size: 0.8em; color: #787c99;">Enemies Killed: ${gameState.kills}</span>`;
            } else {
                endStats.innerHTML = `<span style="color: #9ece6a; font-size: 1.5em;">Flawless Victory!</span><br>You cleared all 3 waves without a scratch in ${timeStr}!<br><span style="font-size: 0.8em; color: #787c99;">Enemies Killed: ${gameState.kills}</span>`;
            }
        } else {
            endStats.innerHTML = `<span style="color: #f7768e; font-size: 1.5em;">Killed in Action</span><br>You died on Wave ${gameState.wave}.<br><span style="font-size: 0.8em; color: #787c99;">Enemies Killed: ${gameState.kills}</span>`;
        }
    } else {
        endStats.innerHTML = `<span style="color: #bb9af7; font-size: 1.5em;">Survival Complete</span><br>You survived to Wave ${gameState.wave} (${timeStr}).<br><span style="font-size: 0.8em; color: #787c99;">Enemies Killed: ${gameState.kills}</span>`;
    }
}

btnRestart.addEventListener("click", () => {
    gameState.active = false;
    cancelAnimationFrame(animationId);
    gameControlsPhase.style.display = "none";
    setupPhase.style.display = "block";
    gameHud.style.display = "none";
});

btnMenu.addEventListener("click", () => {
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});

btnPushEnd.addEventListener("click", () => {
    let diffName = diffSelect.options[diffSelect.selectedIndex].text.split(" ")[0]; // "Easy", "Medium", etc.
    let timeStr = `${Math.floor(gameState.timeElapsed / 60)}m ${Math.floor(gameState.timeElapsed % 60)}s`;
    let summaryStr = "";
    
    if (gameState.mode === "waves") {
        if (gameState.won) {
            if (player.lives < 3) {
                summaryStr = `\`{{user}} played Gun Arena on ${diffName} difficulty. {{user}} was wounded but managed to succeed! They cleared all 3 waves in ${timeStr}, destroying ${gameState.kills} enemies!\``;
            } else {
                summaryStr = `\`{{user}} played Gun Arena on ${diffName} difficulty. They survived all 3 waves flawlessly in ${timeStr}, destroying ${gameState.kills} enemies!\``;
            }
        } else {
            summaryStr = `\`{{user}} played Gun Arena on ${diffName} difficulty. They died on Wave ${gameState.wave} after ${timeStr}, destroying ${gameState.kills} enemies!\``;
        }
    } else {
        summaryStr = `\`{{user}} played Gun Arena Survival on ${diffName} difficulty. They reached Wave ${gameState.wave} and survived for ${timeStr}, destroying ${gameState.kills} enemies!\``;
    }
    
    const userRp = endRpText.value.trim();
    if (userRp) summaryStr += `\n${userRp}`;

    STBridge.sendMessage(summaryStr);
    
    endRpText.value = "";
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});