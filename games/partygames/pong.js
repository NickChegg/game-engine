// --- DOM Elements ---
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const roundPanel = document.getElementById("round-panel");
const endGamePanel = document.getElementById("end-game-panel");

const aiNameInput = document.getElementById("ai-name");
const aiSkillSelect = document.getElementById("ai-skill");
const gameRulesSelect = document.getElementById("game-rules");
const targetScoreGroup = document.getElementById("target-score-group");
const targetScoreInput = document.getElementById("target-score");

const scoreUserUI = document.getElementById("score-user");
const scoreAiUI = document.getElementById("score-ai");
const aiNameDisplay = document.getElementById("ai-name-display");
const ruleDisplay = document.getElementById("rule-display");

const roundWinnerText = document.getElementById("round-winner-text");
const roundScoreText = document.getElementById("round-score-text");
const matchWinnerText = document.getElementById("match-winner-text");
const endStats = document.getElementById("end-stats");

const canvas = document.getElementById("pong-canvas");
const ctx = canvas.getContext("2d");

// --- Game Settings & State ---
let aiName = "AI";
let aiSkill = 5;
let isTennis = true;
let targetPoints = 5;

let userPoints = 0;
let aiPoints = 0;
let gameActive = false;
let animationId;
const tennisScores = ["0", "15", "30", "40"];

// Physics Settings
const MIN_BALL_SPEED = 4;
const MAX_BALL_SPEED = 16;
const BASE_BALL_SPEED = 6;
const FRICTION = 0.90; // 10% speed reduction per hit
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 70;
const POWER_CHARGE_MS = 1000; // 1 second for full bar
const POWER_WINDOW_PX = 35; // Pixels away from paddle where release is valid

// Entities
const user = { x: 20, y: 140, w: PADDLE_WIDTH, h: PADDLE_HEIGHT, color: "#7aa2f7", charging: false, chargeStart: 0, powerReady: 0 };
const ai = { x: 570, y: 140, w: PADDLE_WIDTH, h: PADDLE_HEIGHT, color: "#f7768e", charging: false, chargeStart: 0, powerReady: 0, aiDecidedPower: false };
const ball = { x: 300, y: 175, radius: 8, dx: 0, dy: 0, speed: BASE_BALL_SPEED, color: "#e0af68" };

let keys = {};
let mouseDown = false;

// --- Event Listeners ---
gameRulesSelect.addEventListener("change", (e) => {
    targetScoreGroup.style.display = e.target.value === "points" ? "block" : "none";
});

document.getElementById("btn-start").addEventListener("click", initGame);

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const root = document.documentElement;
    let mouseY = e.clientY - rect.top - root.scrollTop;
    user.y = mouseY - user.h / 2;
    // Bounds check
    if (user.y < 0) user.y = 0;
    if (user.y + user.h > canvas.height) user.y = canvas.height - user.h;
});

canvas.addEventListener("mousedown", () => mouseDown = true);
canvas.addEventListener("mouseup", () => {
    mouseDown = false;
    processPowerRelease(user, ball, true);
});

window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup", (e) => { 
    keys[e.code] = false; 
    if (e.code === "Space") processPowerRelease(user, ball, true);
});

document.getElementById("btn-push-round").addEventListener("click", () => {
    pushRoundUpdate();
    roundPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    resetBall(lastScorer === "user" ? -1 : 1);
    gameActive = true;
    gameLoop();
});

document.getElementById("btn-skip-round").addEventListener("click", () => {
    roundPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    resetBall(lastScorer === "user" ? -1 : 1);
    gameActive = true;
    gameLoop();
});

document.getElementById("btn-cancel-end").addEventListener("click", () => {
    endGamePanel.classList.add("hidden");
    setupPanel.classList.remove("hidden");
});

document.getElementById("btn-confirm-end").addEventListener("click", () => {
    pushMatchResult();
    endGamePanel.classList.add("hidden");
    setupPanel.classList.remove("hidden");
});

