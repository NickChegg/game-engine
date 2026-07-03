// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const winConditionSelect = document.getElementById("win-condition");
const randomizeOrderCheck = document.getElementById("randomize-order");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const turnIndicator = document.getElementById("turn-indicator");
const diceVisual = document.getElementById("dice-visual");
const btnRoll = document.getElementById("btn-roll");
const playerListUI = document.getElementById("player-list-ui");
const actionLog = document.getElementById("action-log");

const arena = document.getElementById("arena");
const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");

// ==========================================
// GAME CONSTANTS & COORDINATES (15x15 GRID)
// ==========================================
const COLORS = [
    { name: "Red", hex: "#d32f2f", offset: 0, yard: [{x:2,y:2}, {x:4,y:2}, {x:2,y:4}, {x:4,y:4}] },
    { name: "Green", hex: "#388e3c", offset: 13, yard: [{x:10,y:2}, {x:12,y:2}, {x:10,y:4}, {x:12,y:4}] },
    { name: "Yellow", hex: "#fbc02d", offset: 26, yard: [{x:10,y:10}, {x:12,y:10}, {x:10,y:12}, {x:12,y:12}] },
    { name: "Blue", hex: "#1976d2", offset: 39, yard: [{x:2,y:10}, {x:4,y:10}, {x:2,y:12}, {x:4,y:12}] }
];

// The 52 squares forming the main track around the board
const TRACK_PATH = [
    {x:1,y:6}, {x:2,y:6}, {x:3,y:6}, {x:4,y:6}, {x:5,y:6}, {x:6,y:5}, {x:6,y:4}, {x:6,y:3}, {x:6,y:2}, {x:6,y:1}, {x:6,y:0},
    {x:7,y:0}, {x:8,y:0}, {x:8,y:1}, {x:8,y:2}, {x:8,y:3}, {x:8,y:4}, {x:8,y:5}, {x:9,y:6}, {x:10,y:6}, {x:11,y:6}, {x:12,y:6}, {x:13,y:6}, {x:14,y:6},
    {x:14,y:7}, {x:14,y:8}, {x:13,y:8}, {x:12,y:8}, {x:11,y:8}, {x:10,y:8}, {x:9,y:8}, {x:8,y:9}, {x:8,y:10}, {x:8,y:11}, {x:8,y:12}, {x:8,y:13}, {x:8,y:14},
    {x:7,y:14}, {x:6,y:14}, {x:6,y:13}, {x:6,y:12}, {x:6,y:11}, {x:6,y:10}, {x:6,y:9}, {x:5,y:8}, {x:4,y:8}, {x:3,y:8}, {x:2,y:8}, {x:1,y:8}, {x:0,y:8},
    {x:0,y:7}, {x:0,y:6}
];

// Home corridors (Relative 51 to 55)
const HOME_PATHS = {
    0: [{x:1,y:7}, {x:2,y:7}, {x:3,y:7}, {x:4,y:7}, {x:5,y:7}], // Red
    1: [{x:7,y:1}, {x:7,y:2}, {x:7,y:3}, {x:7,y:4}, {x:7,y:5}], // Green
    2: [{x:13,y:7}, {x:12,y:7}, {x:11,y:7}, {x:10,y:7}, {x:9,y:7}], // Yellow
    3: [{x:7,y:13}, {x:7,y:12}, {x:7,y:11}, {x:7,y:10}, {x:7,y:9}]  // Blue
};

// Finish Line (Relative 56)
const FINISH_COORD = {x:7,y:7};

const diffConfigs = {
    "easy": { name: "Easy", optimalChance: 0.50 },
    "medium": { name: "Medium", optimalChance: 0.70 },
    "hard": { name: "Hard", optimalChance: 0.90 }
};

// Game State
let players = [];
let activePlayerIdx = 0;
let diceRoll = 0;
let consecutiveSixes = 0;
let gameState = "WAITING_ROLL"; // WAITING_ROLL, WAITING_MOVE
let placeCounter = 1;
let lastPushStr = "Game Started.";

