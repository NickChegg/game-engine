// DOM - Panels
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const battlePhase = document.getElementById("battle-phase");
const revealPhase = document.getElementById("reveal-phase");
const endPhase = document.getElementById("end-phase");

// DOM - Setup
const playerCountInput = document.getElementById("player-count");
const playerSettingsContainer = document.getElementById("player-settings-container");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

// DOM - Game
const turnIndicator = document.getElementById("turn-indicator");
const currentBidDisplay = document.getElementById("current-bid-display");
const opponentArea = document.getElementById("opponent-area");
const userArea = document.getElementById("user-area");
const actionControls = document.getElementById("action-controls");
const bidQty = document.getElementById("bid-qty");
const bidFace = document.getElementById("bid-face");
const btnMakeBid = document.getElementById("btn-make-bid");
const btnCallLiar = document.getElementById("btn-call-liar");

// DOM - RP
const midgameRpArea = document.getElementById("midgame-rp-area");
const midgameRpText = document.getElementById("midgame-rp-text");
const btnPushMidgame = document.getElementById("btn-push-midgame");

// DOM - Reveal
const revealTitle = document.getElementById("reveal-title");
const revealTable = document.getElementById("reveal-table");
const revealResultText = document.getElementById("reveal-result-text");
const revealRpText = document.getElementById("reveal-rp-text");
const btnPushReveal = document.getElementById("btn-push-reveal");
const btnReturnMenu = document.getElementById("btn-return-menu");

// Settings
const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const STARTING_DICE = 5;

const diffConfigs = {
    "easy": { name: "Easy", optimalChance: 0.40 },
    "medium": { name: "Medium", optimalChance: 0.70 },
    "hard": { name: "Hard", optimalChance: 0.90 }
};

let players = [];
let activePlayerIndex = 0;
let currentBid = null; // { playerIndex, qty, face }
let totalDiceInPlay = 0;

let revealState = null; // Stores data needed for the ST push when a challenge occurs

// ==========================================
// 1. SETUP UI (NON-DESTRUCTIVE RENDERING)
// ==========================================
playerCountInput.addEventListener("input", generateSetupRows);
playerCountInput.addEventListener("change", generateSetupRows);

function generateSetupRows() {
    let count = parseInt(playerCountInput.value);
    
    // Fallbacks to prevent invalid or dangerous inputs
    if (isNaN(count) || count < 2) count = 2;
    if (count > 20) count = 20; 
    
    let currentCount = playerSettingsContainer.children.length;
    
    // Add new slots if count increased
    if (currentCount < count) {
        for (let i = currentCount; i < count; i++) {
            let isUser = i === 0;
            let pColor = isUser ? "#7aa2f7" : "#f7768e";
            
            let card = document.createElement("div");
            card.className = "setup-card";
            card.style.borderLeftColor = pColor;
            
            let html = `
                <div class="input-group" style="margin-bottom: ${isUser ? '0' : '10px'};">
                    <label class="input-label" style="color: ${pColor};">Player ${i+1} ${isUser ? '(You)' : ''}</label>
                    <input type="text" id="p${i}-name" class="text-input" value="${isUser ? '{{user}}' : 'Player ' + (i+1)}">
                </div>
            `;
            
            if (!isUser) {
                html += `
                <div class="input-group" style="margin-bottom: 0;">
                    <label class="input-label">Difficulty</label>
                    <select id="p${i}-diff" class="select-input">
                        <option value="easy">Easy</option>
                        <option value="medium" selected>Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>`;
            }
            
            card.innerHTML = html;
            playerSettingsContainer.appendChild(card);
        }
    } 
    // Remove extra slots from the end if count decreased
    else if (currentCount > count) {
        for (let i = currentCount; i > count; i--) {
            playerSettingsContainer.removeChild(playerSettingsContainer.lastChild);
        }
    }
}

// Init rows on load
generateSetupRows();

