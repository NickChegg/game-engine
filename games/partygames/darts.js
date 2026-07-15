// --- Elements ---
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const playerListContainer = document.getElementById("player-list-container");
const btnAddPlayer = document.getElementById("btn-add-player");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const turnStatusTitle = document.getElementById("turn-status-title");
const turnStatusDesc = document.getElementById("turn-status-desc");
const rpContainer = document.getElementById("rp-container");
const midgameRpText = document.getElementById("midgame-rp-text");
const btnPushNext = document.getElementById("btn-push-next");
const btnSkipNext = document.getElementById("btn-skip-next");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");

const scoreHud = document.getElementById("score-hud");
const dartboard = document.getElementById("dartboard");
const reticle = document.getElementById("reticle");
const markersLayer = document.getElementById("markers-layer");
const dartsLeftDisplay = document.getElementById("darts-left-display");

// --- Configuration & Dartboard Math ---
// Angles for the 20 sectors clockwise starting from 12 o'clock
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BOARD_RADIUS = 0.5; // Max radius normalized 0 to 0.5
// Estimated ring thresholds (normalized to 0.5 radius) based on standard assets
const R_INNER_BULL = 0.025;
const R_OUTER_BULL = 0.055;
const R_TREBLE_IN  = 0.25;
const R_TREBLE_OUT = 0.285;
const R_DOUBLE_IN  = 0.42;
const R_DOUBLE_OUT = 0.455;

const AI_DIFF = {
    "easy": { chance: 0.3, scatter: 0.25 },
    "medium": { chance: 0.6, scatter: 0.10 },
    "hard": { chance: 0.9, scatter: 0.03 }
};

const USER_SWAY = {
    "easy": { rad: 10, spd: 1 },
    "medium": { rad: 25, spd: 1.8 },
    "hard": { rad: 50, spd: 3 }
};

// --- Game State ---
let players = [];
let targetScore = 301;
let reqDoubleIn = false;
let reqDoubleOut = false;
let userDifficulty = "medium";
let activePlayerIdx = 0;
let dartsRemaining = 3;
let currentRoundScore = 0;
let currentRoundStrings = [];
let turnStartScore = 0;
let gameActive = false;
let currentRank = 1;
let finishedCount = 0;

// Mouse Tracking
let mouseX = 0.5;
let mouseY = 0.5;
let reticleX = 0.5;
let reticleY = 0.5;
let swayTime = 0;

// --- Setup Phase ---
let playerIdCounter = 1;

function createPlayerRow(isUser = false, defaultName = "") {
    const id = playerIdCounter++;
    const div = document.createElement("div");
    div.className = "player-row";
    div.id = `player-row-${id}`;
    
    div.innerHTML = `
        <input type="text" class="text-input p-name" placeholder="Name" value="${isUser ? '{{user}}' : defaultName}" style="flex: 2; padding: 8px;">
        <select class="select-input p-type" style="flex: 1; padding: 8px;">
            <option value="user" ${isUser ? 'selected' : ''}>User</option>
            <option value="easy" ${!isUser ? 'selected' : ''}>AI: Easy</option>
            <option value="medium">AI: Medium</option>
            <option value="hard">AI: Hard</option>
        </select>
        <button class="remove-btn" onclick="document.getElementById('player-row-${id}').remove()" title="Remove">X</button>
    `;
    playerListContainer.appendChild(div);
}

btnAddPlayer.addEventListener("click", () => createPlayerRow(false, "Opponent"));

// Initialize defaults
createPlayerRow(true);
createPlayerRow(false, "Opponent");

