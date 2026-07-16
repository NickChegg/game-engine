// UI Elements
const setupView = document.getElementById("setup-view");
const gameView = document.getElementById("game-view");
const endView = document.getElementById("end-view");
const arenaPanel = document.getElementById("arena-panel");

const selMode = document.getElementById("sel-mode");
const selDiff = document.getElementById("sel-diff");
const playerListContainer = document.getElementById("player-list-container");
const newPlayerName = document.getElementById("new-player-name");
const btnAddPlayer = document.getElementById("btn-add-player");
const btnStart = document.getElementById("btn-start");

const currentTurnHeader = document.getElementById("current-turn-header");
const scoreboardContainer = document.getElementById("scoreboard");
const statsLine = document.getElementById("stats-line");
const btnPitch = document.getElementById("btn-pitch");
const btnMidPush = document.getElementById("btn-mid-push");
const btnPushFinal = document.getElementById("btn-push-final");
const btnRestart = document.getElementById("btn-restart");

const basesContainer = document.getElementById("bases-container");
const baseIcons = [
    document.getElementById("base-1"),
    document.getElementById("base-2"),
    document.getElementById("base-3")
];

const arena = document.getElementById("arena");
const ballEl = document.getElementById("ball");
const pitcherEl = document.getElementById("pitcher");
const statusText = document.getElementById("status-text");
const boxes = [
    document.getElementById("box-0"),
    document.getElementById("box-1"),
    document.getElementById("box-2")
];

// Game State
let players = ["{{user}}"];
let scores = {};
let currentPlayerIndex = 0;
let mode = "points";
let difficulty = "medium";
let eventLog = [];

// Turn State
let pitchesThrown = 0;
let strikes = 0;
let bases = [false, false, false];
const MAX_PITCHES = 10;
const MAX_STRIKES = 3;

// Animation State
let isBallInPlay = false;
let hasSwung = false;
let animationReq;
let pitchStartTime = 0;
let pitchType = 1; // 0=High, 1=Mid, 2=Low
let flightDuration = 1400; // ms to reach boxes

// Difficulty Config (Window in ms)
const diffConfig = {
    "easy": { window: 350, maxPoints: 100 },
    "medium": { window: 200, maxPoints: 100 },
    "hard": { window: 120, maxPoints: 100 }
};

// =====================================
// SETUP LOGIC
// =====================================
btnAddPlayer.addEventListener("click", () => {
    const name = newPlayerName.value.trim();
    if (name && !players.includes(name)) {
        players.push(name);
        renderPlayerList();
    }
    newPlayerName.value = "";
});

function renderPlayerList() {
    playerListContainer.innerHTML = "";
    players.forEach((p, index) => {
        const row = document.createElement("div");
        row.className = "player-row";
        if (index === 0) {
            row.innerHTML = `<span>${p} (You)</span>`;
        } else {
            row.innerHTML = `<span>${p}</span> <button class="remove-btn" onclick="removePlayer('${p}')">X</button>`;
        }
        playerListContainer.appendChild(row);
    });
}

window.removePlayer = (name) => {
    players = players.filter(p => p !== name);
    renderPlayerList();
};

btnStart.addEventListener("click", () => {
    mode = selMode.value;
    difficulty = selDiff.value;
    
    players.forEach(p => scores[p] = 0);
    currentPlayerIndex = 0;
    eventLog = [];
    
    basesContainer.style.display = mode === "runs" ? "flex" : "none";
    
    setupView.style.display = "none";
    gameView.style.display = "block";
    arenaPanel.style.display = "block";
    
    startPlayerTurn();
});

// =====================================
// GAME LOOP LOGIC
// =====================================
function startPlayerTurn() {
    if (currentPlayerIndex >= players.length) {
        endGame();
        return;
    }

    let pName = players[currentPlayerIndex];
    pitchesThrown = 0;
    strikes = 0;
    bases = [false, false, false];
    
    currentTurnHeader.innerText = `Batter up: ${pName}`;
    btnMidPush.style.display = (mode === "runs" && pName === "{{user}}") ? "block" : "none";
    updateScoreboard();
    updateStats();
    updateBasesUI();

    if (pName !== "{{user}}") {
        // It's an AI, simulate their turn instantly
        simulateAITurn(pName);
    } else {
        // User turn
        btnPitch.disabled = false;
        statusText.innerText = "Waiting for pitch...";
    }
}