btnStart.addEventListener("click", () => {
    let count = parseInt(playerCountInput.value);
    if (isNaN(count) || count < 2) count = 2;
    
    players = [];
    
    for (let i = 0; i < count; i++) {
        let nameField = document.getElementById(`p${i}-name`);
        let name = nameField ? nameField.value.trim() : `Player ${i+1}`;
        if (!name) name = `Player ${i+1}`;
        
        let isUser = i === 0;
        let diffField = document.getElementById(`p${i}-diff`);
        let diff = isUser ? null : (diffField ? diffConfigs[diffField.value] : diffConfigs["medium"]);
        
        players.push({
            id: i,
            name: name,
            isUser: isUser,
            diff: diff,
            diceCount: STARTING_DICE,
            dice: [],
            eliminated: false
        });
    }
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    battlePhase.style.display = "block";
    
    activePlayerIndex = Math.floor(Math.random() * players.length); // Random start
    startRound();
});

btnRestart.addEventListener("click", () => location.reload());
btnReturnMenu.addEventListener("click", () => window.location.href = "index.html");

// ==========================================
// 2. ROUND LOGIC
// ==========================================
function startRound() {
    currentBid = null;
    currentBidDisplay.innerText = "Waiting for first bid...";
    btnCallLiar.disabled = true;
    
    totalDiceInPlay = 0;
    
    players.forEach(p => {
        if (!p.eliminated) {
            p.dice = [];
            for (let i=0; i < p.diceCount; i++) {
                p.dice.push(Math.floor(Math.random() * 6) + 1);
            }
            p.dice.sort((a,b) => a-b);
            totalDiceInPlay += p.diceCount;
        }
    });
    
    updateBoard();
    processTurn();
}

function updateBoard() {
    opponentArea.innerHTML = "";
    userArea.innerHTML = "";
    
    players.forEach(p => {
        if (p.eliminated) return;
        
        let handDiv = document.createElement("div");
        handDiv.className = "player-hand";
        
        let nameTitle = document.createElement("div");
        nameTitle.className = "player-name";
        nameTitle.innerText = `${p.name} (${p.diceCount} Dice)`;
        handDiv.appendChild(nameTitle);
        
        if (p.isUser) {
            nameTitle.style.color = "#7aa2f7";
            p.dice.forEach(val => {
                let d = document.createElement("div");
                d.className = "die";
                d.innerText = DIE_FACES[val];
                handDiv.appendChild(d);
            });
            userArea.appendChild(handDiv);
        } else {
            nameTitle.style.color = "#f7768e";
            for(let i=0; i<p.diceCount; i++) {
                let d = document.createElement("div");
                d.className = "die die-hidden";
                d.innerText = "?";
                handDiv.appendChild(d);
            }
            opponentArea.appendChild(handDiv);
        }
    });

    if (currentBid) {
        let b = players[currentBid.playerIndex];
        currentBidDisplay.innerHTML = `<span style="color: #a9b1d6;">${b.name} bid:</span> ${currentBid.qty} of ${DIE_FACES[currentBid.face]}`;
    }
}

function getNextPlayer(currentIndex) {
    let next = (currentIndex + 1) % players.length;
    while (players[next].eliminated) {
        next = (next + 1) % players.length;
    }
    return next;
}

// ==========================================
// 3. TURN LOGIC
// ==========================================
function processTurn() {
    let p = players[activePlayerIndex];
    turnIndicator.innerText = `${p.name}'s Turn`;
    turnIndicator.style.color = p.isUser ? "#7aa2f7" : "#f7768e";
    
    if (p.isUser) {
        actionControls.style.display = "block";
        midgameRpArea.style.display = "block";
        
        // Setup valid inputs
        if (currentBid) {
            btnCallLiar.disabled = false;
            bidQty.min = currentBid.qty;
            if (parseInt(bidQty.value) < currentBid.qty) bidQty.value = currentBid.qty;
        } else {
            btnCallLiar.disabled = true;
            bidQty.min = 1;
        }
    } else {
        actionControls.style.display = "none";
        midgameRpArea.style.display = "none";
        
        setTimeout(aiTurn, 1500); // 1.5s thinking delay
    }
}