// ==========================================
// 1. SETUP UI
// ==========================================
function renderSetupPlayers() {
    let targetCount = parseInt(numPlayersInput.value) || 2;
    let currentCount = playersContainer.children.length;
    
    if (currentCount < targetCount) {
        for (let i = currentCount; i < targetCount; i++) {
            let row = document.createElement("div");
            row.className = "p-setup-card";
            
            // Default select options (avoid duplicates visually)
            let colorOpts = COLORS.map((c, idx) => `<option value="${idx}" ${i === idx ? 'selected' : ''}>${c.name}</option>`).join("");
            
            row.innerHTML = `
                <div class="flex-row">
                    <div class="input-group" style="flex:2; margin-bottom:0;">
                        <input type="text" class="text-input p-name" ${i === 0 ? 'value="{{user}}"' : `placeholder="Player ${i+1}"`}>
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <select class="select-input p-color">${colorOpts}</select>
                    </div>
                </div>
                <div class="flex-row" style="margin-top: 10px;">
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <select class="select-input p-type">
                            <option value="user">User</option>
                            <option value="ai" ${i !== 0 ? 'selected' : ''}>AI</option>
                        </select>
                    </div>
                    <div class="input-group p-diff-group" style="flex:1; margin-bottom:0; display:${i!==0 ? 'block' : 'none'};">
                        <select class="select-input p-diff">
                            <option value="easy">Easy</option>
                            <option value="medium" selected>Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                </div>
            `;
            
            // Toggle difficulty based on type
            row.querySelector(".p-type").addEventListener("change", function() {
                row.querySelector(".p-diff-group").style.display = this.value === "ai" ? "block" : "none";
            });
            
            playersContainer.appendChild(row);
        }
    } else if (currentCount > targetCount) {
        for (let i = currentCount; i > targetCount; i--) {
            playersContainer.removeChild(playersContainer.lastChild);
        }
    }
}
numPlayersInput.addEventListener("input", renderSetupPlayers);
window.addEventListener("DOMContentLoaded", renderSetupPlayers);

// ==========================================
// 2. INITIALIZATION
// ==========================================
btnStart.addEventListener("click", () => {
    let rows = document.querySelectorAll(".p-setup-card");
    let chosenColors = [];
    
    players = [];
    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let name = row.querySelector(".p-name").value.trim() || `Player ${i+1}`;
        let colIdx = parseInt(row.querySelector(".p-color").value);
        let isUser = row.querySelector(".p-type").value === "user";
        let diffKey = row.querySelector(".p-diff").value;
        
        if (chosenColors.includes(colIdx)) return alert("Each player must have a unique color!");
        chosenColors.push(colIdx);
        
        let pColor = COLORS[colIdx];
        
        let p = {
            id: i, name: name, colorData: pColor,
            isUser: isUser, diff: isUser ? null : diffConfigs[diffKey],
            active: true, place: null,
            tokens: [
                { tId: 0, pos: -1 }, // -1 = Yard, 0-50 = Track, 51-55 = Home Col, 56 = Finish
                { tId: 1, pos: -1 },
                { tId: 2, pos: -1 },
                { tId: 3, pos: -1 }
            ]
        };
        players.push(p);
    }
    
    if (randomizeOrderCheck.checked) {
        players.sort(() => Math.random() - 0.5);
    }
    
    placeCounter = 1;
    activePlayerIdx = 0;
    consecutiveSixes = 0;
    gameState = "WAITING_ROLL";
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    document.querySelector(".main-panel").style.display = "block";
    
    drawBoardTokens();
    updateUI();
});

// ==========================================
// 3. DRAWING THE BOARD
// ==========================================
function getPixelCoords(p, token) {
    if (token.pos === -1) {
        // In Yard
        return { x: p.colorData.yard[token.tId].x, y: p.colorData.yard[token.tId].y };
    } else if (token.pos <= 50) {
        // Main Track
        let globalIndex = (token.pos + p.colorData.offset) % 52;
        return TRACK_PATH[globalIndex];
    } else if (token.pos <= 55) {
        // Home Column (51 maps to index 0)
        let cIdx = players.indexOf(p); // We need the color index in original array
        let originalColorIndex = COLORS.findIndex(c => c.name === p.colorData.name);
        return HOME_PATHS[originalColorIndex][token.pos - 51];
    } else {
        // Finish
        return FINISH_COORD;
    }
}

