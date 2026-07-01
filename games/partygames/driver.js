// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const modeSelect = document.getElementById("game-mode");
const diffSelect = document.getElementById("game-diff");

const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");
const btnMenu = document.getElementById("btn-menu");
const btnPushEnd = document.getElementById("btn-push-end");

const hudPrimary = document.getElementById("hud-primary");
const hudSecondary = document.getElementById("hud-secondary");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

const canvas = document.getElementById("driver-canvas");
const ctx = canvas.getContext("2d");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");

// Game Constants
const LANE_WIDTH = 60;
const ROAD_SPEED_BASE = 5; 
const VEHICLES = [
    { type: "truck", width: 36, height: 100, color: "#7aa2f7" }, // Blue
    { type: "car", width: 30, height: 65, color: "#9ece6a" },   // Green
    { type: "bike", width: 14, height: 40, color: "#f7768e" }   // Red
];

// State
let gameState = {
    active: false,
    mode: "timed",
    difficulty: "medium",
    timeElapsed: 0,
    score: 0,
    lives: 3,
    crashes: 0,
    speedMult: 1.0,
    won: false
};

let player = { lane: 4, y: 400, width: 26, height: 50, color: "#e0af68", iframes: 0 };
let obstacles = [];
let bgOffset = 0;
let distanceSinceSpawn = 0;
let animationId;
let diffSettings = {
    "easy": { spawnGap: 300, maxCarsPerWave: 1, scoreMult: 1 },
    "medium": { spawnGap: 220, maxCarsPerWave: 2, scoreMult: 1.5 },
    "hard": { spawnGap: 160, maxCarsPerWave: 3, scoreMult: 2.5 }
};

// ==========================================
// 1. INPUT HANDLING
// ==========================================
function moveLeft() {
    if (gameState.active && player.lane > 0) player.lane--;
}
function moveRight() {
    if (gameState.active && player.lane < 5) player.lane++;
}

btnLeft.addEventListener("mousedown", moveLeft);
btnRight.addEventListener("mousedown", moveRight);
btnLeft.addEventListener("touchstart", (e) => { e.preventDefault(); moveLeft(); });
btnRight.addEventListener("touchstart", (e) => { e.preventDefault(); moveRight(); });

document.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft();
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight();
});

// ==========================================
// 2. SETUP & START
// ==========================================
btnStart.addEventListener("click", () => {
    gameState.mode = modeSelect.value;
    gameState.difficulty = diffSelect.value;
    gameState.active = true;
    gameState.timeElapsed = 0;
    gameState.score = 0;
    gameState.lives = gameState.mode === "timed" ? 3 : 1;
    gameState.crashes = 0;
    gameState.speedMult = 1.0;
    gameState.won = false;
    
    player.lane = 4; // Start in middle-right lane
    player.iframes = 0;
    obstacles = [];
    distanceSinceSpawn = 0;
    
    setupPhase.style.display = "none";
    endPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    
    cancelAnimationFrame(animationId);
    lastTime = performance.now();
    gameLoop(lastTime);
});

btnRestart.addEventListener("click", abortRun);
btnMenu.addEventListener("click", () => {
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});

// ==========================================
// 3. GAME LOOP & PHYSICS
// ==========================================
let lastTime = 0;

function gameLoop(time) {
    if (!gameState.active) return;
    let dt = time - lastTime;
    lastTime = time;
    
    // Time tracking
    gameState.timeElapsed += dt / 1000;
    
    // Acceleration for Endless
    if (gameState.mode === "endless") {
        gameState.speedMult += 0.0002;
        let pScore = (diffSettings[gameState.difficulty].scoreMult * gameState.speedMult) * 2;
        gameState.score += pScore;
    }
    
    // Check Timed Win Condition
    if (gameState.mode === "timed" && gameState.timeElapsed >= 30) {
        gameState.won = true;
        endRun();
        return;
    }

    if (player.iframes > 0) player.iframes -= dt;
    
    updateHUD();
    spawnLogic();
    updateObstacles();
    checkCollisions();
    drawFrame();
    
    animationId = requestAnimationFrame(gameLoop);
}