// User Actions
bidQty.addEventListener("change", validateBidInput);
bidFace.addEventListener("change", validateBidInput);

function validateBidInput() {
    if (!currentBid) return;
    let q = parseInt(bidQty.value);
    let f = parseInt(bidFace.value);
    
    // If quantity is the same as current bid, face must be strictly higher
    if (q === currentBid.qty) {
        if (f <= currentBid.face) {
            bidFace.value = currentBid.face < 6 ? currentBid.face + 1 : 6;
            if (currentBid.face === 6) bidQty.value = currentBid.qty + 1; // force quantity up if face is maxed
        }
    }
}

btnMakeBid.addEventListener("click", () => {
    let q = parseInt(bidQty.value);
    let f = parseInt(bidFace.value);
    
    if (currentBid) {
        if (q < currentBid.qty) return;
        if (q === currentBid.qty && f <= currentBid.face) return;
    }
    
    executeBid(q, f);
});

btnCallLiar.addEventListener("click", () => {
    executeChallenge();
});

function executeBid(qty, face) {
    currentBid = { playerIndex: activePlayerIndex, qty, face };
    activePlayerIndex = getNextPlayer(activePlayerIndex);
    updateBoard();
    processTurn();
}

// ==========================================
// 4. AI LOGIC
// ==========================================
function aiTurn() {
    let ai = players[activePlayerIndex];
    let unknownDice = totalDiceInPlay - ai.diceCount;
    
    // Evaluate if should challenge
    if (currentBid) {
        let myFaceCount = ai.dice.filter(d => d === currentBid.face).length;
        let expectedFromOthers = unknownDice / 6.0;
        let expectedTotal = myFaceCount + expectedFromOthers;
        
        let threshold = 0.5; // Baseline threshold
        if (Math.random() > ai.diff.optimalChance) {
            // AI makes a mistake (varies threshold wildly)
            threshold = (Math.random() * 3) - 1.5; 
        }
        
        if (currentBid.qty > expectedTotal + threshold) {
            executeChallenge();
            return;
        }
    }
    
    // Decide on a bid to make
    let bestFace = 1;
    let maxCount = -1;
    
    // Count AI's own dice to find what it has most of
    let counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0};
    ai.dice.forEach(d => counts[d]++);
    
    for (let f = 6; f >= 1; f--) {
        if (counts[f] > maxCount) {
            maxCount = counts[f];
            bestFace = f;
        }
    }
    
    let targetQty = 1;
    let targetFace = bestFace;
    
    if (currentBid) {
        // Must raise
        if (bestFace > currentBid.face) {
            targetQty = currentBid.qty;
            targetFace = bestFace;
        } else {
            targetQty = currentBid.qty + 1;
            targetFace = bestFace;
        }
        
        // Random sub-optimal play: bid something completely random
        if (Math.random() > ai.diff.optimalChance) {
            targetFace = Math.floor(Math.random() * 6) + 1;
            targetQty = targetFace > currentBid.face ? currentBid.qty : currentBid.qty + 1;
        }
    } else {
        targetQty = Math.max(1, maxCount);
    }
    
    executeBid(targetQty, targetFace);
}

