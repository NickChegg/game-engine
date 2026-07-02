// DOM Elements - Left Panel
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const numPlayersInput = document.getElementById("num-players");
const playerListContainer = document.getElementById("player-list-container");
const outcomesListContainer = document.getElementById("outcomes-list-container");
const btnAddOutcome = document.getElementById("btn-add-outcome");
const btnStart = document.getElementById("btn-start");
const btnReconfig = document.getElementById("btn-reconfig");

const turnIndicator = document.getElementById("turn-indicator");
const rpTextTurn = document.getElementById("rp-text-turn");
const btnPushTurn = document.getElementById("btn-push-turn");

// DOM Elements - Right Panel
const arena = document.getElementById("arena");
const bottle = document.getElementById("bottle");
const btnSpin = document.getElementById("btn-spin");
const resultBox = document.getElementById("result-box");
const resultText = document.getElementById("result-text");
const rpTextResult = document.getElementById("rp-text-result");
const btnPushResult = document.getElementById("btn-push-result");

// State
let players = [];
let outcomes = [];
let turnIndex = 0;
let currentRotation = 0;
let isSpinning = false;
let currentTargetName = "";
let currentOutcome = "";

const defaultOutcomes = ["Hug", "Kiss", "7 Minutes in Heaven", "Strip", "Truth", "Dare", "Slap"];

// ==========================================
// 1. SETUP: NON-DESTRUCTIVE DOM RENDERING
// ==========================================
function renderPlayerSlots() {
    let targetCount = parseInt(numPlayersInput.value) || 2;
    let currentCount = playerListContainer.children.length;
    
    if (currentCount < targetCount) {
        for (let i = currentCount; i < targetCount; i++) {
            let input = document.createElement("input");
            input.type = "text";
            input.className = "text-input p-name";
            if (i === 0) input.value = "{{user}}";
            else input.placeholder = `Player ${i+1}`;
            playerListContainer.appendChild(input);
        }
    } else if (currentCount > targetCount) {
        for (let i = currentCount; i > targetCount; i--) {
            playerListContainer.removeChild(playerListContainer.lastChild);
        }
    }
}
numPlayersInput.addEventListener("input", renderPlayerSlots);

function initOutcomes() {
    outcomesListContainer.innerHTML = "";
    defaultOutcomes.forEach(out => addOutcomeSlot(out));
}

function addOutcomeSlot(val = "") {
    let row = document.createElement("div");
    row.className = "flex-row";
    row.innerHTML = `
        <input type="text" class="text-input o-text" value="${val}" placeholder="Outcome...">
        <button class="btn-small o-del" style="background:#f7768e;">X</button>
    `;
    row.querySelector(".o-del").addEventListener("click", () => row.remove());
    outcomesListContainer.appendChild(row);
}
btnAddOutcome.addEventListener("click", () => addOutcomeSlot(""));

window.addEventListener("DOMContentLoaded", () => {
    renderPlayerSlots();
    initOutcomes();
});

// ==========================================
// 2. GAME INITIALIZATION & ARENA DRAWING
// ==========================================
btnStart.addEventListener("click", () => {
    // Gather Data
    players = Array.from(document.querySelectorAll(".p-name")).map(i => i.value.trim() || "Unknown");
    outcomes = Array.from(document.querySelectorAll(".o-text")).map(i => i.value.trim()).filter(v => v);
    
    if (players.length < 2) return alert("You need at least 2 players!");
    if (outcomes.length < 1) return alert("You need at least 1 outcome!");
    
    turnIndex = 0;
    
    drawArena();
    updateTurnUI();
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    btnSpin.style.display = "block";
    resultBox.style.display = "none";
});