function drawBoardTokens() {
    arena.innerHTML = "";
    
    players.forEach(p => {
        p.tokens.forEach(t => {
            if (t.pos === 56) return; // Don't draw finished tokens
            
            let coord = getPixelCoords(p, t);
            let tDiv = document.createElement("div");
            tDiv.className = "ludo-token";
            tDiv.id = `token-${p.id}-${t.tId}`;
            tDiv.style.backgroundColor = p.colorData.hex;
            
            // Map 0-14 grid to exact percentages
            tDiv.style.left = `${(coord.x + 0.5) * (100 / 15)}%`;
            tDiv.style.top = `${(coord.y + 0.5) * (100 / 15)}%`;
            
            arena.appendChild(tDiv);
        });
    });
}

function updateUI() {
    let cp = players[activePlayerIdx];
    
    // Turn Indicator
    turnIndicator.innerHTML = `<span style="color:${cp.colorData.hex}">${cp.name}'s Turn</span>`;
    
    // Player List
    playerListUI.innerHTML = "";
    players.forEach((p, i) => {
        let finished = p.tokens.filter(t => t.pos === 56).length;
        let bg = i === activePlayerIdx ? "rgba(255,255,255,0.1)" : "#15161e";
        let bd = i === activePlayerIdx ? `1px solid ${p.colorData.hex}` : "1px solid #24283b";
        
        let rankStr = p.active ? "" : (p.place === 1 ? `<span style="color:#9ece6a">Winner</span>` : `<span style="color:#e0af68">${getOrdinal(p.place)}</span>`);
        
        playerListUI.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px; background:${bg}; border:${bd}; border-radius:8px;">
                <span style="color:${p.colorData.hex}; font-weight:bold;">${p.name} ${rankStr}</span>
                <span style="color:#a9b1d6; font-size:0.9em;">Home: ${finished}/4</span>
            </div>
        `;
    });
    
    // Controls
    if (gameState === "WAITING_ROLL") {
        if (cp.isUser) {
            btnRoll.style.display = "block";
            btnRoll.innerText = "Roll Dice";
            btnRoll.disabled = false;
        } else {
            btnRoll.style.display = "block";
            btnRoll.innerText = `${cp.name} is rolling...`;
            btnRoll.disabled = true;
            setTimeout(executeRoll, 800);
        }
    } else {
        btnRoll.style.display = "none";
    }
}

// ==========================================
// 4. GAME LOGIC & TURN MACHINE
// ==========================================
btnRoll.addEventListener("click", () => {
    if (gameState === "WAITING_ROLL" && players[activePlayerIdx].isUser) {
        executeRoll();
    }
});

function executeRoll() {
    diceRoll = Math.floor(Math.random() * 6) + 1;
    diceVisual.innerText = diceRoll;
    
    let cp = players[activePlayerIdx];
    
    if (diceRoll === 6) {
        consecutiveSixes++;
        if (consecutiveSixes === 3) {
            logAction(`\`${cp.name} rolled a 3rd six and loses their turn!\``);
            consecutiveSixes = 0;
            setTimeout(nextTurn, 1000);
            return;
        }
    } else {
        consecutiveSixes = 0;
    }
    
    let validMoves = getValidMoves(cp, diceRoll);
    
    if (validMoves.length === 0) {
        logAction(`\`${cp.name} rolled a ${diceRoll} but has no valid moves.\``);
        setTimeout(() => {
            if (diceRoll === 6) { gameState = "WAITING_ROLL"; updateUI(); }
            else nextTurn();
        }, 1500);
        return;
    }
    
    gameState = "WAITING_MOVE";
    logAction(`\`${cp.name} rolled a ${diceRoll}.\``);
    
    if (!cp.isUser) {
        setTimeout(() => executeAIMove(cp, validMoves, diceRoll), 800);
    } else {
        if (validMoves.length === 1) {
            // Auto move if only 1 option
            setTimeout(() => executeMove(cp, validMoves[0], diceRoll), 300);
        } else {
            turnIndicator.innerHTML = `Select a token to move!`;
            // Highlight valid tokens for user click
            validMoves.forEach(t => {
                let tDiv = document.getElementById(`token-${cp.id}-${t.tId}`);
                tDiv.classList.add("selectable");
                tDiv.onclick = () => {
                    // Clear all listeners
                    validMoves.forEach(vt => {
                        let div = document.getElementById(`token-${cp.id}-${vt.tId}`);
                        div.classList.remove("selectable");
                        div.onclick = null;
                    });
                    executeMove(cp, t, diceRoll);
                };
            });
        }
    }
}

