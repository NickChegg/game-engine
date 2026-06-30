// DOM Elements - Left Panel (Players)
const numRollers = document.getElementById("num-rollers");
const rollerSlotsContainer = document.getElementById("roller-slots-container");
const btnLockRollers = document.getElementById("btn-lock-rollers");
const playerSetupMode = document.getElementById("player-setup-mode");
const playerSelectMode = document.getElementById("player-select-mode");
const rollerTogglesContainer = document.getElementById("roller-toggles-container");
const btnEditRollers = document.getElementById("btn-edit-rollers");

// DOM Elements - Inputs
const diceCategory = document.getElementById("dice-category");
const diceCount = document.getElementById("dice-count");

const numericGroup = document.getElementById("numeric-group");
const numericType = document.getElementById("numeric-type");
const customGroup = document.getElementById("custom-group");
const customN = document.getElementById("custom-n");

const specialtyGroup = document.getElementById("specialty-group");
const specialtyType = document.getElementById("specialty-type");
const dicePreview = document.getElementById("dice-preview");

// DOM Elements - Actions & Output
const btnRoll = document.getElementById("btn-roll");
const btnReroll = document.getElementById("btn-reroll");
const resultBox = document.getElementById("result-box");
const rpText = document.getElementById("rp-text");
const btnPush = document.getElementById("btn-push");

// Specialty Dice Data Dictionaries
const specialtyData = {
    "fudge": {
        name: "Fudge Dice",
        faces: ["[+]", "[-]", "[Blank]"],
        preview: "Faces: [+], [-], and [Blank]."
    },
    "scatter": {
        name: "Scatter Dice",
        faces: ["🎯 Hit", "🎯 Hit", "⬆️ Arrow (North)", "➡️ Arrow (East)", "⬇️ Arrow (South)", "⬅️ Arrow (West)"],
        preview: "Faces: 2 Hits, 4 Directional Arrows."
    },
    "poker": {
        name: "Poker Dice",
        faces: ["Ace", "King", "Queen", "Jack", "Ten", "Nine"],
        preview: "Faces: 9, 10, J, Q, K, A."
    },
    "boggle": {
        name: "Letter Dice",
        faces: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"],
        preview: "Faces: Random letters of the alphabet A-Z."
    },
    "adult": {
        name: "Action & Body Dice",
        actions: ["Kiss", "Lick", "Bite", "Suck", "Touch", "Massage", "Grind"],
        bodyParts: ["Lips", "Neck", "Thigh", "Ear", "Chest", "Stomach", "Ass", "Genitals"],
        preview: "Rolls a pair. Action (Kiss, Bite...) + Body Part (Neck, Lips...)."
    }
};

// Current State
let lastResultString = "";
let currentRoller = "{{user}}"; // Defaults to the macro

// ==========================================
// 1. LEFT PANEL: PLAYER SELECTOR
// ==========================================
function generateRollerSlots() {
    let targetCount = parseInt(numRollers.value) || 1;
    if (targetCount > 15) targetCount = 15;
    let currentCount = rollerSlotsContainer.children.length;
    
    if (currentCount < targetCount) {
        for (let i = currentCount + 1; i <= targetCount; i++) {
            let input = document.createElement("input");
            input.type = "text";
            input.className = "text-input roller-name-input";
            if (i === 1) input.value = "{{user}}";
            else input.placeholder = `Character ${i} Name`;
            rollerSlotsContainer.appendChild(input);
        }
    } else if (currentCount > targetCount) {
        for (let i = currentCount; i > targetCount; i--) {
            rollerSlotsContainer.removeChild(rollerSlotsContainer.lastChild);
        }
    }
}
numRollers.addEventListener("input", generateRollerSlots);
window.addEventListener("DOMContentLoaded", generateRollerSlots);

btnLockRollers.addEventListener("click", () => {
    const inputs = document.querySelectorAll(".roller-name-input");
    rollerTogglesContainer.innerHTML = "";
    let isFirst = true;
    
    inputs.forEach((input, index) => {
        let name = input.value.trim() || `Character ${index + 1}`;
        
        let btn = document.createElement("button");
        btn.className = "roller-toggle";
        btn.innerText = name;
        
        // Handle toggling visual state
        btn.onclick = () => {
            document.querySelectorAll(".roller-toggle").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentRoller = name; // Update the global roller state!
        };
        
        // Auto-select the first person on the list
        if (isFirst) {
            btn.classList.add("active");
            currentRoller = name;
            isFirst = false;
        }
        
        rollerTogglesContainer.appendChild(btn);
    });
    
    playerSetupMode.style.display = "none";
    playerSelectMode.style.display = "block";
});

