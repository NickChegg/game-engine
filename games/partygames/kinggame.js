// DOM Elements - Setup
const numNamedInput = document.getElementById("num-named");
const nameSlotsContainer = document.getElementById("name-slots-container");
const hideResultsToggle = document.getElementById("hide-results-toggle");
const btnDraw = document.getElementById("btn-draw");

// DOM Elements - End Screen
const setupPanel = document.getElementById("setup-panel");
const endGamePanel = document.getElementById("end-game-panel");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Store the final formatted string to push to ST
let finalResultString = ""; 

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
            // We assume the first slot is always the physical User playing
            input.value = "{{user}}";
        } else {
            input.placeholder = `Character ${i} Name`;
        }
        
        nameSlotsContainer.appendChild(input);
    }
}

window.addEventListener("DOMContentLoaded", generateNameSlots);
numNamedInput.addEventListener("input", generateNameSlots);

// Array Shuffling utility (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// ==========================================
// 2. THE DRAW LOGIC
// ==========================================
btnDraw.addEventListener("click", () => {
    const nameInputs = document.querySelectorAll(".player-name-input");
    let participants = [];
    
    nameInputs.forEach((input, index) => {
        let name = input.value.trim();
        if (!name) name = `Player ${index + 1}`; 
        participants.push(name);
    });

    const total = participants.length;
    if (total < 2) {
        alert("You need at least 2 people to play the King Game!");
        return;
    }

    // Generate the sticks: One "King", and the rest are numbers (1 to N-1)
    let sticks = ["the King"];
    for (let i = 1; i < total; i++) {
        sticks.push(`Number ${i}`);
    }

    // Shuffle the sticks array
    shuffleArray(sticks);

    // Map the sticks to the players and build the result log
    let resultsLog = [];
    let userResult = "";
    
    for (let i = 0; i < total; i++) {
        let playerName = participants[i];
        let drawnStick = sticks[i];
        
        resultsLog.push(`${playerName} drew ${drawnStick}`);
        
        // Assuming the first participant slot is the User, grab their stick for the UI
        if (i === 0) {
            userResult = drawnStick;
        }
    }

    const compiledResults = resultsLog.join(", ");

    // 3. Format the SillyTavern Chat String based on the Toggle
    const isHidden = hideResultsToggle.checked;
    
    if (isHidden) {
        // Send as a hidden system tag
        finalResultString = `<The King Game Results: ${compiledResults}.>`;
    } else {
        // Send as a visible backtick string
        finalResultString = `\`The King Game Results: ${compiledResults}.\``;
    }

    // CRITICAL constraint appended on a new line (always invisible)
    finalResultString += `\n<Remember the players do not know each others' results, and shouldn't tell unless their number is announced by the king for the dare>`;

    // 4. Format the UI Display to ONLY show the user's result
    let color = userResult === "the King" ? "#bb9af7" : "#7aa2f7";
    let highlight = userResult === "the King" ? "👑 YOU ARE THE KING!" : `You drew: <b>${userResult}</b>`;

    endStats.innerHTML = `The sticks have been drawn.<br><br>
                          <span style="color: ${color}; font-size: 1.3em;">
                          ${highlight}
                          </span>`;

    // 5. Swap Panels
    setupPanel.style.display = "none";
    endGamePanel.style.display = "block";
});


// ==========================================
// 3. END GAME / BACK OUT LOGIC
// ==========================================
btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    const userRp = endRpText.value.trim();
    if (userRp) {
        // Add the user's text on a new line
        finalResultString += `\n${userRp}`;
    }

    // Push to ST chat
    STBridge.sendMessage(finalResultString);

    // Reset the UI for the next round instead of going back to the menu
    endRpText.value = ""; // Clear out the RP response box
    endGamePanel.style.display = "none"; // Hide end screen
    setupPanel.style.display = "block"; // Show setup panel (names are preserved!)
});