function getValidMoves(p, roll) {
    let valid = [];
    
    // Check if start position is blocked by OWN token
    let startBlocked = p.tokens.some(t => t.pos === 0);
    
    p.tokens.forEach(t => {
        if (t.pos === 56) return; // Finished
        
        if (t.pos === -1) {
            // Yard rule
            if (roll === 6 && !startBlocked) valid.push(t);
        } else {
            // Track rules
            if (t.pos + roll <= 56) valid.push(t);
        }
    });
    return valid;
}

function executeMove(p, t, roll) {
    if (t.pos === -1) {
        t.pos = 0;
    } else {
        t.pos += roll;
    }
    
    drawBoardTokens();
    
    // Check Bumping
    let bumped = false;
    let selfBumped = false;
    
    if (t.pos >= 0 && t.pos <= 50) {
        let globalPos = (t.pos + p.colorData.offset) % 52;
        
        // Check every other token on the board
        players.forEach(opp => {
            opp.tokens.forEach(oppT => {
                // Don't check against itself, or tokens in yard/home
                if (oppT === t || oppT.pos < 0 || oppT.pos > 50) return;
                
                let oppGlobalPos = (oppT.pos + opp.colorData.offset) % 52;
                
                if (globalPos === oppGlobalPos) {
                    if (opp.id === p.id) {
                        // Landed on own token! Rule: Send OWN moving token back to yard
                        t.pos = -1;
                        selfBumped = true;
                        logAction(`\`${p.name} landed on their own token and was sent back to the yard!\``);
                    } else {
                        // Standard bump! Send opponent to yard
                        oppT.pos = -1;
                        bumped = true;
                        logAction(`\`${p.name} BUMPED ${opp.name} back to the yard!\``);
                    }
                }
            });
        });
    }
    
    drawBoardTokens();
    
    // Check individual token finish
    if (t.pos === 56) {
        logAction(`\`${p.name} got a token HOME!\``);
    }
    
    // Check Player Finish
    if (p.tokens.every(tk => tk.pos === 56)) {
        p.active = false;
        p.place = placeCounter++;
        logAction(`<span style="color:#9ece6a; font-weight:bold;">${p.name} has finished!</span>`);
        
        let winCond = document.getElementById("win-condition").value;
        let activePlayers = players.filter(pl => pl.active);
        
        if (winCond === "winner" || activePlayers.length <= 1) {
            setTimeout(endGame, 1500);
            return;
        }
    }
    
    setTimeout(() => {
        // If they rolled a 6 (and it wasn't the 3rd), they go again
        if (diceRoll === 6) {
            gameState = "WAITING_ROLL";
            updateUI();
        } else {
            nextTurn();
        }
    }, 1000);
}

function nextTurn() {
    consecutiveSixes = 0;
    do {
        activePlayerIdx = (activePlayerIdx + 1) % players.length;
    } while (!players[activePlayerIdx].active);
    
    gameState = "WAITING_ROLL";
    updateUI();
}

function logAction(str) {
    lastPushStr = str;
    actionLog.innerHTML = str;
}