function drawArena() {
    // Remove existing name tags
    document.querySelectorAll(".sb-name-tag").forEach(el => el.remove());
    
    let radius = 130; // Distance from center
    let cx = 160;     // Center X of arena
    let cy = 160;     // Center Y of arena
    let angleStep = 360 / players.length;
    
    players.forEach((name, i) => {
        // -90 degrees because 0 degrees in standard trig is RIGHT, but bottle rotation 0 is UP.
        let angleDeg = (i * angleStep) - 90; 
        let angleRad = angleDeg * (Math.PI / 180);
        
        let x = cx + radius * Math.cos(angleRad);
        let y = cy + radius * Math.sin(angleRad);
        
        let tag = document.createElement("div");
        tag.className = "sb-name-tag";
        tag.id = `tag-${i}`;
        tag.innerText = name;
        tag.style.left = `${x}px`;
        tag.style.top = `${y}px`;
        
        arena.appendChild(tag);
    });
}

function updateTurnUI() {
    turnIndicator.innerHTML = `<span style="color:white;">Current Spinner:</span><br><span style="font-size:1.3em;">${players[turnIndex]}</span>`;
}

btnReconfig.addEventListener("click", () => {
    gameControlsPhase.style.display = "none";
    btnSpin.style.display = "none";
    resultBox.style.display = "none";
    setupPhase.style.display = "block";
});

// ==========================================
// 3. SPINNING LOGIC
// ==========================================
btnSpin.addEventListener("click", () => {
    if (isSpinning) return;
    isSpinning = true;
    btnSpin.disabled = true;
    resultBox.style.display = "none";
    
    // Clear old highlights
    document.querySelectorAll(".sb-name-tag").forEach(el => el.classList.remove("active-target"));
    
    // Pick Target (Must NOT be the spinner)
    let validTargets = players.map((p, i) => ({name: p, index: i})).filter(obj => obj.index !== turnIndex);
    let chosenTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    
    currentTargetName = chosenTarget.name;
    currentOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    // Calculate rotation
    let angleStep = 360 / players.length;
    let targetAngle = chosenTarget.index * angleStep;
    
    // Add random jitter within the slice so it looks organic
    let jitter = (Math.random() * (angleStep * 0.8)) - (angleStep * 0.4);
    
    // 5 full spins (1800 deg) + needed angle
    let baseSpins = Math.floor(currentRotation / 360) * 360 + 1800;
    let finalRotation = baseSpins + targetAngle + jitter;
    
    // Apply Spin
    bottle.style.transform = `rotate(${finalRotation}deg)`;
    currentRotation = finalRotation;
    
    // Wait for animation
    setTimeout(() => {
        isSpinning = false;
        btnSpin.disabled = false;
        
        // Highlight name
        document.getElementById(`tag-${chosenTarget.index}`).classList.add("active-target");
        
        // Show result
        resultText.innerHTML = `<span style="color:white;">Lands on:</span> ${currentTargetName}<br><span style="color:white; font-size:0.7em;">Outcome:</span> ${currentOutcome}`;
        resultBox.style.display = "block";
        
    }, 4000);
});

// ==========================================
// 4. PUSHING MESSAGES
// ==========================================
btnPushTurn.addEventListener("click", () => {
    let pushStr = `<It is ${players[turnIndex]}'s turn to spin the bottle.>`;
    const userRp = rpTextTurn.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    rpTextTurn.value = "";
});

btnPushResult.addEventListener("click", () => {
    let spinner = players[turnIndex];
    let pushStr = `\`${spinner} spins the bottle and it lands on ${currentTargetName}! ${currentOutcome} time!\``;
    
    const userRp = rpTextResult.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    // Check for Strip Mode Hook (case insensitive)
    let payload = null;
    if (currentOutcome.toLowerCase().includes("strip")) {
        payload = { losers: [currentTargetName] };
    }
    
    STBridge.sendMessage(pushStr, payload);
    
    // Clean up & Advance Turn
    rpTextResult.value = "";
    resultBox.style.display = "none";
    document.querySelectorAll(".sb-name-tag").forEach(el => el.classList.remove("active-target"));
    
    turnIndex = (turnIndex + 1) % players.length;
    updateTurnUI();
});