function updateHUD() {
    if (gameState.mode === "timed") {
        let t = Math.max(0, 30 - gameState.timeElapsed).toFixed(1);
        hudPrimary.innerText = `Time: ${t}s`;
        hudPrimary.style.color = "#e0af68";
        hudSecondary.innerText = `Lives: ${gameState.lives}`;
        hudSecondary.style.color = "#f7768e";
    } else {
        hudPrimary.innerText = `Score: ${Math.floor(gameState.score)}`;
        hudPrimary.style.color = "#9ece6a";
        hudSecondary.innerText = `Speed: ${gameState.speedMult.toFixed(2)}x`;
        hudSecondary.style.color = "#a9b1d6";
    }
}

// ==========================================
// 4. SPAWN LOGIC & TRAFFIC
// ==========================================
function spawnLogic() {
    let currentSpeed = ROAD_SPEED_BASE * gameState.speedMult;
    distanceSinceSpawn += currentSpeed;
    
    let config = diffSettings[gameState.difficulty];
    let spawnThreshold = config.spawnGap / gameState.speedMult; // Gaps get smaller as speed increases
    
    if (distanceSinceSpawn >= spawnThreshold) {
        distanceSinceSpawn = 0;
        
        // Spawn a "Wave". Never spawn more than maxCarsPerWave to ensure path exists.
        let numCars = Math.floor(Math.random() * config.maxCarsPerWave) + 1;
        
        // Pick unique lanes
        let availableLanes = [0, 1, 2, 3, 4, 5];
        for (let i = 0; i < numCars; i++) {
            let rIdx = Math.floor(Math.random() * availableLanes.length);
            let chosenLane = availableLanes.splice(rIdx, 1)[0];
            
            let vType = VEHICLES[Math.floor(Math.random() * VEHICLES.length)];
            
            obstacles.push({
                lane: chosenLane,
                y: -150, // Spawn off screen top
                width: vType.width,
                height: vType.height,
                color: vType.color
            });
        }
    }
}

function updateObstacles() {
    let currentSpeed = ROAD_SPEED_BASE * gameState.speedMult;
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        
        // Left 3 lanes (0, 1, 2) are oncoming. They move very fast down.
        // Right 3 lanes (3, 4, 5) are same direction. They move slower down (player passes them).
        let obsRelativeSpeed = obs.lane < 3 ? currentSpeed + 4 : currentSpeed - 2;
        
        obs.y += obsRelativeSpeed;
        
        // Remove offscreen
        if (obs.y > 600) obstacles.splice(i, 1);
    }
}

// ==========================================
// 5. COLLISION DETECTION
// ==========================================
function checkCollisions() {
    if (player.iframes > 0) return;
    
    let px = (player.lane * LANE_WIDTH) + (LANE_WIDTH / 2) - (player.width / 2);
    let py = player.y;
    
    for (let obs of obstacles) {
        let ox = (obs.lane * LANE_WIDTH) + (LANE_WIDTH / 2) - (obs.width / 2);
        let oy = obs.y;
        
        // AABB Collision
        if (px < ox + obs.width &&
            px + player.width > ox &&
            py < oy + obs.height &&
            py + player.height > oy) {
            
            handleCrash();
            break; // Only crash once per frame
        }
    }
}