// --- Game Logic ---
function initGame() {
    aiName = aiNameInput.value.trim() || "AI";
    aiSkill = parseInt(aiSkillSelect.value);
    isTennis = gameRulesSelect.value === "tennis";
    targetPoints = parseInt(targetScoreInput.value) || 5;

    userPoints = 0;
    aiPoints = 0;
    aiNameDisplay.innerText = aiName;
    ruleDisplay.innerText = isTennis ? "Tennis Rules" : `First to ${targetPoints}`;
    updateScoreUI();

    setupPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");

    resetBall(1);
    gameActive = true;
    gameLoop();
}

function resetBall(direction) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = BASE_BALL_SPEED;
    ball.dx = direction * ball.speed;
    ball.dy = (Math.random() * 2 - 1) * ball.speed;
    
    user.charging = false;
    user.powerReady = 0;
    ai.charging = false;
    ai.powerReady = 0;
    ai.aiDecidedPower = false;
}

function processPowerRelease(playerObj, ballObj, isUser) {
    if (playerObj.charging) {
        playerObj.charging = false;
        const heldTime = Date.now() - playerObj.chargeStart;
        const chargePercent = Math.min(1, heldTime / POWER_CHARGE_MS);
        
        // Determine distance based on whether it's the left or right paddle
        let dist = isUser ? (ballObj.x - (playerObj.x + playerObj.w)) : (playerObj.x - ballObj.x);
        
        // If puck is approaching and within range
        if (dist > 0 && dist < POWER_WINDOW_PX) {
            // Check Y overlap roughly
            if (ballObj.y >= playerObj.y - 15 && ballObj.y <= playerObj.y + playerObj.h + 15) {
                playerObj.powerReady = chargePercent; // Prime the power for the upcoming hit
                
                // Decay the ready state after 250ms if they completely missed
                setTimeout(() => { playerObj.powerReady = 0; }, 250);
            }
        }
    }
}

function gameLoop() {
    if (!gameActive) return;
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

function update() {
    // 1. User Charge Logic
    if (mouseDown || keys['Space']) {
        if (!user.charging) {
            user.charging = true;
            user.chargeStart = Date.now();
        }
    }

    // NEW: User Keyboard Movement Logic (Arrow keys or W/S)
    const userSpeed = 8;
    if (keys['ArrowUp'] || keys['KeyW']) {
        user.y -= userSpeed;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
        user.y += userSpeed;
    }
    
    // User bounds check (Important for keyboard movement)
    if (user.y < 0) user.y = 0;
    if (user.y + user.h > canvas.height) user.y = canvas.height - user.h;

    // 2. AI Movement & Logic
    let aiCenter = ai.y + ai.h / 2;
    let aiMaxSpeed = (aiSkill * 0.8) + 1; // Skill 1 = 1.8px/f, Skill 10 = 9px/f
    
    // Move towards ball if it's coming towards AI
    if (ball.dx > 0) {
        if (aiCenter < ball.y - 10) ai.y += aiMaxSpeed;
        else if (aiCenter > ball.y + 10) ai.y -= aiMaxSpeed;
    }
    
    // AI bounds
    if (ai.y < 0) ai.y = 0;
    if (ai.y + ai.h > canvas.height) ai.y = canvas.height - ai.h;

    // AI Charge Logic
    if (ball.dx > 0 && ball.x > canvas.width / 2) {
        if (!ai.aiDecidedPower) {
            ai.aiDecidedPower = true;
            let willPower = Math.random() < (aiSkill * 0.1); // Skill 10 = 100% chance to try
            if (willPower) {
                ai.charging = true;
                ai.chargeStart = Date.now() - (Math.random() * 500); // Start with some pseudo-charge
            }
        }
        
        // AI releases when close
        if (ai.charging && (ai.x - ball.x) < (POWER_WINDOW_PX - 5)) {
            processPowerRelease(ai, ball, false);
        }
    } else {
        ai.aiDecidedPower = false;
        ai.charging = false;
    }

    // 3. Move Ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // 4. Wall Collisions
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.dy *= -1;
        applyFriction();
    } else if (ball.y + ball.radius > canvas.height) {
        ball.y = canvas.height - ball.radius;
        ball.dy *= -1;
        applyFriction();
    }

    // 5. Paddle Collisions
    let hitPaddle = null;
    
    // User collision
    if (ball.x - ball.radius < user.x + user.w && ball.x + ball.radius > user.x && ball.y > user.y && ball.y < user.y + user.h) {
        if (ball.dx < 0) {
            ball.x = user.x + user.w + ball.radius;
            hitPaddle = user;
        }
    }
    
    // AI collision
    if (ball.x + ball.radius > ai.x && ball.x - ball.radius < ai.x + ai.w && ball.y > ai.y && ball.y < ai.y + ai.h) {
        if (ball.dx > 0) {
            ball.x = ai.x - ball.radius;
            hitPaddle = ai;
        }
    }

    if (hitPaddle) {
        applyFriction();
        
        // Calculate bounce angle
        let collidePoint = (ball.y - (hitPaddle.y + hitPaddle.h/2));
        collidePoint = collidePoint / (hitPaddle.h/2); // Normalised -1 to 1
        let angleRad = (Math.PI/4) * collidePoint; // Max 45 degrees
        
        // Apply Power if ready
        if (hitPaddle.powerReady > 0) {
            let multiplier = 1 + hitPaddle.powerReady; // Up to 2x speed
            ball.speed = Math.min(MAX_BALL_SPEED, ball.speed * multiplier);
            hitPaddle.powerReady = 0; // Consume
        }

        let direction = (hitPaddle === user) ? 1 : -1;
        ball.dx = direction * ball.speed * Math.cos(angleRad);
        ball.dy = ball.speed * Math.sin(angleRad);
    }

    // 6. Scoring
    if (ball.x < 0) {
        handleScore("ai");
    } else if (ball.x > canvas.width) {
        handleScore("user");
    }
}

