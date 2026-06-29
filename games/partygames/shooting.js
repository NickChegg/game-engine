// DOM Elements
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");
const difficultySelect = document.getElementById("difficulty");
const btnStart = document.getElementById("btn-start");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");

const arena = document.getElementById("arena");
const timeUI = document.getElementById("time-ui");
const scoreUI = document.getElementById("score-ui");
const accUI = document.getElementById("acc-ui");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Game Config
const TARGET_SIZE = 80; // 80px diameter
const TARGET_RADIUS = TARGET_SIZE / 2;

const diffConfigs = {
    "easy": { lifetime: 2500, spawnTick: 500 },
    "medium": { lifetime: 1200, spawnTick: 300 },
    "hard": { lifetime: 700, spawnTick: 200 }
};

// State Variables
let gameState = {
    active: false,
    timeLeft: 30,
    shotsFired: 0,
    targetsHit: 0,
    score: 0,
    totalSpawned: 0,
    difficulty: "medium",
    maxConcurrent: 1
};

let activeTargets = []; // Stores { x, y, id } for collision detection
let gameInterval;
let spawnInterval;
let targetIdCounter = 0;

// ==========================================
// 1. GAME LOOP SETUP
// ==========================================
btnStart.addEventListener("click", () => {
    gameState = {
        active: true,
        timeLeft: 30,
        shotsFired: 0,
        targetsHit: 0,
        score: 0,
        totalSpawned: 0,
        difficulty: difficultySelect.value,
        maxConcurrent: 1
    };
    
    activeTargets = [];
    targetIdCounter = 0;
    arena.innerHTML = ""; // Clear board
    updateHUD();
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    
    // Start Timers
    gameInterval = setInterval(tickTime, 1000);
    spawnInterval = setInterval(spawnerLogic, diffConfigs[gameState.difficulty].spawnTick);
});

function tickTime() {
    gameState.timeLeft--;
    updateHUD();
    
    // Difficulty ramp: Increase max concurrent targets as time ticks down
    if (gameState.timeLeft <= 24) gameState.maxConcurrent = 2;
    if (gameState.timeLeft <= 18) gameState.maxConcurrent = 3;
    if (gameState.timeLeft <= 12) gameState.maxConcurrent = 4;
    if (gameState.timeLeft <= 6) gameState.maxConcurrent = 5;
    
    if (gameState.timeLeft <= 0) {
        endGame();
    }
}

function updateHUD() {
    timeUI.innerText = gameState.timeLeft;
    scoreUI.innerText = gameState.score;
    let acc = gameState.shotsFired > 0 ? Math.round((gameState.targetsHit / gameState.shotsFired) * 100) : 0;
    accUI.innerText = acc;
}

// ==========================================
// 2. SPAWNING LOGIC & COLLISION
// ==========================================
function spawnerLogic() {
    if (!gameState.active) return;
    
    // Only spawn if we haven't hit the current cap
    if (activeTargets.length < gameState.maxConcurrent) {
        spawnTarget();
    }
}

function spawnTarget() {
    const arenaRect = arena.getBoundingClientRect();
    const maxX = arenaRect.width - TARGET_RADIUS;
    const maxY = arenaRect.height - TARGET_RADIUS;
    
    let validPos = false;
    let rx, ry;
    
    // Try to find a non-overlapping spot 30 times
    for (let attempts = 0; attempts < 30; attempts++) {
        // Random X,Y keeping bounds safe
        rx = Math.random() * (maxX - TARGET_RADIUS) + TARGET_RADIUS;
        ry = Math.random() * (maxY - TARGET_RADIUS) + TARGET_RADIUS;
        
        // Check collision against all active targets
        let overlap = false;
        for (let t of activeTargets) {
            let dist = Math.hypot(rx - t.x, ry - t.y);
            // Must be further apart than the diameter to avoid touching
            if (dist < TARGET_SIZE) { 
                overlap = true;
                break;
            }
        }
        
        if (!overlap) {
            validPos = true;
            break;
        }
    }
    
    if (!validPos) return; // Too crowded, skip this spawn cycle
    
    // Create the target
    gameState.totalSpawned++;
    let tId = targetIdCounter++;
    activeTargets.push({ x: rx, y: ry, id: tId });
    
    let el = document.createElement("div");
    el.className = "shooting-target";
    el.style.width = TARGET_SIZE + "px";
    el.style.height = TARGET_SIZE + "px";
    el.style.left = rx + "px";
    el.style.top = ry + "px";
    el.setAttribute("data-id", tId);
    
    arena.appendChild(el);
    
    // Auto-despawn timer
    setTimeout(() => {
        if (el.parentNode) {
            el.remove();
            removeTargetFromData(tId);
        }
    }, diffConfigs[gameState.difficulty].lifetime);
}