function handleCrash() {
    gameState.lives--;
    gameState.crashes++;
    
    if (gameState.lives <= 0) {
        endRun();
    } else {
        // I-frames for Timed Mode so you don't instantly lose 3 lives
        player.iframes = 1500; 
        
        // Screen flash effect
        ctx.fillStyle = "rgba(247, 118, 142, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ==========================================
// 6. DRAWING (TRON AESTHETIC)
// ==========================================
function drawFrame() {
    // Clear
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Road Grid (Tron Style)
    bgOffset = (bgOffset + (ROAD_SPEED_BASE * gameState.speedMult)) % 50;
    
    ctx.strokeStyle = "#1a1b26";
    ctx.lineWidth = 2;
    
    // Horizontal moving gridlines
    for (let i = -50; i < 550; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i + bgOffset);
        ctx.lineTo(360, i + bgOffset);
        ctx.stroke();
    }
    
    // Vertical Lane Dividers
    for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(i * LANE_WIDTH, 0);
        ctx.lineTo(i * LANE_WIDTH, 500);
        
        // Center double-yellow line equivalent (Tron blue)
        if (i === 3) {
            ctx.strokeStyle = "#7aa2f7";
            ctx.lineWidth = 4;
            ctx.setLineDash([15, 10]);
        } else {
            ctx.strokeStyle = "#24283b";
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
        }
        
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset dash
    
    // Draw Obstacles (Neon Wireframe style)
    obstacles.forEach(obs => {
        let ox = (obs.lane * LANE_WIDTH) + (LANE_WIDTH / 2) - (obs.width / 2);
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = obs.color;
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(ox, obs.y, obs.width, obs.height);
        
        // Dark fill so you can't see lines through them
        ctx.fillStyle = "#050505";
        ctx.fillRect(ox + 1, obs.y + 1, obs.width - 2, obs.height - 2);
    });
    
    // Draw Player
    if (player.iframes <= 0 || Math.floor(gameState.timeElapsed * 10) % 2 === 0) {
        let px = (player.lane * LANE_WIDTH) + (LANE_WIDTH / 2) - (player.width / 2);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = player.color;
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(px, player.y, player.width, player.height);
        
        // Little engine glow at back
        ctx.fillStyle = "#f7768e";
        ctx.fillRect(px + 6, player.y + player.height, player.width - 12, 6);
    }
    
    ctx.shadowBlur = 0; // Reset
}

// ==========================================
// 7. END GAME & PUSH
// ==========================================
function abortRun() {
    gameState.active = false;
    cancelAnimationFrame(animationId);
    
    gameControlsPhase.style.display = "none";
    setupPhase.style.display = "block";
}

function endRun() {
    gameState.active = false;
    cancelAnimationFrame(animationId);
    
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    
    if (gameState.mode === "timed") {
        if (gameState.won) {
            if (gameState.crashes === 0) {
                endStats.innerHTML = `<span style="color: #9ece6a; font-size: 1.5em;">Flawless Victory!</span><br>You survived 30s with 0 crashes.`;
            } else {
                endStats.innerHTML = `<span style="color: #e0af68; font-size: 1.5em;">You Survived!</span><br>You made it to the end, but suffered ${gameState.crashes} crash(es).`;
            }
        } else {
            endStats.innerHTML = `<span style="color: #f7768e; font-size: 1.5em;">Destroyed!</span><br>You crashed and burned.`;
        }
    } else {
        endStats.innerHTML = `<span style="color: #bb9af7; font-size: 1.5em;">Run Over</span><br>Final Score: ${Math.floor(gameState.score)}`;
    }
}

btnPushEnd.addEventListener("click", () => {
    let diffName = diffSelect.options[diffSelect.selectedIndex].text.split(" ")[0]; // "Easy", "Medium", etc.
    let summaryStr = "";
    
    if (gameState.mode === "timed") {
        if (gameState.won && gameState.crashes === 0) {
            summaryStr = `\`{{user}} played Neon Driver on ${diffName} difficulty. {{user}} won! Flawless run!\``;
        } else if (gameState.won) {
            summaryStr = `\`{{user}} played Neon Driver on ${diffName} difficulty. {{user}} won! They suffered ${gameState.crashes} crashes, but made it to the end!\``;
        } else {
            summaryStr = `\`{{user}} played Neon Driver on ${diffName} difficulty. {{user}} crashed and burned!\``;
        }
    } else {
        summaryStr = `\`{{user}} played Neon Driver on ${diffName} difficulty. End of run! ${Math.floor(gameState.score)} points!\``;
    }
    
    const userRp = endRpText.value.trim();
    if (userRp) summaryStr += `\n${userRp}`;

    STBridge.sendMessage(summaryStr);
    
    endRpText.value = "";
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});