// DOM Elements - Setup
const numNamedInput = document.getElementById("num-named");
const nameSlotsContainer = document.getElementById("name-slots-container");
const numOthersInput = document.getElementById("num-others");
const btnDraw = document.getElementById("btn-draw");

// DOM Elements - End Screen
const setupPanel = document.getElementById("setup-panel");
const endGamePanel = document.getElementById("end-game-panel");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Store the final outcome to push to ST later
let finalResultString = ""; 
let currentLoserName = ""; // FIX: We declare this globally so the confirm button remembers it!

// ==========================================
// 1. DYNAMIC LOBBY SETUP
// ==========================================
function generateNameSlots() {
    const targetCount = parseInt(numNamedInput.value) || 0;
    const currentCount = nameSlotsContainer.children.length;

    if (currentCount < targetCount) {
        for (let i = currentCount + 1; i <= targetCount; i++) {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "text-input player-name-input";
            
            if (i === 1) input.value = "{{user}}";
            else input.placeholder = `Character ${i} Name`;
            
            nameSlotsContainer.appendChild(input);
        }
    } else if (currentCount > targetCount) {
        for (let i = currentCount; i > targetCount; i--) {
            nameSlotsContainer.removeChild(nameSlotsContainer.lastChild);
        }
    }
}

// Generate slots on initial load, and whenever the number changes
window.addEventListener("DOMContentLoaded", generateNameSlots);
numNamedInput.addEventListener("input", generateNameSlots);


// ==========================================
// 2. THE DRAW LOGIC
// ==========================================
btnDraw.addEventListener("click", () => {
    // 1. Gather all named participants
    const nameInputs = document.querySelectorAll(".player-name-input");
    let participants = [];
    
    nameInputs.forEach((input, index) => {
        let name = input.value.trim();
        if (!name) name = `Unknown Player ${index + 1}`; // Fallback if left blank
        participants.push(name);
    });

    // 2. Gather "Others"
    const othersCount = parseInt(numOthersInput.value) || 0;
    for (let i = 1; i <= othersCount; i++) {
        participants.push(`an unnamed person`);
    }

    // 3. Validation
    const total = participants.length;
    if (total < 2) {
        alert("You need at least 2 people to draw straws!");
        return;
    }

    // 4. Do the Draw
    const loserIndex = Math.floor(Math.random() * total);
    
    // FIX: Save the name to our global variable
    currentLoserName = participants[loserIndex];

    // 5. Format the UI Display
    endStats.innerHTML = `Total participants: <b>${total}</b><br><br>
                          <span style="color: #f7768e; font-size: 1.2em; font-weight: bold;">
                          ${currentLoserName} drew the short straw!
                          </span>`;

    // 6. Format the SillyTavern Chat String
    finalResultString = `\`The group drew straws. Out of ${total} people, everyone drew a long straw except for ${currentLoserName}, who drew the short straw!\``;

    // 7. Swap Panels
    setupPanel.style.display = "none";
    endGamePanel.style.display = "block";
});


// ==========================================
// 3. END GAME / BACK OUT LOGIC
// ==========================================
btnCancelEnd.addEventListener("click", () => {
    // Return to setup if they want a do-over (e.g. they realized they forgot someone)
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    // Attach the player's custom Roleplay text
    const userRp = endRpText.value.trim();
    if (userRp) {
        finalResultString += `\n${userRp}`;
    }

    // Push to ST chat using our bridge, passing the globally stored loser name
    STBridge.sendMessage(finalResultString, { losers: [currentLoserName] });

    // Reset the UI for the next round instead of going back to the menu
    endRpText.value = ""; // Clear out the RP response box
    endGamePanel.style.display = "none"; // Hide end screen
    setupPanel.style.display = "block"; // Show setup panel (names are preserved!)
});