btnEditRollers.addEventListener("click", () => {
    // Reveal the inputs again to fix typos or add members
    playerSelectMode.style.display = "none";
    playerSetupMode.style.display = "block";
});

// ==========================================
// 2. UI TOGGLES & PREVIEWS (Main Panel)
// ==========================================
function updateUI() {
    const isNumeric = diceCategory.value === "numeric";
    
    numericGroup.style.display = isNumeric ? "block" : "none";
    specialtyGroup.style.display = isNumeric ? "none" : "block";
    
    if (isNumeric && numericType.value === "custom") {
        customGroup.style.display = "block";
    } else {
        customGroup.style.display = "none";
    }
    
    if (isNumeric) {
        dicePreview.innerText = "";
    } else {
        const sType = specialtyType.value;
        dicePreview.innerText = specialtyData[sType].preview;
    }
}
diceCategory.addEventListener("change", updateUI);
numericType.addEventListener("change", updateUI);
specialtyType.addEventListener("change", updateUI);
window.addEventListener("DOMContentLoaded", updateUI);

// ==========================================
// 3. ROLLING LOGIC
// ==========================================
function rollDice() {
    let count = parseInt(diceCount.value) || 1;
    if (count < 1) count = 1;
    if (count > 500) count = 500; 
    
    const isNumeric = diceCategory.value === "numeric";
    let rollArray = [];
    let rollSum = 0;
    
    if (isNumeric) {
        let sides = 6;
        if (numericType.value === "custom") {
            sides = parseInt(customN.value) || 2;
        } else {
            sides = parseInt(numericType.value);
        }
        
        for (let i = 0; i < count; i++) {
            let roll = Math.floor(Math.random() * sides) + 1;
            rollArray.push(roll);
            rollSum += roll;
        }
        
        let dieName = `d${sides}`;
        resultBox.innerHTML = `
            <div class="dice-sum">${rollSum}</div>
            <div class="dice-list">Rolled ${count}${dieName}:<br>${rollArray.join(", ")}</div>
        `;
        
        // Build the string dynamically using currentRoller
        lastResultString = `\`${currentRoller} rolled ${count}${dieName}: ${rollArray.join(", ")}. (Total: ${rollSum})\``;
        
    } else {
        const sType = specialtyType.value;
        const data = specialtyData[sType];
        
        for (let i = 0; i < count; i++) {
            if (sType === "adult") {
                let a = data.actions[Math.floor(Math.random() * data.actions.length)];
                let b = data.bodyParts[Math.floor(Math.random() * data.bodyParts.length)];
                rollArray.push(`[${a} + ${b}]`);
            } else {
                let face = data.faces[Math.floor(Math.random() * data.faces.length)];
                rollArray.push(face);
            }
        }
        
        resultBox.innerHTML = `
            <div class="dice-sum" style="color: #a9b1d6; font-size: 1.5em; margin-bottom: 15px;">${data.name}</div>
            <div class="dice-list" style="color: var(--accent); font-weight: bold;">${rollArray.join("<br>")}</div>
        `;
        
        let grammarCount = count === 1 ? "1 die" : `${count} dice`;
        // Build the string dynamically using currentRoller
        lastResultString = `\`${currentRoller} rolled ${grammarCount} (${data.name}): ${rollArray.join(", ")}\``;
    }

    btnReroll.disabled = false;
    btnPush.disabled = false;
}

btnRoll.addEventListener("click", rollDice);
btnReroll.addEventListener("click", rollDice);

// ==========================================
// 4. PUSH TO SILLYTAVERN
// ==========================================
btnPush.addEventListener("click", () => {
    let output = lastResultString;
    
    const userRp = rpText.value.trim();
    if (userRp) {
        output += `\n${userRp}`;
    }

    STBridge.sendMessage(output);
    rpText.value = "";
});