// ==========================================
// 5. AI LOGIC
// ==========================================
function executeAIMove(p, validMoves, roll) {
    let bestScore = -Infinity;
    let bestToken = null;
    let isOptimal = Math.random() <= p.diff.optimalChance;
    
    if (!isOptimal) {
        // Random choice
        bestToken = validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
        validMoves.forEach(t => {
            let score = 0;
            let targetRelativePos = (t.pos === -1) ? 0 : t.pos + roll;
            
            if (targetRelativePos === 56) score += 100; // Winning is best
            if (t.pos === -1) score += 40; // Getting out of yard is good
            
            // Check bumps
            if (targetRelativePos >= 0 && targetRelativePos <= 50) {
                let globalPos = (targetRelativePos + p.colorData.offset) % 52;
                players.forEach(opp => {
                    opp.tokens.forEach(oppT => {
                        if (oppT === t || oppT.pos < 0 || oppT.pos > 50) return;
                        let oppGlobalPos = (oppT.pos + opp.colorData.offset) % 52;
                        if (globalPos === oppGlobalPos) {
                            if (opp.id === p.id) score -= 1000; // NEVER bump yourself
                            else score += 50; // Bump enemy
                        }
                    });
                });
            }
            
            // Prefer moving tokens that are furthest along
            if (targetRelativePos > 0 && targetRelativePos < 56) score += targetRelativePos;
            
            if (score > bestScore) {
                bestScore = score;
                bestToken = t;
            }
        });
    }
    
    executeMove(p, bestToken, roll);
}

// ==========================================
// 6. PUSH MESSAGES & END GAME
// ==========================================
btnPushMidgame.addEventListener("click", () => {
    let stateArr = players.filter(p => p.active).map(p => {
        let home = p.tokens.filter(t => t.pos === 56).length;
        let yard = p.tokens.filter(t => t.pos === -1).length;
        let track = 4 - home - yard;
        return `${p.name} (${p.colorData.name}): ${home} Home, ${track} Track, ${yard} Yard`;
    });
    
    let pushStr = `<Ludo Board State: ${stateArr.join(". ")}>\n${lastPushStr}`;
    
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

function getOrdinal(n) {
    let s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function endGame() {
    // End the last player manually if playing One Loser
    let lastPlayer = players.find(p => p.active);
    if (lastPlayer) {
        lastPlayer.active = false;
        lastPlayer.place = placeCounter;
    }
    
    document.querySelector(".main-panel").style.display = "none";
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    
    let sorted = [...players].sort((a,b) => a.place - b.place);
    let winCond = document.getElementById("win-condition").value;
    
    if (winCond === "winner") {
        endStats.innerHTML = `<span style="color: #9ece6a;">${sorted[0].name} won the game!</span>`;
    } else {
        endStats.innerHTML = `<span style="color: #f7768e;">${sorted[sorted.length-1].name} is in last place and loses!</span>`;
    }
    
    btnPushEnd.onclick = () => {
        let summaryStr = "";
        let losersArr = [];
        
        if (winCond === "winner") {
            let winner = sorted[0].name;
            losersArr = sorted.slice(1).map(p => p.name);
            summaryStr = `\`${winner} raced all their tokens home and won the game of Ludo!\``;
        } else {
            let loser = sorted[sorted.length-1].name;
            losersArr = [loser];
            let placementStr = sorted.map(p => `${getOrdinal(p.place)}: ${p.name}`).join(", ");
            summaryStr = `\`${loser} was the last to finish and loses the game of Ludo! Final Standings: ${placementStr}\``;
        }
        
        // Add AI diff tags
        let diffTags = [];
        players.forEach(p => {
            if (!p.isUser) diffTags.push(`<${p.name} played on ${p.diff.name} difficulty. Take into account for roleplay, for example a canonically intelligent character played at easy difficulty would be taking it easy and letting the other character win>`);
        });
        if (diffTags.length > 0) summaryStr += `\n${diffTags.join("\n")}`;

        const rp = endRpText.value.trim();
        if (rp) summaryStr += `\n${rp}`;
        
        STBridge.sendMessage(summaryStr, { losers: losersArr });
        
        endRpText.value = "";
        endPhase.style.display = "none";
        setupPhase.style.display = "block";
    };
}

btnRestart.addEventListener("click", () => {
    gameControlsPhase.style.display = "none";
    document.querySelector(".main-panel").style.display = "flex";
    setupPhase.style.display = "block";
});