// DOM - Setup
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");

// DOM - Game Board
const gamePanel = document.getElementById("game-panel");
const arena = document.getElementById("arena");
const donkeyImg = document.getElementById("donkey-img");
const tailImg = document.getElementById("tail-img");
const targetMarker = document.getElementById("target-marker");
const turnBadge = document.getElementById("turn-badge");
const resultMessage = document.getElementById("result-message");
const btnNextTurn = document.getElementById("btn-next-turn");

// DOM - End Screen
const endGamePanel = document.getElementById("end-game-panel");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");

// Game State
let players = [];
let turnIndex = 0;
let donkeyFlipped = false;
let donkeyX = 0;
let donkeyY = 0;

// Estimated Target coordinates relative to the donkey image
// Adjust these percentages if the tail doesn't snap to the exact spot on your specific image
const targetRelativeX = 0.88; // 88% across the image (rear)
const targetRelativeY = 0.40; // 40% down the image

// ==========================================
// 1. SETUP UI
// ==========================================
function updateSetupUI() {
    let count = parseInt(numPlayersInput.value) || 2;
    if (count > 8) count = 8;
    if (count < 2) count = 2;
    numPlayersInput.value = count;
    
    let currentCount = playersContainer.children.length;
    
    if (currentCount < count) {
        for (let i = currentCount + 1; i <= count; i++) {
            let row = document.createElement("div");
            row.className = "flex-row";
            row.style.marginBottom = "10px";
            
            let isUserSlot = (i === 1);
            let nameInp = `<input type="text" class="text-input p-name" ${isUserSlot ? 'value="{{user}}" readonly' : `placeholder="Player ${i}"`}>`;
            
            row.innerHTML = `<div style="flex:1;">${nameInp}</div>`;
            playersContainer.appendChild(row);
        }
    } else if (currentCount > count) {
        for (let i = currentCount; i > count; i--) {
            playersContainer.removeChild(playersContainer.lastChild);
        }
    }
}

numPlayersInput.addEventListener("input", updateSetupUI);
window.addEventListener("DOMContentLoaded", updateSetupUI);

// ==========================================
// 2. CORE GAME MECHANICS
// ==========================================
btnStart.addEventListener("click", () => {
    players = [];
    let rows = playersContainer.querySelectorAll(".flex-row");
    rows.forEach((row, idx) => {
        let n = row.querySelector(".p-name").value.trim() || `Player ${idx+1}`;
        players.push({ name: n, isUser: (idx === 0), distance: null });
    });
    
    turnIndex = 0;
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    
    startTurn();
});

function hideArenaElements() {
    donkeyImg.style.opacity = "0";
    tailImg.style.opacity = "0";
    targetMarker.style.opacity = "0";
    resultMessage.innerHTML = "";
    btnNextTurn.style.display = "none";
}

function randomizeDonkey() {
    // 1. Ensure dimensions exist (wait for natural render, or use fixed width)
    let dWidth = donkeyImg.offsetWidth || 250;
    let dHeight = donkeyImg.offsetHeight || 200; // fallback if image not fully loaded yet
    let aWidth = arena.offsetWidth;
    let aHeight = arena.offsetHeight;

    // 2. Randomly flip
    donkeyFlipped = Math.random() < 0.5;
    
    // 3. Randomize Position (Keep it within bounds)
    let maxX = aWidth - dWidth;
    let maxY = aHeight - dHeight;
    donkeyX = Math.floor(Math.random() * Math.max(0, maxX));
    donkeyY = Math.floor(Math.random() * Math.max(0, maxY));
    
    donkeyImg.style.left = donkeyX + "px";
    donkeyImg.style.top = donkeyY + "px";
    donkeyImg.style.transform = donkeyFlipped ? "scaleX(-1)" : "scaleX(1)";
}