btnStart.addEventListener("click", () => {
    const rows = document.querySelectorAll(".player-row");
    if (rows.length < 2) return alert("Need at least 2 players!");

    targetScore = parseInt(document.getElementById("game-type").value);
    reqDoubleIn = document.getElementById("rule-double-in").checked;
    reqDoubleOut = document.getElementById("rule-double-out").checked;
    userDifficulty = document.getElementById("user-diff").value;

    players = [];
    rows.forEach(row => {
        const name = row.querySelector(".p-name").value.trim() || "Unknown";
        const typeSelect = row.querySelector(".p-type").value;
        players.push({
            name,
            isUser: typeSelect === "user",
            diff: typeSelect !== "user" ? typeSelect : null,
            score: targetScore,
            doubledIn: !reqDoubleIn, // if not required, already true
            rank: null,
            finished: false
        });
    });

    currentRank = 1;
    finishedCount = 0;
    activePlayerIdx = 0;
    gameActive = true;

    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    
    renderHUD();
    startTurn();
    requestAnimationFrame(updateReticle);
});

btnRestart.addEventListener("click", () => location.reload());

// --- HUD & Updates ---
function renderHUD() {
    scoreHud.innerHTML = "";
    players.forEach((p, i) => {
        const card = document.createElement("div");
        card.className = `hud-card ${i === activePlayerIdx && !p.finished ? 'active' : ''} ${p.finished ? 'finished' : ''}`;
        
        let rankStr = p.finished ? `<span class="hud-rank">${getOrdinal(p.rank)} Place</span>` : "";
        card.innerHTML = `
            <div class="hud-name">${p.name}</div>
            <div class="hud-score">${p.score}</div>
            ${rankStr}
        `;
        scoreHud.appendChild(card);
    });
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- Dart Math Engine ---
function getDartResult(px, py) {
    // Center at 0.5, 0.5. Radius up to 0.5
    let dx = px - 0.5;
    let dy = py - 0.5;
    let dist = Math.sqrt(dx*dx + dy*dy);
    
    // Bounds check
    if (dist > R_DOUBLE_OUT) return { pts: 0, mult: 1, label: "Miss" };

    // Bulls
    if (dist <= R_INNER_BULL) return { pts: 50, mult: 2, label: "Double Bullseye" };
    if (dist <= R_OUTER_BULL) return { pts: 25, mult: 1, label: "Bullseye" };

    // Calculate angle. atan2(dy, dx) -> 0 at right, 90 at bottom.
    // We want 0 at top (-90 degrees). 
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180 / Math.PI + 90 + 360) % 360; // 0 is top
    let shifted = (angleDeg + 9) % 360; // offset by half sector
    let sectorIdx = Math.floor(shifted / 18);
    let points = SECTORS[sectorIdx];

    // Rings
    if (dist > R_DOUBLE_IN && dist <= R_DOUBLE_OUT) return { pts: points * 2, mult: 2, label: `D${points}` };
    if (dist > R_TREBLE_IN && dist <= R_TREBLE_OUT) return { pts: points * 3, mult: 3, label: `T${points}` };
    
    return { pts: points, mult: 1, label: `${points}` };
}

// --- Gameplay Flow ---
function startTurn() {
    if (!gameActive) return;
    
    // Check Loss condition (only 1 player left)
    if (players.length - finishedCount <= 1) {
        endGame();
        return;
    }

    let p = players[activePlayerIdx];
    if (p.finished) {
        advancePlayer();
        return;
    }

    dartsRemaining = 3;
    currentRoundScore = 0;
    currentRoundStrings = [];
    turnStartScore = p.score;
    markersLayer.innerHTML = "";
    renderHUD();

    turnStatusTitle.innerText = `${p.name}'s Turn`;
    turnStatusTitle.style.color = p.isUser ? "#89ddff" : "#f7768e";
    turnStatusDesc.innerText = "Waiting to throw...";
    dartsLeftDisplay.innerText = `Darts Left: 3`;
    rpContainer.style.display = "none";
    
    if (p.isUser) {
        reticle.style.display = "block";
    } else {
        reticle.style.display = "none";
        setTimeout(() => doAITurn(p), 1000);
    }
}

