// DOM Elements - Setup
const numNamedInput = document.getElementById("num-named");
const nameSlotsContainer = document.getElementById("name-slots-container");
const gameModeSelect = document.getElementById("game-mode");
const btnStart = document.getElementById("btn-start");

// DOM Elements - Game UI
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const activeModeBadge = document.getElementById("active-mode-badge");
const playerListUI = document.getElementById("player-list-ui");
const btnNextTurn = document.getElementById("btn-next-turn");
const btnEndGame = document.getElementById("btn-end-game");
const turnRpText = document.getElementById("turn-rp-text"); // NEW DOM ELEMENT

// Game State
let participants = [];
let currentIndex = 0;
let currentMode = "asker";

// ==========================================
// 1. DYNAMIC LOBBY SETUP
// ==========================================
function generateNameSlots() {
    const count = parseInt(numNamedInput.value) || 0;
    nameSlotsContainer.innerHTML = ""; 

    for (let i = 1; i <= count; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "text-input player-name-input";
        
        if (i === 1) {
            input.value = "{{user}}"; // Default first player
        } else {
            input.placeholder = `Player ${i} Name`;
        }
        
        nameSlotsContainer.appendChild(input);
    }
}

window.addEventListener("DOMContentLoaded", generateNameSlots);
numNamedInput.addEventListener("input", generateNameSlots);

// ==========================================
// 2. LOCKING IN & STARTING
// ==========================================
btnStart.addEventListener("click", () => {
    const nameInputs = document.querySelectorAll(".player-name-input");
    participants = [];
    
    nameInputs.forEach((input, index) => {
        let name = input.value.trim();
        if (!name) name = `Player ${index + 1}`; 
        participants.push(name);
    });

    if (participants.length < 2) {
        alert("You need at least 2 people to play!");
        return;
    }

    // Lock in state
    currentMode = gameModeSelect.value;
    currentIndex = 0; // Start with the first person on the list

    // Update UI Badge
    if (currentMode === "asker") {
        activeModeBadge.innerText = "Current Turn: ASKING someone";
    } else {
        activeModeBadge.innerText = "Current Turn: RECEIVING a request";
    }

    // Render the list and swap panels
    renderPlayerList();
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    
    // Automatically push the FIRST turn so the LLM knows the game has started
    pushTurnToSillyTavern();
});

// ==========================================
// 3. GAMEPLAY LOOP
// ==========================================
function renderPlayerList() {
    playerListUI.innerHTML = ""; // Clear existing

    participants.forEach((name, index) => {
        const li = document.createElement("li");
        li.className = "player-item";
        if (index === currentIndex) {
            li.className += " active";
            li.innerHTML = `▶ ${name}`; // Add a little arrow for the active player
        } else {
            li.innerText = name;
        }
        playerListUI.appendChild(li);
    });
}

function pushTurnToSillyTavern() {
    const activePlayer = participants[currentIndex];
    let tagString = "";

    // Format the hidden tag based on the chosen mode
    if (currentMode === "asker") {
        tagString = `<It is now ${activePlayer}'s turn to ask someone else truth or dare.>`;
    } else {
        tagString = `<It is now ${activePlayer}'s turn to receive a truth or dare request from the other players.>`;
    }

    // APPEND THE USER'S ROLEPLAY TEXT IF IT EXISTS
    const userRp = turnRpText.value.trim();
    if (userRp) {
        tagString += `\n${userRp}`;
    }

    // Push to the chat
    STBridge.sendMessage(tagString);
    
    // Clear out the box for the next turn
    turnRpText.value = "";
}

btnNextTurn.addEventListener("click", () => {
    // Advance the index, looping back to 0 if we hit the end
    currentIndex++;
    if (currentIndex >= participants.length) {
        currentIndex = 0;
    }

    // Update the UI
    renderPlayerList();

    // Push the new turn to the LLM (and grab any text the user typed)
    pushTurnToSillyTavern();
});

// ==========================================
// 4. ENDING / EDITING
// ==========================================
btnEndGame.addEventListener("click", () => {
    // Return to the setup screen, keeping the names intact
    gamePanel.style.display = "none";
    setupPanel.style.display = "block";
});