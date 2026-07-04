// DOM - Setup
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const arenaPhase = document.getElementById("arena-phase");
const endPhase = document.getElementById("end-phase");

const partnerNameInput = document.getElementById("partner-name");
const btnStart = document.getElementById("btn-start");
const btnEndGame = document.getElementById("btn-end-game");
const btnPushEnd = document.getElementById("btn-push-end");

const arena = document.getElementById("arena");
const customActionInput = document.getElementById("custom-action");
const btnNpcAct = document.getElementById("btn-npc-act");
const actionLog = document.getElementById("action-log");

const punishmentTarget = document.getElementById("punishment-target");
const endRpText = document.getElementById("end-rp-text");

// DOM - Modal
const actionModal = document.getElementById("action-modal");
const modalActionText = document.getElementById("modal-action-text");
const modalRpText = document.getElementById("modal-rp-text");
const btnModalConfirm = document.getElementById("btn-modal-confirm");
const btnModalCancel = document.getElementById("btn-modal-cancel");

// Game State
let partnerName = "The Partner";
let activeGrid = [];
let debugMode = false; // Set to true to visibly see the hitboxes
let pendingAction = { str: "", logClass: "" };

// Body part list for NPC randomizer
const allBodyParts = ["face", "chest", "stomach", "crotch", "hips", "thighs", "arms", "hands", "mouth", "neck"];
const npcVerbs = ["touched", "kissed", "pinched", "caressed", "grabbed", "stroked", "licked", "rubbed against"];

/* 
   MESH GRIDS (Hitboxes in Percentages: x, y, width, height)
*/
const gridLayouts = [
    // 1. Standard Standing
    [
        { name: "face", x: 40, y: 10, w: 20, h: 15 },
        { name: "neck", x: 45, y: 25, w: 10, h: 5 },
        { name: "chest", x: 35, y: 30, w: 30, h: 15 },
        { name: "arms", x: 20, y: 30, w: 15, h: 35 }, 
        { name: "arms", x: 65, y: 30, w: 15, h: 35 }, 
        { name: "stomach", x: 38, y: 45, w: 24, h: 15 },
        { name: "hands", x: 15, y: 65, w: 15, h: 10 }, 
        { name: "hands", x: 70, y: 65, w: 15, h: 10 }, 
        { name: "crotch", x: 42, y: 60, w: 16, h: 12 },
        { name: "thighs", x: 35, y: 72, w: 30, h: 28 }
    ],
    // 2. Kneeling / Sitting Up
    [
        { name: "hands", x: 25, y: 25, w: 15, h: 15 }, 
        { name: "hands", x: 60, y: 25, w: 15, h: 15 }, 
        { name: "face", x: 40, y: 15, w: 20, h: 20 },
        { name: "neck", x: 45, y: 35, w: 10, h: 5 },
        { name: "chest", x: 35, y: 40, w: 30, h: 15 },
        { name: "arms", x: 25, y: 40, w: 10, h: 25 },
        { name: "arms", x: 65, y: 40, w: 10, h: 25 },
        { name: "stomach", x: 35, y: 55, w: 30, h: 15 },
        { name: "hips", x: 30, y: 70, w: 40, h: 15 },
        { name: "crotch", x: 42, y: 75, w: 16, h: 10 },
        { name: "thighs", x: 25, y: 85, w: 50, h: 15 }
    ],
    // 3. Leaning Back / Reclining
    [
        { name: "face", x: 20, y: 10, w: 25, h: 20 },
        { name: "neck", x: 28, y: 30, w: 10, h: 8 },
        { name: "chest", x: 25, y: 38, w: 30, h: 20 },
        { name: "arms", x: 10, y: 38, w: 15, h: 40 },
        { name: "stomach", x: 35, y: 58, w: 25, h: 15 },
        { name: "hands", x: 25, y: 75, w: 15, h: 15 },
        { name: "crotch", x: 45, y: 73, w: 20, h: 15 },
        { name: "thighs", x: 50, y: 80, w: 45, h: 20 }
    ]
];

// ==========================================
// 1. INITIALIZATION
// ==========================================
btnStart.addEventListener("click", () => {
    partnerName = partnerNameInput.value.trim() || "The Partner";
    
    // Pick a random grid layout
    let randGridIdx = Math.floor(Math.random() * gridLayouts.length);
    activeGrid = gridLayouts[randGridIdx];
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";

    logToConsole(`You step into the dark closet with ${partnerName}...`, "log-wall");

    // Optional: Draw debug hitboxes
    arena.innerHTML = "";
    if (debugMode) {
        activeGrid.forEach(box => {
            let div = document.createElement("div");
            div.className = "debug-hitbox";
            div.style.left = `${box.x}%`;
            div.style.top = `${box.y}%`;
            div.style.width = `${box.w}%`;
            div.style.height = `${box.h}%`;
            div.style.display = "flex";
            div.innerText = box.name;
            arena.appendChild(div);
        });
    }
});

