// DOM Elements
const btnStart = document.getElementById("btn-start");

const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");

const timeVal = document.getElementById("time-val");
const scoreVal = document.getElementById("score-val");
const powerFill = document.getElementById("power-fill");
const powerText = document.getElementById("power-text");

const arena = document.getElementById("arena");
const ball = document.getElementById("ball");

const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnRetryEnd = document.getElementById("btn-retry-end");

// Game State
let score = 0;
let timeLeft = 30;
let gameActive = false;
let timerInterval = null;

// Physics / Mechanics State
let isHovering = false;
let isCharging = false;
let isThrown = false;
let power = 0;
let powerDir = 1;
let lastFrameTime = 0;
let animationFrameId = null;

// Track global mouse position to allow Spacebar dragging
let mouseX = 0;
let mouseY = 0;

// Arena Constants
const HOOP_X_PERCENT = 50; 
const HOOP_Y = 95;      // Pixel Y of the hoop
const BOTTOM_ROW = 440; // Pixel Y of the spawn row
const HOOP_RADIUS = 30; // Physical radius of hoop

// ==========================================
// 1. GAME SETUP & LOOP
// ==========================================
btnStart.addEventListener("click", () => {
    score = 0;
    timeLeft = 30;
    gameActive = true;
    isThrown = false;
    isCharging = false;
    power = 0;
    
    timeVal.innerText = timeLeft;
    scoreVal.innerText = score;
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    
    respawnBall();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timeVal.innerText = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);

    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
});

