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
        actions: ["Kiss", "Lick", "Bite", "Suck", "Touch", "Massage"],
        bodyParts: ["Lips", "Neck", "Thigh", "Ear", "Chest", "Stomach"],
        preview: "Rolls a pair. Action (Kiss, Bite...) + Body Part (Neck, Lips...)."
    }
};

// Current State
let lastResultString = "";

// ==========================================
// 1. UI TOGGLES & PREVIEWS
// ==========================================
function updateUI() {
    const isNumeric = diceCategory.value === "numeric";
    
    // Toggle main groups
    numericGroup.style.display = isNumeric ? "block" : "none";
    specialtyGroup.style.display = isNumeric ? "none" : "block";
    
    // Toggle Custom N input
    if (isNumeric && numericType.value === "custom") {
        customGroup.style.display = "block";
    } else {
        customGroup.style.display = "none";
    }
    
    // Update Preview Text
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
// 2. ROLLING LOGIC
// ==========================================
function rollDice() {
    let count = parseInt(diceCount.value) || 1;
    if (count < 1) count = 1;
    if (count > 500) count = 500; // Hard limit for safety
    
    const isNumeric = diceCategory.value === "numeric";
    
    let rollArray = [];
    let rollSum = 0;
    
    if (isNumeric) {
        // NUMERIC ROLLS
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
        
        // Format Result Display
        let dieName = `d${sides}`;
        resultBox.innerHTML = `
            <div class="dice-sum">${rollSum}</div>
            <div class="dice-list">Rolled ${count}${dieName}:<br>${rollArray.join(", ")}</div>
        `;
        
        // Format ST String
        lastResultString = `\`{{user}} rolled ${count}${dieName}: ${rollArray.join(", ")}. (Total: ${rollSum})\``;
        
    } else {
        // SPECIALTY ROLLS
        const sType = specialtyType.value;
        const data = specialtyData[sType];
        
        for (let i = 0; i < count; i++) {
            if (sType === "adult") {
                // Adult dice requires two arrays
                let a = data.actions[Math.floor(Math.random() * data.actions.length)];
                let b = data.bodyParts[Math.floor(Math.random() * data.bodyParts.length)];
                rollArray.push(`[${a} + ${b}]`);
            } else {
                // Standard single array
                let face = data.faces[Math.floor(Math.random() * data.faces.length)];
                rollArray.push(face);
            }
        }
        
        // Format Result Display
        resultBox.innerHTML = `
            <div class="dice-sum" style="color: #a9b1d6; font-size: 1.5em; margin-bottom: 15px;">${data.name}</div>
            <div class="dice-list" style="color: var(--accent); font-weight: bold;">${rollArray.join("<br>")}</div>
        `;
        
        // Format ST String
        let grammarCount = count === 1 ? "1 die" : `${count} dice`;
        lastResultString = `\`{{user}} rolled ${grammarCount} (${data.name}): ${rollArray.join(", ")}\``;
    }

    // Enable push and reroll buttons
    btnReroll.disabled = false;
    btnPush.disabled = false;
}

btnRoll.addEventListener("click", rollDice);
btnReroll.addEventListener("click", rollDice);

// ==========================================
// 3. PUSH TO SILLYTAVERN
// ==========================================
btnPush.addEventListener("click", () => {
    let output = lastResultString;
    
    const userRp = rpText.value.trim();
    if (userRp) {
        output += `\n${userRp}`;
    }

    STBridge.sendMessage(output);
    
    // Clear out roleplay text after push
    rpText.value = "";
});