function updateScoreboard() {
    scoreboardContainer.innerHTML = "";
    players.forEach((p, idx) => {
        let row = document.createElement("div");
        row.className = `score-row ${idx === currentPlayerIndex ? 'active' : ''}`;
        let ptsLabel = mode === "runs" ? "Runs" : "Pts";
        row.innerHTML = `<span>${p}</span> <span>${scores[p]} ${ptsLabel}</span>`;
        scoreboardContainer.appendChild(row);
    });
}

function updateStats() {
    if (mode === "points") {
        statsLine.innerText = `Pitch ${pitchesThrown} / ${MAX_PITCHES}`;
    } else {
        statsLine.innerText = `Strikes: ${strikes} / ${MAX_STRIKES}`;
    }
}

function updateBasesUI() {
    bases.forEach((occupied, idx) => {
        if (occupied) baseIcons[idx].classList.add("occupied");
        else baseIcons[idx].classList.remove("occupied");
    });
}

function logEvent(msg) {
    eventLog.push(`[${players[currentPlayerIndex]}] ${msg}`);
}

// =====================================
// PITCH & ANIMATION
// =====================================
btnPitch.addEventListener("click", () => {
    btnPitch.disabled = true;
    isBallInPlay = true;
    hasSwung = false;
    
    // Choose random pitch (0, 1, or 2)
    pitchType = Math.floor(Math.random() * 3);
    
    // Visual throw
    pitcherEl.classList.add("throwing");
    statusText.innerText = "Incoming Pitch!";
    
    setTimeout(() => {
        pitcherEl.classList.remove("throwing");
        startBallAnimation();
    }, 200);
});

boxes.forEach((box, idx) => {
    box.addEventListener("mousedown", () => {
        if (!isBallInPlay || hasSwung) return;
        hasSwung = true;
        resolveSwing(idx);
    });
});

function startBallAnimation() {
    ballEl.style.display = "block";
    pitchStartTime = Date.now();
    
    const arenaRect = arena.getBoundingClientRect();
    const startX = arenaRect.width - 50;
    const endX = 115; // Center of the strike zone boxes
    
    const boxRects = boxes.map(b => b.getBoundingClientRect());
    const arenaTop = arenaRect.top;
    
    const startY = arenaRect.height / 2;
    // Map target Y to the exact center of the targeted box
    const targetsY = [
        (boxRects[0].top - arenaTop) + (boxRects[0].height / 2),
        (boxRects[1].top - arenaTop) + (boxRects[1].height / 2),
        (boxRects[2].top - arenaTop) + (boxRects[2].height / 2)
    ];
    
    const targetY = targetsY[pitchType];

    function animate() {
        if (!isBallInPlay) {
            resetBall();
            return;
        }

        let elapsed = Date.now() - pitchStartTime;
        let progress = elapsed / flightDuration;

        if (progress >= 1) {
            // Ball reached the catcher without a swing -> Strike/Miss
            resolveSwing(-1);
            return;
        }

        // Math for curve balls
        let currentX = startX - ((startX - endX) * progress);
        let currentY = startY + ((targetY - startY) * progress);
        
        // Arc formulas
        if (pitchType === 0) {
            // High curve (arcs up then down into box)
            currentY -= Math.sin(progress * Math.PI) * 80;
        } else if (pitchType === 2) {
            // Low curve (drops low then rises slightly into box)
            currentY += Math.sin(progress * Math.PI) * 80;
        }

        ballEl.style.left = `${currentX}px`;
        ballEl.style.top = `${currentY}px`;

        // Difficulty visual hints
        handleVisualHints(progress);

        animationReq = requestAnimationFrame(animate);
    }
    
    animationReq = requestAnimationFrame(animate);
}

function handleVisualHints(progress) {
    let conf = diffConfig[difficulty];
    let diffMs = Math.abs(flightDuration - (Date.now() - pitchStartTime));
    
    boxes.forEach(b => { b.classList.remove('highlight', 'flash'); });
    ballEl.classList.remove('perfect-window');

    if (difficulty === "easy") {
        if (progress > 0.65 && progress < 0.95) {
            boxes[pitchType].classList.add("highlight");
        }
        if (diffMs <= conf.window) {
            ballEl.classList.add("perfect-window");
        }
    } else if (difficulty === "medium") {
        if (progress > 0.75 && progress < 0.85) {
            boxes[pitchType].classList.add("flash");
        }
    }
}

