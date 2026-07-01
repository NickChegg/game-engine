// DOM - Left Panel (Players)
const numPlayersInput = document.getElementById("num-players");
const playerListContainer = document.getElementById("player-list-container");
const btnRandomizeNames = document.getElementById("btn-randomize-names");
const rpTextOrder = document.getElementById("rp-text-order");
const btnPushOrder = document.getElementById("btn-push-order");
const setupPlayersSection = document.getElementById("setup-players-section");
const activePlayersSection = document.getElementById("active-players-section");
const activePlayerDropdown = document.getElementById("active-player-dropdown");

// DOM - Right Panel (Setup)
const setupGameSection = document.getElementById("setup-game-section");
const gameModeSelect = document.getElementById("game-mode");
const standardInputs = document.getElementById("standard-inputs");
const customInputs = document.getElementById("custom-inputs");
const customListContainer = document.getElementById("custom-list-container");
const btnAddCustom = document.getElementById("btn-add-custom");
const btnStart = document.getElementById("btn-start");

// DOM - Right Panel (Game)
const activeGameSection = document.getElementById("active-game-section");
const spacesLeftUi = document.getElementById("spaces-left-ui");
const btnTakeChance = document.getElementById("btn-take-chance");
const resultBox = document.getElementById("result-box");
const resultText = document.getElementById("result-text");
const rpTextAction = document.getElementById("rp-text-action");
const btnPushAction = document.getElementById("btn-push-action");
const btnResetGame = document.getElementById("btn-reset-game");

// Game State
let players = [];
let gameChambers = []; // Array of strings representing outcomes
let lastResultOutcome = "";
let lastResultType = ""; // 'safe', 'danger', 'custom'

// ==========================================
// 1. NON-DESTRUCTIVE DOM RENDERING
// ==========================================