function processHit(rx, ry) {
    let p = players[activePlayerIdx];
    let res = getDartResult(rx, ry);
    
    // Draw marker
    let m = document.createElement("div");
    m.className = "dart-marker";
    m.style.left = `${rx * 100}%`;
    m.style.top = `${ry * 100}%`;
    markersLayer.appendChild(m);

    // Rule Logic
    let validScore = true;
    if (reqDoubleIn && !p.doubledIn) {
        if (res.mult === 2) {
            p.doubledIn = true;
        } else {
            validScore = false;
        }
    }

    let actualPoints = validScore ? res.pts : 0;
    p.score -= actualPoints;
    currentRoundScore += actualPoints;
    currentRoundStrings.push(validScore ? res.label : `Miss (${res.label})`);

    // Bust Logic
    let bust = false;
    let won = false;

    if (p.score < 0 || (p.score === 1 && reqDoubleOut)) {
        bust = true;
    } else if (p.score === 0) {
        if (reqDoubleOut && res.mult !== 2) bust = true;
        else won = true;
    }

    if (bust) {
        p.score = turnStartScore;
        turnStatusDesc.innerText = `Bust! Scored too high. Turn over.`;
        endTurnSequence(p, true);
    } else if (won) {
        p.finished = true;
        p.rank = currentRank++;
        finishedCount++;
        turnStatusDesc.innerText = `Finished! ${p.name} secures ${getOrdinal(p.rank)} Place.`;
        endTurnSequence(p, false, true);
    } else {
        dartsRemaining--;
        dartsLeftDisplay.innerText = `Darts Left: ${dartsRemaining}`;
        turnStatusDesc.innerText = `Hit ${res.label}! Score left: ${p.score}`;
        
        if (dartsRemaining === 0) {
            endTurnSequence(p, false);
        } else if (!p.isUser) {
            setTimeout(() => doAITurn(p), 800);
        }
    }
    renderHUD();
}

function endTurnSequence(p, isBust, isWin = false) {
    dartsRemaining = 0;
    reticle.style.display = "none";
    
    let summaryStr = `\`${p.name} threw 3 darts: ${currentRoundStrings.join(", ")} (Total: ${currentRoundScore}).\``;
    if (isBust) summaryStr = `\`${p.name} BUSTED on their throw: ${currentRoundStrings.join(", ")}. Score reset to ${turnStartScore}.\``;
    if (isWin) summaryStr = `\`${p.name} hit ${currentRoundStrings[currentRoundStrings.length-1]} and reached exactly 0, finishing in ${getOrdinal(p.rank)} place!\``;
    else summaryStr += `\n<${p.name} currently has ${p.score} points remaining.>`;

    // Store it in the DOM element for pushing
    midgameRpText.dataset.payload = summaryStr;
    midgameRpText.value = "";
    
    rpContainer.style.display = "block";
}

function advancePlayer() {
    activePlayerIdx = (activePlayerIdx + 1) % players.length;
    startTurn();
}

// User Input Hooks
dartboard.addEventListener("mousemove", (e) => {
    let rect = dartboard.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = (e.clientY - rect.top) / rect.height;
});

dartboard.addEventListener("click", () => {
    let p = players[activePlayerIdx];
    if (gameActive && p.isUser && dartsRemaining > 0 && rpContainer.style.display === "none") {
        processHit(reticleX, reticleY);
    }
});

btnPushNext.addEventListener("click", () => {
    let baseStr = midgameRpText.dataset.payload;
    let rp = midgameRpText.value.trim();
    if (rp) baseStr += `\n${rp}`;
    STBridge.sendMessage(baseStr);
    advancePlayer();
});

btnSkipNext.addEventListener("click", advancePlayer);

// --- Sway Mechanics ---
function updateReticle() {
    if (!gameActive) return;
    
    if (players[activePlayerIdx].isUser && dartsRemaining > 0 && rpContainer.style.display === "none") {
        let conf = USER_SWAY[userDifficulty];
        swayTime += 0.016; // Approx 60fps
        
        let ox = (Math.sin(swayTime * conf.spd) * conf.rad) + (Math.cos(swayTime * conf.spd * 0.7) * conf.rad * 0.5);
        let oy = (Math.cos(swayTime * conf.spd * 1.1) * conf.rad) + (Math.sin(swayTime * conf.spd * 0.8) * conf.rad * 0.5);
        
        // Convert pixel offset to percent
        let w = dartboard.clientWidth || 450;
        let oxPct = ox / w;
        let oyPct = oy / w;

        reticleX = mouseX + oxPct;
        reticleY = mouseY + oyPct;
        
        // Clamp to board
        reticleX = Math.max(0, Math.min(1, reticleX));
        reticleY = Math.max(0, Math.min(1, reticleY));
        
        reticle.style.left = `${reticleX * 100}%`;
        reticle.style.top = `${reticleY * 100}%`;
    }
    
    requestAnimationFrame(updateReticle);
}