function startTurn() {
    hideArenaElements();
    randomizeDonkey();
    
    let p = players[turnIndex];
    turnBadge.innerText = `${p.name}'s Turn`;
    turnBadge.style.color = p.isUser ? "#9ece6a" : "#f7768e";
    
    if (p.isUser) {
        // Enable click event for the user
        arena.onclick = handleUserClick;
    } else {
        // AI acts automatically after a brief delay
        arena.onclick = null;
        setTimeout(handleNPCTurn, 1000);
    }
}

// ==========================================
// 3. PLACEMENT & CALCULATION
// ==========================================
function getTargetAbsoluteCoordinates() {
    let dWidth = donkeyImg.offsetWidth;
    let dHeight = donkeyImg.offsetHeight;

    let adjustedTargetX = donkeyFlipped ? (1 - targetRelativeX) : targetRelativeX;
    
    return {
        x: donkeyX + (adjustedTargetX * dWidth),
        y: donkeyY + (targetRelativeY * dHeight)
    };
}

function placeTailAndCalculate(pinX, pinY) {
    // 1. Move tail to click location
    tailImg.style.left = pinX + "px";
    tailImg.style.top = pinY + "px";
    tailImg.style.transform = donkeyFlipped ? "scaleX(-1)" : "scaleX(1)";

    // 2. Calculate Distance
    let target = getTargetAbsoluteCoordinates();
    
    let dx = pinX - target.x;
    let dy = pinY - target.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    
    // 3. Save Score
    players[turnIndex].distance = Math.round(distance);

    // 4. Visual Reveal
    targetMarker.style.left = target.x + "px";
    targetMarker.style.top = target.y + "px";
    
    donkeyImg.style.opacity = "1";
    tailImg.style.opacity = "1";
    // Optional: show exact target dot
    // targetMarker.style.opacity = "1"; 
    
    // 5. Update UI
    resultMessage.innerHTML = `${players[turnIndex].name} missed by <span style="color: #f7768e;">${players[turnIndex].distance} pixels</span>!`;
    
    btnNextTurn.style.display = "block";
    btnNextTurn.onclick = advanceTurn;
}

function handleUserClick(e) {
    // Calculate click relative to the arena div
    let rect = arena.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    arena.onclick = null; // Disable further clicks this turn
    placeTailAndCalculate(x, y);
}

function handleNPCTurn() {
    let aWidth = arena.offsetWidth;
    let aHeight = arena.offsetHeight;
    
    // NPC clicks literally anywhere on the board blindly
    let randomX = Math.floor(Math.random() * aWidth);
    let randomY = Math.floor(Math.random() * aHeight);
    
    placeTailAndCalculate(randomX, randomY);
}

function advanceTurn() {
    turnIndex++;
    if (turnIndex >= players.length) {
        endGame();
    } else {
        startTurn();
    }
}

// ==========================================
// 4. END GAME & PUSHING
// ==========================================
let finalGameResult = null;
let finalSummaryStr = "";

function endGame() {
    // Sort players by distance (Lowest is best)
    players.sort((a, b) => a.distance - b.distance);
    
    let winner = players[0];
    let losersList = players.filter(p => p.name !== winner.name).map(p => p.name);
    
    finalGameResult = { winners: [winner.name], losers: losersList };
    finalSummaryStr = `\`Pin the Tail on the Donkey is over! ${winner.name} won by placing the tail closest to the target.\``;
    
    // Build Leaderboard HTML
    let statsHTML = `<h3 style="color: #9ece6a; margin-bottom: 15px;">🏆 ${winner.name} Wins!</h3>`;
    
    players.forEach((p, idx) => {
        let isWin = idx === 0;
        let color = isWin ? "#9ece6a" : "#a9b1d6";
        let rank = idx + 1;
        
        statsHTML += `
            <div class="score-row">
                <span style="color: ${color};"><b>#${rank}</b> ${p.name}</span>
                <span style="color: #787c99;">${p.distance} px away</span>
            </div>
        `;
    });
    
    endStats.innerHTML = statsHTML;
    
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
}

// Buttons
btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    let pushStr = finalSummaryStr;
    const userRp = endRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    // Fire to the Bridge!
    STBridge.sendMessage(pushStr, finalGameResult);
    
    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});