function removeTargetFromData(id) {
    activeTargets = activeTargets.filter(t => t.id !== parseInt(id));
}

// ==========================================
// 3. SHOOTING & HIT DETECTION
// ==========================================
arena.addEventListener("mousedown", (e) => {
    if (!gameState.active) return;
    
    // Every click in the box is a shot fired
    gameState.shotsFired++;
    
    const target = e.target.closest('.shooting-target');
    if (target) {
        // HIT!
        gameState.targetsHit++;
        
        // Mathematical precision calculation
        const rect = target.getBoundingClientRect();
        const centerX = rect.left + TARGET_RADIUS;
        const centerY = rect.top + TARGET_RADIUS;
        
        const distFromCenter = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        const normalized = distFromCenter / TARGET_RADIUS; // Gives a value from 0.0 (dead center) to 1.0 (outer edge)
        
        let pts = 1; // Outer ring
        let popColor = "white";
        
        if (normalized <= 0.2) { pts = 5; popColor = "#f7768e"; } // Bullseye
        else if (normalized <= 0.4) { pts = 4; popColor = "#e0af68"; }
        else if (normalized <= 0.6) { pts = 3; popColor = "#9ece6a"; }
        else if (normalized <= 0.8) { pts = 2; popColor = "#7aa2f7"; }
        
        gameState.score += pts;
        
        // Visual Feedback
        spawnFloatingText(pts, e.clientX, e.clientY, popColor);
        
        // Remove target
        let tId = target.getAttribute("data-id");
        target.remove();
        removeTargetFromData(tId);
    }
    
    updateHUD();
});

function spawnFloatingText(pts, clientX, clientY, color) {
    const arenaRect = arena.getBoundingClientRect();
    let localX = clientX - arenaRect.left;
    let localY = clientY - arenaRect.top;
    
    let pop = document.createElement("div");
    pop.className = "float-points";
    pop.style.left = localX + "px";
    pop.style.top = localY + "px";
    pop.style.color = color;
    pop.innerText = `+${pts}`;
    
    arena.appendChild(pop);
    setTimeout(() => { if (pop.parentNode) pop.remove(); }, 600);
}

// ==========================================
// 4. GAME OVER & PUSH
// ==========================================
function endGame() {
    gameState.active = false;
    clearInterval(gameInterval);
    clearInterval(spawnInterval);
    
    let acc = gameState.shotsFired > 0 ? Math.round((gameState.targetsHit / gameState.shotsFired) * 100) : 0;
    let maxPossibleScore = gameState.totalSpawned * 5;
    
    endStats.innerHTML = `
        <div style="font-size: 1.5em; color: white; margin-bottom: 10px;">${gameState.score} <span style="color:#565f89; font-size: 0.7em;">/ ${maxPossibleScore} pts</span></div>
        <div style="color: #89ddff;">Accuracy: ${acc}%</div>
        <div style="color: #787c99; font-size: 0.8em; margin-top: 5px;">Shots Fired: ${gameState.shotsFired} | Hit: ${gameState.targetsHit}</div>
    `;
    
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
}

btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    let acc = gameState.shotsFired > 0 ? Math.round((gameState.targetsHit / gameState.shotsFired) * 100) : 0;
    let maxScore = gameState.totalSpawned * 5;
    let diffName = difficultySelect.options[difficultySelect.selectedIndex].text.split(" ")[0]; // Gets "Easy", "Medium", etc.
    
    let resultString = `\`{{user}} played the Shooting Gallery on ${diffName} difficulty. They fired ${gameState.shotsFired} shots with ${acc}% accuracy, scoring ${gameState.score} out of ${maxScore} possible points!\``;

    const userRp = endRpText.value.trim();
    if (userRp) resultString += `\n${userRp}`;

    STBridge.sendMessage(resultString);
    
    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});