// --- AI Mechanics ---
function doAITurn(p) {
    if (dartsRemaining <= 0 || p.finished || rpContainer.style.display === "block") return;
    
    // Pick intended target
    let target = getAITarget(p.score, p.doubledIn);
    
    // Roll accuracy
    let conf = AI_DIFF[p.diff];
    let actualX = target.x;
    let actualY = target.y;

    if (Math.random() > conf.chance) {
        // Missed intended - apply scatter
        let angle = Math.random() * Math.PI * 2;
        let dist = Math.random() * conf.scatter;
        actualX += Math.cos(angle) * dist;
        actualY += Math.sin(angle) * dist;
    }

    processHit(actualX, actualY);
}

function getAITarget(score, hasDoubledIn) {
    // Very rudimentary AI targeting
    let targetVal = 20; 
    let targetMult = 3; // Default aim T20

    if (reqDoubleIn && !hasDoubledIn) {
        targetVal = 20; targetMult = 2; // Aim D20 to get in
    } else if (score > 60) {
        targetVal = 20; targetMult = 3;
    } else {
        // Simple checkout strategy
        if (score === 50 && reqDoubleOut) { targetVal = 25; targetMult = 2; }
        else if (score <= 40 && score % 2 === 0) { targetVal = score/2; targetMult = 2; }
        else if (score > 40) { targetVal = 20; targetMult = 1; } // Just chip away
        else { targetVal = score > 20 ? 20 : score; targetMult = reqDoubleOut ? 1 : 1; }
        
        if (!reqDoubleOut && score <= 20) { targetVal = score; targetMult = 1; }
    }

    // Convert to angle & radius
    let secIdx = SECTORS.indexOf(targetVal);
    if (secIdx === -1) secIdx = 0;
    
    let angleDeg = -90 + (secIdx * 18);
    let angleRad = angleDeg * Math.PI / 180;
    
    let r = R_TREBLE_IN + (R_TREBLE_OUT - R_TREBLE_IN)/2; // default treble
    if (targetVal === 25) {
        r = targetMult === 2 ? R_INNER_BULL/2 : R_OUTER_BULL - 0.01;
    } else if (targetMult === 2) {
        r = R_DOUBLE_IN + (R_DOUBLE_OUT - R_DOUBLE_IN)/2;
    } else if (targetMult === 1) {
        r = R_TREBLE_OUT + (R_DOUBLE_IN - R_TREBLE_OUT)/2; // Outer single
    }

    return {
        x: 0.5 + Math.cos(angleRad) * r,
        y: 0.5 + Math.sin(angleRad) * r
    };
}

// --- End Game ---
function endGame() {
    gameActive = false;
    let loser = players.find(p => !p.finished);
    
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    
    endStats.innerHTML = `${loser.name} is the final loser!`;
    endRpText.dataset.loser = loser.name;
}

btnPushEnd.addEventListener("click", () => {
    let loserName = endRpText.dataset.loser;
    let ranks = players.filter(p => p.finished).sort((a,b) => a.rank - b.rank).map(p => `${getOrdinal(p.rank)}: ${p.name}`).join("\n");
    
    let str = `\`The game of Darts has concluded!\`\n\n**Standings:**\n${ranks}\nLast Place (Loser): ${loserName}`;
    
    let rp = endRpText.value.trim();
    if (rp) str += `\n\n${rp}`;

    STBridge.sendMessage(str, { losers: [loserName] });
    location.reload();
});