// ==========================================
// 2. GAME MECHANICS
// ==========================================
function logToConsole(msg, className) {
    let div = document.createElement("div");
    div.innerHTML = `<span class="${className}">${msg}</span>`;
    actionLog.appendChild(div);
    actionLog.scrollTop = actionLog.scrollHeight;
}

function getSelectedVerb() {
    let custom = customActionInput.value.trim();
    if (custom) {
        customActionInput.value = ""; 
        return custom;
    }
    let checked = document.querySelector('input[name="user-action"]:checked');
    return checked ? checked.value : "touched";
}

function requestActionPush(actionStr, logClass) {
    pendingAction.str = actionStr;
    pendingAction.logClass = logClass;
    
    modalActionText.innerText = actionStr;
    modalRpText.value = "";
    
    actionModal.style.display = "flex";
}

// User Clicks the Arena
arena.addEventListener("click", (e) => {
    // Calculate X/Y Percentages
    let rect = arena.getBoundingClientRect();
    let clickX = ((e.clientX - rect.left) / rect.width) * 100;
    let clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Collision Detection
    let hitPart = "the wall"; 
    
    for (let i = activeGrid.length - 1; i >= 0; i--) {
        let b = activeGrid[i];
        if (clickX >= b.x && clickX <= (b.x + b.w) && clickY >= b.y && clickY <= (b.y + b.h)) {
            hitPart = `${partnerName}'s ${b.name}`;
            break;
        }
    }

    let verb = getSelectedVerb();
    let pushString = `\`{{user}} ${verb} ${hitPart} in the pitch-black room.\``;
    let logClass = hitPart === "the wall" ? "log-wall" : "log-user";
    
    // Show Modal Instead of Pushing Immediately
    requestActionPush(pushString, logClass);
});

// NPC Action Button
btnNpcAct.addEventListener("click", () => {
    let randVerb = npcVerbs[Math.floor(Math.random() * npcVerbs.length)];
    
    let target = "the wall";
    if (Math.random() < 0.8) {
        let randPart = allBodyParts[Math.floor(Math.random() * allBodyParts.length)];
        target = `{{user}}'s ${randPart}`;
    }

    let pushString = `\`${partnerName} ${randVerb} ${target} in the pitch-black room.\``;
    let logClass = target === "the wall" ? "log-wall" : "log-npc";
    
    // Show Modal Instead of Pushing Immediately
    requestActionPush(pushString, logClass);
});

// ==========================================
// 3. MODAL LOGIC (Push or Cancel)
// ==========================================
btnModalCancel.addEventListener("click", () => {
    actionModal.style.display = "none";
});

btnModalConfirm.addEventListener("click", () => {
    let finalStr = pendingAction.str;
    let rp = modalRpText.value.trim();
    
    if (rp) {
        finalStr += `\n${rp}`;
    }

    logToConsole(finalStr, pendingAction.logClass);
    STBridge.sendMessage(finalStr);

    actionModal.style.display = "none";
});

// ==========================================
// 4. END GAME & STRIP HOOKS
// ==========================================
btnEndGame.addEventListener("click", () => {
    gameControlsPhase.style.display = "none";
    arenaPhase.style.display = "none";
    endPhase.style.display = "block";
});

btnPushEnd.addEventListener("click", () => {
    let pushStr = `\`The 7 minutes are up. You and ${partnerName} exit the closet.\``;
    const rp = endRpText.value.trim();
    if (rp) pushStr += `\n${rp}`;

    // Strip Punishment Resolution
    let gameResult = null;
    let target = punishmentTarget.value;
    
    if (target === "user") {
        gameResult = { losers: ["{{user}}"] };
    } else if (target === "partner") {
        gameResult = { losers: [partnerName] };
    }

    // Fire to the Bridge!
    STBridge.sendMessage(pushStr, gameResult);
    
    // Reset UI
    endRpText.value = "";
    punishmentTarget.value = "none";
    actionLog.innerHTML = "";
    customActionInput.value = "";
    
    endPhase.style.display = "none";
    arenaPhase.style.display = "block"; 
    setupPhase.style.display = "block";
});