// Players
function renderPlayerSlots() {
    let targetCount = parseInt(numPlayersInput.value) || 1;
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
window.addEventListener("DOMContentLoaded", renderPlayerSlots);

// Custom Outcomes
let customOutcomeCount = 2; // Start with 2 default rows
function renderCustomSlots() {
    let currentCount = customListContainer.children.length;
    
    if (currentCount < customOutcomeCount) {
        for (let i = currentCount; i < customOutcomeCount; i++) {
            let row = document.createElement("div");
            row.className = "flex-row";
            row.innerHTML = `
                <input type="text" class="text-input c-text" placeholder="Outcome (e.g. Wasabi)" style="flex: 2;">
                <input type="number" class="num-input c-qty" value="1" min="1" style="flex: 1;" title="Quantity">
                <button class="btn-small c-del" style="background:#f7768e;">X</button>
            `;
            
            row.querySelector(".c-del").addEventListener("click", () => {
                row.remove();
                customOutcomeCount--;
            });
            
            customListContainer.appendChild(row);
        }
    }
}
btnAddCustom.addEventListener("click", () => {
    customOutcomeCount++;
    renderCustomSlots();
});
window.addEventListener("DOMContentLoaded", renderCustomSlots);

// Toggle Modes
gameModeSelect.addEventListener("change", () => {
    if (gameModeSelect.value === "standard") {
        standardInputs.style.display = "block";
        customInputs.style.display = "none";
    } else {
        standardInputs.style.display = "none";
        customInputs.style.display = "block";
    }
});


// ==========================================
// 2. TURN ORDER UTILITIES
// ==========================================
btnRandomizeNames.addEventListener("click", () => {
    let inputs = Array.from(document.querySelectorAll(".p-name"));
    let vals = inputs.map(i => i.value);
    
    for (let i = vals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    
    inputs.forEach((inp, idx) => inp.value = vals[idx]);
});

btnPushOrder.addEventListener("click", () => {
    let names = Array.from(document.querySelectorAll(".p-name")).map(i => i.value.trim()).filter(v => v);
    if (names.length < 1) return;
    
    let pushStr = `<The turn order for this game is: ${names.join(", ")}>`;
    const userRp = rpTextOrder.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    rpTextOrder.value = "";
});


// ==========================================
// 3. START GAME
// ==========================================
btnStart.addEventListener("click", () => {
    // Gather Players
    players = Array.from(document.querySelectorAll(".p-name")).map(i => i.value.trim() || "Unknown");
    
    activePlayerDropdown.innerHTML = "";
    players.forEach((p, idx) => {
        let opt = document.createElement("option");
        opt.value = idx;
        opt.innerText = p;
        activePlayerDropdown.appendChild(opt);
    });

    // Gather Chambers
    gameChambers = [];
    if (gameModeSelect.value === "standard") {
        let total = parseInt(document.getElementById("std-total").value) || 6;
        let danger = parseInt(document.getElementById("std-danger").value) || 1;
        
        for (let i = 0; i < total; i++) {
            if (i < danger) gameChambers.push("danger");
            else gameChambers.push("safe");
        }
    } else {
        let rows = document.querySelectorAll("#custom-list-container .flex-row");
        rows.forEach(row => {
            let txt = row.querySelector(".c-text").value.trim() || "Mystery Outcome";
            let qty = parseInt(row.querySelector(".c-qty").value) || 1;
            for (let i = 0; i < qty; i++) {
                gameChambers.push(txt);
            }
        });
    }
    
    if (gameChambers.length === 0) return alert("You must have at least 1 outcome slot!");

    // Shuffle Chambers Array
    for (let i = gameChambers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameChambers[i], gameChambers[j]] = [gameChambers[j], gameChambers[i]];
    }
    
    // Update UI
    spacesLeftUi.innerText = gameChambers.length;
    resultBox.style.display = "none";
    btnTakeChance.disabled = false;
    
    setupGameSection.style.display = "none";
    activeGameSection.style.display = "block";
    setupPlayersSection.style.display = "none";
    activePlayersSection.style.display = "block";
});


// ==========================================
// 4. PLAYING THE GAME
// ==========================================
btnTakeChance.addEventListener("click", () => {
    if (gameChambers.length === 0) return;
    
    // Select Active Player
    let activePlayer = players[parseInt(activePlayerDropdown.value)];
    
    // "Pull the trigger" (Remove 1 outcome)
    let outcome = gameChambers.pop();
    spacesLeftUi.innerText = gameChambers.length;
    
    // Format Display
    resultText.className = "text-center";
    lastResultOutcome = outcome;
    
    if (gameModeSelect.value === "standard") {
        if (outcome === "safe") {
            resultText.innerText = `${activePlayer} is Safe!`;
            resultText.classList.add("result-safe");
            lastResultType = "safe";
        } else {
            resultText.innerText = `${activePlayer} LOSES!`;
            resultText.classList.add("result-danger");
            lastResultType = "danger";
        }
    } else {
        resultText.innerText = `${activePlayer} got: ${outcome}`;
        resultText.classList.add("result-custom");
        lastResultType = "custom";
    }
    
    btnTakeChance.disabled = true; // Disable until pushed
    resultBox.style.display = "block";
});

// ==========================================
// 5. PUSH RESULTS & ADVANCE
// ==========================================
btnPushAction.addEventListener("click", () => {
    let activePlayer = players[parseInt(activePlayerDropdown.value)];
    let pushStr = "";
    let stripPayload = null; // Important! Null unless it's a danger loss
    
    if (lastResultType === "safe") {
        pushStr = `\`Nothing happened! ${activePlayer} is safe!\``;
    } else if (lastResultType === "danger") {
        pushStr = `\`${activePlayer} Loses!\``;
        stripPayload = { losers: [activePlayer] }; // Trigger Strip Dashboard!
    } else {
        pushStr = `\`${activePlayer} got a [${lastResultOutcome}]\``;
    }
    
    const userRp = rpTextAction.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr, stripPayload);
    
    // Advance Player Selection visually for the next turn
    let nextIdx = (parseInt(activePlayerDropdown.value) + 1) % players.length;
    activePlayerDropdown.value = nextIdx;
    
    // Reset UI for next pull
    rpTextAction.value = "";
    resultBox.style.display = "none";
    
    if (gameChambers.length > 0) {
        btnTakeChance.disabled = false;
    } else {
        alert("The chambers are empty! Reset the game to play again.");
    }
});

btnResetGame.addEventListener("click", () => {
    activeGameSection.style.display = "none";
    activePlayersSection.style.display = "none";
    setupGameSection.style.display = "block";
    setupPlayersSection.style.display = "block";
});