function applyFriction() {
    ball.speed = Math.max(MIN_BALL_SPEED, ball.speed * FRICTION);
    
    // Preserve vector direction
    let currentMag = Math.sqrt(ball.dx*ball.dx + ball.dy*ball.dy);
    ball.dx = (ball.dx / currentMag) * ball.speed;
    ball.dy = (ball.dy / currentMag) * ball.speed;
}

// --- Rendering ---
function draw() {
    // Clear
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Net
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 0);
    ctx.lineTo(canvas.width/2, canvas.height);
    ctx.strokeStyle = "#24283b";
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw User
    ctx.fillStyle = user.color;
    ctx.fillRect(user.x, user.y, user.w, user.h);
    drawChargeBar(user, -20);

    // Draw AI
    ctx.fillStyle = ai.color;
    ctx.fillRect(ai.x, ai.y, ai.w, ai.h);
    drawChargeBar(ai, ai.w + 10);

    // Draw Ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
}

function drawChargeBar(pObj, xOffset) {
    if (pObj.charging) {
        let pct = Math.min(1, (Date.now() - pObj.chargeStart) / POWER_CHARGE_MS);
        let barHeight = pObj.h * pct;
        
        ctx.fillStyle = "#565f89";
        ctx.fillRect(pObj.x + xOffset, pObj.y, 5, pObj.h);
        
        // Color shifts from yellow to green to red based on charge
        ctx.fillStyle = pct === 1 ? "#f7768e" : (pct > 0.5 ? "#e0af68" : "#9ece6a");
        ctx.fillRect(pObj.x + xOffset, pObj.y + (pObj.h - barHeight), 5, barHeight);
    }
}

// --- Scoring & Match Flow ---
let lastScorer = "";

function handleScore(winner) {
    gameActive = false;
    cancelAnimationFrame(animationId);
    lastScorer = winner;

    if (winner === "user") userPoints++;
    else aiPoints++;

    updateScoreUI();

    let matchWinner = checkMatchWinner();
    if (matchWinner) {
        showMatchOver(matchWinner);
    } else {
        showRoundOver(winner);
    }
}