function gameLoop(timestamp) {
    if (!gameActive) return;
    
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (isCharging && !isThrown) {
        // Meter takes exactly 1 second (1000ms) to go 0->100
        const powerSpeed = 100; // 100% per second
        power += powerDir * powerSpeed * (delta / 1000);

        if (power >= 100) { power = 100; powerDir = -1; }
        if (power <= 0) { power = 0; powerDir = 1; }

        powerFill.style.width = `${power}%`;
        powerText.innerText = `${Math.round(power)}%`;

        // Update ball color slightly to show charge limits
        if (power < 10 || power > 90) {
            powerFill.style.background = "#f7768e"; // Bad zone
        } else {
            powerFill.style.background = "#9ece6a"; // Good zone
        }

        // Stick ball to mouse constraints
        const rect = arena.getBoundingClientRect();
        let constrainedX = Math.max(20, Math.min(rect.width - 20, mouseX));
        let constrainedY = Math.max(50, Math.min(rect.height - 20, mouseY));
        
        ball.style.left = `${constrainedX}px`;
        ball.style.top = `${constrainedY}px`;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// ==========================================
// 2. INPUT HANDLING
// ==========================================

// Track mouse globally over the arena
arena.addEventListener('pointermove', (e) => {
    const rect = arena.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Ball Hover State (For spacebar grab)
ball.addEventListener('pointerenter', () => { isHovering = true; });
ball.addEventListener('pointerleave', () => { isHovering = false; });

// MOUSE Interaction
ball.addEventListener("pointerdown", (e) => {
    if (!gameActive || isThrown) return;
    startCharge();
    e.preventDefault();
});

window.addEventListener("pointerup", (e) => {
    if (isCharging) releaseThrow();
});

// SPACEBAR Interaction
window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        if (gameActive) e.preventDefault(); // Prevent page scroll
        
        if (!isCharging && !isThrown && isHovering && gameActive) {
            startCharge();
        }
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && isCharging) {
        releaseThrow();
    }
});

function startCharge() {
    isCharging = true;
    ball.style.transition = "none";
    ball.style.transform = "translate(-50%, -50%) scale(1.1)";
}

function releaseThrow() {
    isCharging = false;
    isThrown = true;
    evaluateShot();
}

// ==========================================
// 3. SHOT EVALUATION & PHYSICS
// ==========================================
function evaluateShot() {
    // Current positions
    const ballX = parseFloat(ball.style.left);
    const ballY = parseFloat(ball.style.top);
    const rect = arena.getBoundingClientRect();
    const hoopCenterPx = rect.width * (HOOP_X_PERCENT / 100);

    // 1. Horizontal Check (Increased Leeway)
    const distanceX = Math.abs(ballX - hoopCenterPx);
    const isXAligned = distanceX <= (HOOP_RADIUS + 10); // Extends forgiveness by 10px

    // 2. Vertical Power Check
    // Map Y (from HoopY to BottomRow) to 15% -> 85% Power.
    let requiredPower = 15 + ((ballY - HOOP_Y) / (BOTTOM_ROW - HOOP_Y)) * 70;
    requiredPower = Math.max(15, Math.min(85, requiredPower)); 

    // Increased power leeway to ±12%
    const isPowerMatched = Math.abs(power - requiredPower) <= 12; 
    
    // Limits
    const isAutomaticFail = power < 10 || power > 90;

    let success = isXAligned && isPowerMatched && !isAutomaticFail;

    // Trigger Visual Animation
    ball.style.transition = "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)";
    
    if (success) {
        // SWISH!
        ball.style.left = `${HOOP_X_PERCENT}%`;
        ball.style.top = `${HOOP_Y}px`;
        ball.style.transform = "translate(-50%, -50%) scale(0.6)";
        
        setTimeout(() => {
            showFloatingText("SCORE!", "#9ece6a", ballX, ballY);
            score++;
            scoreVal.innerText = score;
            
            // Fall through hoop animation
            ball.style.transition = "all 0.3s ease-in";
            ball.style.top = `${HOOP_Y + 100}px`;
            ball.style.zIndex = 5; // Go behind the front rim
            
            setTimeout(respawnBall, 350);
        }, 500);
    } else {
        // MISS!
        // Calculate a deflected position based on X error
        let deflectX = (ballX < hoopCenterPx) ? hoopCenterPx - 40 : hoopCenterPx + 40;
        let deflectY = HOOP_Y - 20;

        // If wildly off, just shoot it to the backboard where they aimed
        if (!isXAligned) {
            deflectX = ballX;
            deflectY = Math.max(40, ballY - (power * 3));
        }

        ball.style.left = `${deflectX}px`;
        ball.style.top = `${deflectY}px`;
        ball.style.transform = "translate(-50%, -50%) scale(0.6)";

        setTimeout(() => {
            showFloatingText("MISS", "#f7768e", ballX, ballY);
            
            // Bounce off animation
            ball.style.transition = "all 0.4s ease-in";
            ball.style.top = `${BOTTOM_ROW + 50}px`;
            ball.style.left = `${deflectX + (Math.random() > 0.5 ? 40 : -40)}px`;
            
            setTimeout(respawnBall, 400);
        }, 500);
    }

    // Reset Power Meter visually immediately upon throw
    powerFill.style.width = `0%`;
    powerText.innerText = `0%`;
}

function respawnBall() {
    if (!gameActive) return;

    ball.style.transition = "none";
    ball.style.transform = "translate(-50%, -50%) scale(1)";
    ball.style.zIndex = 10;
    
    // Reappear at a random horizontal spot on the bottom row (10% to 90% width)
    const randomXPercent = Math.floor(Math.random() * 80) + 10;
    const rect = arena.getBoundingClientRect();
    
    ball.style.left = `${(randomXPercent / 100) * rect.width}px`;
    ball.style.top = `${BOTTOM_ROW}px`;
    
    power = 0;
    powerDir = 1;
    isThrown = false;
    isCharging = false;
}

function showFloatingText(text, color, x, y) {
    const el = document.createElement("div");
    el.className = "float-text";
    el.innerText = text;
    el.style.color = color;
    el.style.left = `${x}px`;
    el.style.top = `${y - 30}px`;
    arena.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

// ==========================================
// 4. GAME OVER & REPORTING
// ==========================================
function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animationFrameId);
    
    endStats.innerHTML = `
        <div style="color: #9ece6a; font-weight: bold; font-size: 1.2em;">Time's Up!</div>
        <div style="margin-top: 10px; font-size: 0.9em; color: #a9b1d6;">
            Final Score: <span style="color: white; font-weight: bold;">${score}</span>
        </div>
    `;
    
    setTimeout(() => {
        gamePanel.style.display = "none";
        endGamePanel.style.display = "block";
    }, 1000);
}

// Quiet Retry (Doesn't push to chat)
btnRetryEnd.addEventListener("click", () => {
    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

// Push Result to Chat
btnConfirmEnd.addEventListener("click", () => {
    
    // Score tier evaluations
    let perfText = "";
    if (score < 5) {
        perfText = "Too bad, maybe try again.";
    } else if (score >= 5 && score <= 10) {
        perfText = "Not a bad score!";
    } else if (score >= 11 && score <= 15) {
        perfText = "That's impressive!";
    } else {
        perfText = "Wow! You're a professional!";
    }
    
    let resultString = `\`{{user}} played Arcade Hoops and scored ${score} points! ${perfText}\``;
    resultString += `\n<Game was a 30-second arcade basketball shootout. React to their final score naturally.>`;

    const userRp = endRpText.value.trim();
    if (userRp) resultString += `\n${userRp}`;

    // Note: Passing 'null' for gameResult because this is a solo high-score game (no Strip Punishment targets)
    STBridge.sendMessage(resultString, null);

    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});