function resetBall() {
    isBallInPlay = false;
    ballEl.style.display = "none";
    boxes.forEach(b => b.classList.remove('highlight', 'flash'));
    cancelAnimationFrame(animationReq);
}

// =====================================
// HIT DETECTION & SCORING
// =====================================
function resolveSwing(swungBoxIdx) {
    let elapsed = Date.now() - pitchStartTime;
    resetBall();
    
    let timeDiff = Math.abs(flightDuration - elapsed);
    let conf = diffConfig[difficulty];
    
    let resultMsg = "";
    let hitQuality = "miss"; // miss, bad, good, perfect

    if (swungBoxIdx === -1 || swungBoxIdx !== pitchType) {
        resultMsg = "Miss!";
        hitQuality = "miss";
    } else if (timeDiff > conf.window) {
        resultMsg = "Swung too " + (elapsed < flightDuration ? "early!" : "late!");
        hitQuality = "miss";
    } else {
        // It's a Hit! Determine quality based on accuracy
        if (timeDiff <= 35) hitQuality = "perfect";
        else if (timeDiff <= (conf.window * 0.5)) hitQuality = "good";
        else hitQuality = "bad";
    }

    applySwingResult(hitQuality);
}

function applySwingResult(quality) {
    let pName = players[currentPlayerIndex];
    let floatText = "";
    let floatColor = "#a9b1d6";

    if (mode === "points") {
        pitchesThrown++;
        if (quality === "miss") {
            floatText = "0 pts"; floatColor = "#f7768e";
            logEvent("Swung and missed.");
        } else {
            let pts = quality === "perfect" ? 100 : (quality === "good" ? 50 : 25);
            scores[pName] += pts;
            floatText = `+${pts} pts!`; floatColor = "#9ece6a";
            logEvent(`Hit the ball for ${pts} points.`);
        }
    } else {
        // Runs mode
        if (quality === "miss") {
            strikes++;
            floatText = "STRIKE!"; floatColor = "#f7768e";
            logEvent("Struck out.");
        } else {
            let basesHit = quality === "perfect" ? 4 : (quality === "good" ? 2 : 1);
            let runText = ["Single", "Double", "Triple", "HOME RUN"];
            floatText = runText[basesHit - 1] + "!";
            floatColor = basesHit === 4 ? "#bb9af7" : "#9ece6a";
            
            let runsScored = advanceBases(basesHit);
            if (runsScored > 0) floatText += ` (+${runsScored} Run!)`;
            logEvent(`Hit a ${runText[basesHit - 1]}, scoring ${runsScored} runs.`);
        }
    }

    statusText.innerText = floatText;
    statusText.style.color = floatColor;
    showFloatResult(floatText, floatColor);
    
    updateStats();
    updateScoreboard();

    // Check Turn End
    setTimeout(() => {
        if (mode === "points" && pitchesThrown >= MAX_PITCHES) {
            endTurn();
        } else if (mode === "runs" && strikes >= MAX_STRIKES) {
            logEvent(`Struck out entirely.`);
            endTurn();
        } else {
            btnPitch.disabled = false;
        }
    }, 1500);
}

function advanceBases(amount) {
    let runsScored = 0;
    // Move existing runners
    for (let i = 2; i >= 0; i--) {
        if (bases[i]) {
            if (i + amount >= 3) runsScored++;
            else bases[i + amount] = true;
            bases[i] = false;
        }
    }
    // Place Batter
    if (amount === 4) runsScored++;
    else if (amount > 0) bases[amount - 1] = true;

    scores[players[currentPlayerIndex]] += runsScored;
    updateBasesUI();
    return runsScored;
}