function updateScoreUI() {
    if (isTennis) {
        let scoreStr = getTennisScoreStr();
        if (scoreStr === "Deuce" || scoreStr.startsWith("Advantage")) {
            scoreUserUI.innerText = scoreStr;
            scoreAiUI.innerText = "";
        } else {
            let parts = scoreStr.split(" - ");
            scoreUserUI.innerText = parts[0];
            scoreAiUI.innerText = parts[1];
        }
    } else {
        scoreUserUI.innerText = userPoints;
        scoreAiUI.innerText = aiPoints;
    }
}

function getTennisScoreStr() {
    if (userPoints < 3 && aiPoints < 3) return `${tennisScores[userPoints]} - ${tennisScores[aiPoints]}`;
    if (userPoints === 3 && aiPoints === 3) return "Deuce";
    if (userPoints >= 3 || aiPoints >= 3) {
        if (userPoints === aiPoints) return "Deuce";
        if (userPoints - aiPoints === 1) return "Advantage {{user}}";
        if (aiPoints - userPoints === 1) return `Advantage ${aiName}`;
    }
    // Fallback if numbers get weird, though win check usually catches it
    return `${tennisScores[Math.min(userPoints, 3)]} - ${tennisScores[Math.min(aiPoints, 3)]}`; 
}

function checkMatchWinner() {
    if (isTennis) {
        if (userPoints >= 4 && userPoints - aiPoints >= 2) return "user";
        if (aiPoints >= 4 && aiPoints - userPoints >= 2) return "ai";
    } else {
        if (userPoints >= targetPoints) return "user";
        if (aiPoints >= targetPoints) return "ai";
    }
    return null;
}

function showRoundOver(winner) {
    gamePanel.classList.add("hidden");
    roundPanel.classList.remove("hidden");
    document.getElementById("round-rp-text").value = "";
    
    roundWinnerText.innerText = winner === "user" ? "Point to You!" : `Point to ${aiName}!`;
    roundWinnerText.style.color = winner === "user" ? "#9ece6a" : "#f7768e";
    
    let currentScore = isTennis ? getTennisScoreStr() : `${userPoints} - ${aiPoints}`;
    roundScoreText.innerText = `Current Score: ${currentScore}`;
}

function showMatchOver(winner) {
    gamePanel.classList.add("hidden");
    endGamePanel.classList.remove("hidden");
    document.getElementById("end-rp-text").value = "";

    matchWinnerText.innerText = winner === "user" ? "You Won the Match!" : `${aiName} Won the Match!`;
    matchWinnerText.style.color = winner === "user" ? "#9ece6a" : "#f7768e";

    let finalScore = isTennis ? getTennisScoreStr() : `${userPoints} - ${aiPoints}`;
    endStats.innerHTML = `Final Score:<br><span style="color:var(--text-main); font-weight:bold;">${finalScore}</span>`;
}

// --- RP Hooks (STBridge) ---
function pushRoundUpdate() {
    let rpText = document.getElementById("round-rp-text").value.trim();
    let scoreDisplay = isTennis ? getTennisScoreStr() : `${userPoints} - ${aiPoints}`;
    let pointWinner = lastScorer === "user" ? "{{user}}" : aiName;
    
    let msg = `\`${pointWinner} scores a point in Pong! (Current Score: ${scoreDisplay})\``;
    if (rpText) msg += `\n${rpText}`;
    
    STBridge.sendMessage(msg);
}

function pushMatchResult() {
    let rpText = document.getElementById("end-rp-text").value.trim();
    let winner = lastScorer === "user" ? "user" : "ai";
    
    let winnerName = winner === "user" ? "{{user}}" : aiName;
    let loserName = winner === "user" ? aiName : "{{user}}";
    let scoreDisplay = isTennis ? getTennisScoreStr() : `${userPoints} - ${aiPoints}`;
    
    let resultString = `\`${winnerName} wins the match of Power Pong! (Final Score: ${scoreDisplay})\``;
    resultString += `\n<Match played against ${aiName} at Skill Level ${aiSkill}/10. Roleplay accordingly.>`;
    if (rpText) resultString += `\n${rpText}`;

    // Pass the Strip hook Object
    let gameResult = {
        winners: [winnerName],
        losers: [loserName]
    };

    STBridge.sendMessage(resultString, gameResult);
}