// ==========================================
// 5. CHALLENGES & REVEALS
// ==========================================
function executeChallenge() {
    battlePhase.style.display = "none";
    gameControlsPhase.style.display = "none";
    revealPhase.style.display = "block";
    
    let challenger = players[activePlayerIndex];
    let bidder = players[currentBid.playerIndex];
    
    revealTitle.innerText = `${challenger.name} calls Liar on ${bidder.name}!`;
    
    // Count all dice on table
    let faceToMatch = currentBid.face;
    let totalFound = 0;
    
    revealTable.innerHTML = "";
    players.forEach(p => {
        if (p.eliminated) return;
        
        let handDiv = document.createElement("div");
        handDiv.className = "player-hand";
        handDiv.innerHTML = `<div class="player-name">${p.name}</div>`;
        
        p.dice.forEach(val => {
            let d = document.createElement("div");
            d.className = "die";
            d.innerText = DIE_FACES[val];
            if (val === faceToMatch) {
                totalFound++;
                d.style.backgroundColor = "#9ece6a"; // Highlight matches
            }
            handDiv.appendChild(d);
        });
        revealTable.appendChild(handDiv);
    });
    
    let wasLying = totalFound < currentBid.qty;
    let loser = wasLying ? bidder : challenger;
    let winner = wasLying ? challenger : bidder;
    
    let resText = `Bid was ${currentBid.qty} of ${DIE_FACES[faceToMatch]}. There were exactly ${totalFound}.<br>`;
    resText += `<span style="color: ${wasLying ? '#9ece6a' : '#f7768e'};">`;
    resText += wasLying ? `${challenger.name} was CORRECT!` : `${challenger.name} was WRONG!`;
    resText += `</span><br><br>${loser.name} loses a die!`;
    
    revealResultText.innerHTML = resText;
    
    // Pre-calculate what happens next
    loser.diceCount--;
    let isEliminated = loser.diceCount <= 0;
    if (isEliminated) loser.eliminated = true;
    
    // We will start next round with the loser, or the person after if they were eliminated
    activePlayerIndex = loser.id;
    if (loser.eliminated) {
        activePlayerIndex = getNextPlayer(loser.id);
    }
    
    // Store data for push
    revealState = {
        challenger: challenger.name,
        bidder: bidder.name,
        wasCorrect: wasLying,
        loser: loser,
        isEliminated: isEliminated
    };
}

// ==========================================
// 6. ST PUSHES & RP LOGIC
// ==========================================

// Pushing a Mid-Game State (User Turn)
btnPushMidgame.addEventListener("click", () => {
    let pushStr = ``;
    
    if (currentBid) {
        let b = players[currentBid.playerIndex];
        pushStr += `The current bid is ${currentBid.qty} of face ${currentBid.face}, made by ${b.name}.\n`;
    } else {
        pushStr += `A new round has started. There is no bid yet.\n`;
    }
    
    pushStr += `It is currently {{user}}'s turn.\n\n[Table State]`;
    players.forEach(p => {
        if (!p.eliminated) {
            pushStr += `\n- ${p.name}: ${p.diceCount} dice remaining.`;
        }
    });
    
    let userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

// Pushing a Challenge Reveal Result
btnPushReveal.addEventListener("click", () => {
    let r = revealState;
    let pushStr = `\`*${r.challenger} called ${r.bidder}'s bluff!*\`\n`;
    pushStr += `They were ${r.wasCorrect ? 'correct' : 'incorrect'}! ${r.loser.name} lost the challenge and loses a die.`;
    
    let stripPayload = null;
    if (r.isEliminated) {
        pushStr += `\n\n**${r.loser.name} has lost their last die and is eliminated from the game!**`;
        stripPayload = { losers: [r.loser.name] };
    }
    
    let userRp = revealRpText.value.trim();
    if (userRp) pushStr += `\n\n${userRp}`;
    
    STBridge.sendMessage(pushStr, stripPayload);
    
    revealRpText.value = "";
    revealState = null;
    
    // Check if game is over
    let remaining = players.filter(p => !p.eliminated);
    if (remaining.length === 1) {
        triggerEndGame(remaining[0]);
    } else {
        revealPhase.style.display = "none";
        gameControlsPhase.style.display = "block";
        battlePhase.style.display = "block";
        startRound();
    }
});

function triggerEndGame(winner) {
    revealPhase.style.display = "none";
    endPhase.style.display = "block";
    endStats.innerHTML = `<span style="color: #9ece6a;">${winner.name} is the last player standing and wins Liar's Dice!</span>`;
    
    // Single push declaring overall winner (optional, since each elimination handles the strip hook already)
    STBridge.sendMessage(`\`${winner.name} won the game of Liar's Dice!\``);
}