function showFloatResult(text, color) {
    const el = document.createElement("div");
    el.className = "float-result";
    el.innerText = text;
    el.style.color = color;
    el.style.top = "50%";
    arena.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// =====================================
// TURN MANAGEMENT
// =====================================
function endTurn() {
    let pName = players[currentPlayerIndex];
    statusText.innerText = `${pName}'s turn is over!`;
    statusText.style.color = "#a9b1d6";
    
    // If user finishes set in points mode, let them push
    if (mode === "points" && pName === "{{user}}") {
        btnMidPush.style.display = "block";
    }

    setTimeout(() => {
        currentPlayerIndex++;
        btnMidPush.style.display = "none";
        startPlayerTurn();
    }, 2500);
}

function simulateAITurn(name) {
    statusText.innerText = `${name} is batting...`;
    
    // Math based simulation
    // Easy difficulty for player means pitcher is easy, but for AI we simulate them hitting decently well
    let hitChance = 0.5; 
    
    if (mode === "points") {
        for(let i=0; i<MAX_PITCHES; i++) {
            if (Math.random() < hitChance) {
                let pts = Math.random() < 0.2 ? 100 : (Math.random() < 0.5 ? 50 : 25);
                scores[name] += pts;
                logEvent(`Hit for ${pts} points.`);
            } else {
                logEvent(`Missed pitch.`);
            }
        }
    } else {
        let aiStrikes = 0;
        let aiBases = [false, false, false];
        while (aiStrikes < MAX_STRIKES) {
            if (Math.random() < hitChance) {
                let q = Math.random();
                let amt = q < 0.1 ? 4 : (q < 0.3 ? 2 : 1); // 10% HR, 20% double, 70% single
                
                // Advance AI Bases inline
                let r = 0;
                for (let b = 2; b >= 0; b--) {
                    if (aiBases[b]) {
                        if (b + amt >= 3) r++;
                        else aiBases[b + amt] = true;
                        aiBases[b] = false;
                    }
                }
                if (amt === 4) r++;
                else aiBases[amt-1] = true;
                
                scores[name] += r;
                logEvent(`Hit for ${amt} bases. Runs scored: ${r}`);
            } else {
                aiStrikes++;
                logEvent(`Struck out.`);
            }
        }
    }

    setTimeout(() => {
        updateScoreboard();
        endTurn();
    }, 2000); // Fake delay to watch scoreboard jump
}

// =====================================
// PUSH LOGIC & ENDGAME
// =====================================
btnMidPush.addEventListener("click", () => {
    let pName = players[currentPlayerIndex];
    let modeLabel = mode === "points" ? "Points" : "Runs";
    let output = `\`${pName} is currently batting. Score: ${scores[pName]} ${modeLabel}\`\n<Status: ${statsLine.innerText}>\n`;
    
    // Add recent logs
    let recentLogs = eventLog.filter(l => l.includes(`[${pName}]`)).slice(-3).map(l => l.replace(`[${pName}] `, '- '));
    output += recentLogs.join("\n");
    
    STBridge.sendMessage(output);
});

function endGame() {
    gameView.style.display = "none";
    arenaPanel.style.display = "none";
    endView.style.display = "block";
}

btnPushFinal.addEventListener("click", () => {
    let modeLabel = mode === "points" ? "Points" : "Runs";
    
    // Determine winner
    let maxScore = -1;
    let winners = [];
    let losers = [];

    for (let p in scores) {
        if (scores[p] > maxScore) {
            maxScore = scores[p];
            winners = [p];
        } else if (scores[p] === maxScore) {
            winners.push(p);
        }
    }

    for (let p in scores) {
        if (!winners.includes(p)) losers.push(p);
    }

    let resultString = `\`Batting Cage Game Complete! (${modeLabel} Mode, ${difficulty} Difficulty)\`\n`;
    resultString += `**Final Scores:**\n`;
    for (let p in scores) {
        resultString += `- ${p}: ${scores[p]}\n`;
    }
    
    if (winners.length > 1) {
        resultString += `\n\`It's a Tie between ${winners.join(" and ")}!\``;
    } else {
        resultString += `\n\`${winners[0]} is the Winner!\``;
    }

    let customRp = document.getElementById("end-rp-text").value.trim();
    if (customRp) resultString += `\n\n${customRp}`;

    STBridge.sendMessage(resultString, { winners, losers });
    
    // Return to setup
    endView.style.display = "none";
    setupView.style.display = "block";
});

btnRestart.addEventListener("click", () => {
    endView.style.display = "none";
    setupView.style.display = "block";
});