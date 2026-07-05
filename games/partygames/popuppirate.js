// DOM Elements
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");

const playerCountSelect = document.getElementById("player-count");
const p3Group = document.getElementById("p3-group");
const p4Group = document.getElementById("p4-group");

const statusHeader = document.getElementById("status-header");
const btnMidPush = document.getElementById("btn-mid-push"); 
const midRpText = document.getElementById("mid-rp-text"); // NEW DOM Element
const slotsContainer = document.getElementById("slots-container");
const rowTop = document.getElementById("row-top");
const rowBot = document.getElementById("row-bot");

const flyingPirate = document.getElementById("flying-pirate");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnRetry = document.getElementById("btn-retry");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Game State
let players = [];
let currentPlayerIndex = 0;
let triggerSlot = -1;
let slots = []; // Boolean array of 24 (true = filled)
let gameActive = false;
let finalLoserName = "";

// Dynamic Form
playerCountSelect.addEventListener("change", (e) => {
    let count = parseInt(e.target.value);
    p3Group.style.display = count >= 3 ? "block" : "none";
    p4Group.style.display = count >= 4 ? "block" : "none";
});

// ==========================================
// 1. GAME SETUP
// ==========================================
btnStart.addEventListener("click", () => {
    let pCount = parseInt(playerCountSelect.value);
    
    // Setup Players (Yellow, Green, Red, Blue)
    players = [{ name: "{{user}}", color: "#e0af68", isUser: true }]; 
    
    const opponentColors = ["#9ece6a", "#f7768e", "#7aa2f7"]; 
    for (let i = 1; i < pCount; i++) {
        let nameField = document.getElementById(`p${i+1}-name`).value.trim();
        let finalName = nameField ? nameField : `Opponent ${i}`;
        players.push({ name: finalName, color: opponentColors[i-1], isUser: false });
    }

    // Randomize initial turn order
    players = players.sort(() => Math.random() - 0.5);

    // Pick the secret trigger slot (0 to 23)
    triggerSlot = Math.floor(Math.random() * 24);
    slots = new Array(24).fill(false);
    currentPlayerIndex = 0;
    gameActive = true;
    
    // Reset visuals and inputs
    flyingPirate.classList.remove("popped");
    midRpText.value = "";
    renderBoard();
    nextTurn();
    
    setupPanel.style.display = "none";
    endGamePanel.style.display = "none";
    gamePanel.style.display = "block";
});

function renderBoard() {
    rowTop.innerHTML = "";
    rowBot.innerHTML = "";
    
    for (let i = 0; i < 24; i++) {
        const slot = document.createElement("div");
        slot.className = "pup-slot";
        slot.dataset.id = i;
        
        slot.addEventListener("click", () => handleSlotClick(i));
        
        if (i < 12) rowTop.appendChild(slot);
        else rowBot.appendChild(slot);
    }
}

// ==========================================
// NEW: MID-GAME PUSH WITH TEXT
// ==========================================
btnMidPush.addEventListener("click", () => {
    if (!gameActive) return;
    const p = players[currentPlayerIndex];
    const slotsLeft = 24 - slots.filter(s => s).length;
    
    // Format the system status string
    let midGameMsg = `\`There are ${slotsLeft} slots left in the barrel. It is currently ${p.name}'s turn to push a knife.\``;
    
    // Grab and append user roleplay
    const midRp = midRpText.value.trim();
    if (midRp) {
        midGameMsg += `\n${midRp}`;
    }
    
    // Push directly to chat (no game result object since nobody has lost yet)
    STBridge.sendMessage(midGameMsg);
    
    // Clear the text box after pushing
    midRpText.value = "";
});

// ==========================================
// 2. TURN LOGIC
// ==========================================
function handleSlotClick(index) {
    if (!gameActive) return;
    if (slots[index]) return; // Already picked
    
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer.isUser) return; // Prevent clicking during AI turn
    
    processMove(index);
}

function processMove(index) {
    const currentPlayer = players[currentPlayerIndex];
    slots[index] = true;
    
    // Visually fill the slot
    const slotEl = document.querySelector(`.pup-slot[data-id='${index}']`);
    slotEl.classList.add("filled");
    slotEl.style.backgroundColor = currentPlayer.color;
    slotEl.style.boxShadow = `0 0 10px ${currentPlayer.color}, inset 0 2px 5px rgba(0,0,0,0.5)`;

    // Check if they popped the pirate!
    if (index === triggerSlot) {
        triggerGameOver(currentPlayer);
        return;
    }

    // Pass turn
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    nextTurn();
}

function nextTurn() {
    const p = players[currentPlayerIndex];
    const slotsLeft = 24 - slots.filter(s => s).length;
    
    statusHeader.innerHTML = `Slots Left: ${slotsLeft} <br> Turn: <span style="color: ${p.color};">${p.name}</span>`;

    if (!p.isUser) {
        slotsContainer.classList.add("disabled"); 
        btnMidPush.disabled = true; // Prevent pushing state while AI is thinking
        statusHeader.innerHTML += " (Thinking...)";
        
        setTimeout(() => {
            let availableMoves = slots.map((val, idx) => val === false ? idx : null).filter(val => val !== null);
            let chosenMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
            processMove(chosenMove);
        }, 800 + Math.random() * 800); 
    } else {
        slotsContainer.classList.remove("disabled"); 
        btnMidPush.disabled = false;
    }
}

// ==========================================
// 3. GAME OVER & REPORTING
// ==========================================
function triggerGameOver(loser) {
    gameActive = false;
    finalLoserName = loser.name; 
    
    endStats.innerHTML = `<span style="color: ${loser.color}; font-weight: bold;">${loser.name} popped up the pirate!</span>`;
    
    setTimeout(() => {
        gamePanel.style.display = "none";
        endGamePanel.style.display = "block";
        
        setTimeout(() => {
            flyingPirate.classList.add("popped");
        }, 100);
    }, 600);
}

btnRetry.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    let resultString = `\`${finalLoserName} popped up the pirate!\``;

    const userRp = endRpText.value.trim();
    if (userRp) resultString += `\n${userRp}`;

    // Pass { losers: [] } so the Bridge hook automatically strips them
    STBridge.sendMessage(resultString, { losers: [finalLoserName] });

    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});