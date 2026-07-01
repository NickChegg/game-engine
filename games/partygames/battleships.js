// DOM - Panels
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const placementPhase = document.getElementById("placement-phase");
const battlePhase = document.getElementById("battle-phase");
const endPhase = document.getElementById("end-phase");

// DOM - Inputs
const p1Type = document.getElementById("p1-type");
const p1DiffGroup = document.getElementById("p1-diff-group");
const p2Type = document.getElementById("p2-type");
const p2DiffGroup = document.getElementById("p2-diff-group");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

// DOM - Placement
const placementTitle = document.getElementById("placement-title");
const btnRotate = document.getElementById("btn-rotate");
const btnAutoplace = document.getElementById("btn-autoplace");
const placementBoard = document.getElementById("placement-board");
const shipQueue = document.getElementById("ship-queue");

// DOM - Battle
const board1 = document.getElementById("board-1"); // Holds P1's fleet
const board2 = document.getElementById("board-2"); // Holds P2's fleet
const p1BoardTitle = document.getElementById("p1-board-title");
const p2BoardTitle = document.getElementById("p2-board-title");
const turnIndicator = document.getElementById("turn-indicator");
const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");

// DOM - End
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");

// Game Settings
const ROWS = 8;
const COLS = 8;
const CELL_SIZE = 30; // 30px
const SHIPS_DATA = [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Destroyer", size: 2 }
];

const diffConfigs = {
    "easy": { name: "Easy", optimalChance: 0.50 },
    "medium": { name: "Medium", optimalChance: 0.70 },
    "hard": { name: "Hard", optimalChance: 0.90 }
};

let players = {};
let activePlayer = 1;
let placingFor = 1;
let shipIndex = 0;
let isHorizontal = true;
let gameActive = false;
let finalState = null;
let lastActionString = "The battle has begun!";

// ==========================================
// 1. SETUP UI
// ==========================================
p1Type.addEventListener("change", () => p1DiffGroup.style.display = p1Type.value === "ai" ? "block" : "none");
p2Type.addEventListener("change", () => p2DiffGroup.style.display = p2Type.value === "ai" ? "block" : "none");

btnStart.addEventListener("click", initGame);
btnRestart.addEventListener("click", initGame);

function initGame() {
    setupPhase.style.display = "none";
    endPhase.style.display = "none";
    battlePhase.style.display = "none";
    gameControlsPhase.style.display = "none";
    
    players = {
        1: { 
            name: document.getElementById("p1-name").value.trim() || "Player 1",
            isUser: p1Type.value === "user",
            diff: p1Type.value === "ai" ? diffConfigs[document.getElementById("p1-diff").value] : null,
            grid: createEmptyGrid(),
            fleet: [],
            aiState: { targetQueue: [], huntParity: 0 }
        },
        2: { 
            name: document.getElementById("p2-name").value.trim() || "Player 2",
            isUser: p2Type.value === "user",
            diff: p2Type.value === "ai" ? diffConfigs[document.getElementById("p2-diff").value] : null,
            grid: createEmptyGrid(),
            fleet: [],
            aiState: { targetQueue: [], huntParity: 0 }
        }
    };
    
    activePlayer = Math.random() < 0.5 ? 1 : 2;
    lastActionString = "The battle has begun!";
    
    startPlacement(1);
}

function createEmptyGrid() {
    let g = [];
    for(let r=0; r<ROWS; r++) {
        g[r] = [];
        for(let c=0; c<COLS; c++) g[r][c] = { shipId: null, fired: false };
    }
    return g;
}

// ==========================================
// 2. PLACEMENT PHASE
// ==========================================
function startPlacement(pNum) {
    placingFor = pNum;
    shipIndex = 0;
    isHorizontal = true;
    
    if (!players[pNum].isUser) {
        autoPlaceFleet(pNum);
        checkNextPhase();
        return;
    }
    
    placementPhase.style.display = "flex";
    placementTitle.innerText = `${players[pNum].name}, Place Your Ships`;
    btnRotate.innerText = "🔄 Rotate: Horizontal";
    updateShipQueue();
    renderPlacementBoard();
}

function updateShipQueue() {
    if (shipIndex < SHIPS_DATA.length) {
        let s = SHIPS_DATA[shipIndex];
        shipQueue.innerText = `Placing: ${s.name} (Length: ${s.size})`;
    }
}

btnRotate.addEventListener("click", () => {
    isHorizontal = !isHorizontal;
    btnRotate.innerText = isHorizontal ? "🔄 Rotate: Horizontal" : "🔄 Rotate: Vertical";
});

btnAutoplace.addEventListener("click", () => {
    autoPlaceFleet(placingFor);
    checkNextPhase();
});

function renderPlacementBoard() {
    placementBoard.innerHTML = "";
    
    // Draw existing ships
    players[placingFor].fleet.forEach(s => {
        placementBoard.appendChild(createShipDiv(s.x, s.y, s.size, s.horizontal, false));
    });

    // Draw grid cells with hover logic
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            let cell = document.createElement("div");
            cell.className = "bs-cell";
            
            // Mouse Enter
            cell.addEventListener("mouseenter", () => {
                if (shipIndex >= SHIPS_DATA.length) return;
                let size = SHIPS_DATA[shipIndex].size;
                let valid = canPlaceShip(players[placingFor], r, c, size, isHorizontal);
                let ghost = createShipDiv(c, r, size, isHorizontal, true);
                if (!valid) ghost.classList.add("invalid");
                ghost.id = "ghost-ship";
                placementBoard.appendChild(ghost);
            });
            
            // Mouse Leave
            cell.addEventListener("mouseleave", () => {
                let ghost = document.getElementById("ghost-ship");
                if (ghost) ghost.remove();
            });
            
            // Scroll Wheel / Dbl Click Rotate
            cell.addEventListener("wheel", (e) => {
                e.preventDefault();
                btnRotate.click();
                let ghost = document.getElementById("ghost-ship");
                if (ghost) ghost.remove();
                cell.dispatchEvent(new Event("mouseenter"));
            });
            cell.addEventListener("dblclick", () => cell.dispatchEvent(new WheelEvent("wheel")));

            // Click to Place
            cell.addEventListener("click", () => {
                if (shipIndex >= SHIPS_DATA.length) return;
                let sData = SHIPS_DATA[shipIndex];
                if (canPlaceShip(players[placingFor], r, c, sData.size, isHorizontal)) {
                    placeShip(players[placingFor], sData.name, r, c, sData.size, isHorizontal);
                    shipIndex++;
                    updateShipQueue();
                    let ghost = document.getElementById("ghost-ship");
                    if (ghost) ghost.remove();
                    renderPlacementBoard();
                    
                    if (shipIndex >= SHIPS_DATA.length) {
                        setTimeout(checkNextPhase, 400); // Tiny delay so they see the final ship
                    }
                }
            });

            placementBoard.appendChild(cell);
        }
    }
}

function createShipDiv(x, y, size, horiz, isGhost) {
    let div = document.createElement("div");
    div.className = "bs-ship" + (isGhost ? " ghost" : "");
    div.style.left = (x * CELL_SIZE + 2) + "px";
    div.style.top = (y * CELL_SIZE + 2) + "px";
    if (horiz) {
        div.style.width = (size * CELL_SIZE - 4) + "px";
        div.style.height = (CELL_SIZE - 4) + "px";
    } else {
        div.style.height = (size * CELL_SIZE - 4) + "px";
        div.style.width = (CELL_SIZE - 4) + "px";
    }
    return div;
}

function canPlaceShip(player, r, c, size, horiz) {
    if (horiz && c + size > COLS) return false;
    if (!horiz && r + size > ROWS) return false;
    
    for (let i=0; i<size; i++) {
        let checkR = horiz ? r : r + i;
        let checkC = horiz ? c + i : c;
        if (player.grid[checkR][checkC].shipId !== null) return false;
    }
    return true;
}

function placeShip(player, name, r, c, size, horiz) {
    let id = player.fleet.length;
    player.fleet.push({ id, name, size, hits: 0, sunk: false, x: c, y: r, horizontal: horiz });
    
    for (let i=0; i<size; i++) {
        let checkR = horiz ? r : r + i;
        let checkC = horiz ? c + i : c;
        player.grid[checkR][checkC].shipId = id;
    }
}

function autoPlaceFleet(pNum) {
    let p = players[pNum];
    for (; shipIndex < SHIPS_DATA.length; shipIndex++) {
        let s = SHIPS_DATA[shipIndex];
        let placed = false;
        while (!placed) {
            let r = Math.floor(Math.random() * ROWS);
            let c = Math.floor(Math.random() * COLS);
            let h = Math.random() < 0.5;
            if (canPlaceShip(p, r, c, s.size, h)) {
                placeShip(p, s.name, r, c, s.size, h);
                placed = true;
            }
        }
    }
}

function checkNextPhase() {
    if (placingFor === 1) {
        startPlacement(2);
    } else {
        placementPhase.style.display = "none";
        startGame();
    }
}

// ==========================================
// 3. PLAYING THE GAME
// ==========================================
function startGame() {
    gameActive = true;
    battlePhase.style.display = "block";
    gameControlsPhase.style.display = "block";
    
    p1BoardTitle.innerText = `${players[1].name}'s Fleet`;
    p2BoardTitle.innerText = `${players[2].name}'s Fleet`;
    
    updateTurnIndicator();
    renderBattleBoards();
    checkAITurn();
}

function renderBattleBoards() {
    renderSingleBoard(1, board1);
    renderSingleBoard(2, board2);
}

function renderSingleBoard(pNum, container) {
    let p = players[pNum];
    let isOpponent = pNum !== activePlayer;
    
    // Visibility Rule: Visible if it's the User's own board, OR if it's an AI vs AI match
    let visibleShips = p.isUser || (!players[1].isUser && !players[2].isUser);
    
    container.innerHTML = "";
    
    // Draw Ships
    p.fleet.forEach(s => {
        let sDiv = createShipDiv(s.x, s.y, s.size, s.horizontal, false);
        // Hide if not supposed to be visible, UNLESS it's sunk
        if (!visibleShips && !s.sunk) sDiv.classList.add("hidden");
        if (s.sunk) sDiv.classList.add("sunk");
        container.appendChild(sDiv);
    });

    // Draw Grid & Markers
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            let cell = document.createElement("div");
            cell.className = "bs-cell";
            
            // Interaction: Only allow click if it's the opponent's board, game is active, user turn, and cell unfired
            if (gameActive && isOpponent && players[activePlayer].isUser && !p.grid[r][c].fired) {
                cell.addEventListener("click", () => handleFire(r, c));
            }

            if (p.grid[r][c].fired) {
                let marker = document.createElement("div");
                marker.className = "bs-marker " + (p.grid[r][c].shipId !== null ? "bs-hit" : "bs-miss");
                cell.appendChild(marker);
            }
            container.appendChild(cell);
        }
    }
}

function updateTurnIndicator() {
    turnIndicator.innerText = `${players[activePlayer].name}'s Turn`;
    turnIndicator.style.color = activePlayer === 1 ? "#7aa2f7" : "#f7768e";
}

function handleFire(r, c) {
    let target = players[activePlayer === 1 ? 2 : 1];
    let attacker = players[activePlayer];
    
    target.grid[r][c].fired = true;
    let sId = target.grid[r][c].shipId;
    
    if (sId !== null) {
        // HIT
        let ship = target.fleet[sId];
        ship.hits++;
        if (ship.hits >= ship.size) {
            ship.sunk = true;
            lastActionString = `\`${attacker.name} hit and SUNK ${target.name}'s ${ship.name}!\``;
            
            // Check win
            if (target.fleet.every(s => s.sunk)) {
                renderBattleBoards();
                endGame(activePlayer);
                return;
            }
        } else {
            lastActionString = `\`${attacker.name} hits ${target.name}'s ship!\``;
        }
        
        // Feed hit to AI logic
        if (!attacker.isUser) {
            // Queue up adjacent cells
            let queue = attacker.aiState.targetQueue;
            if (r > 0) queue.push({r: r-1, c});
            if (r < ROWS-1) queue.push({r: r+1, c});
            if (c > 0) queue.push({r, c: c-1});
            if (c < COLS-1) queue.push({r, c: c+1});
        }
    } else {
        // MISS
        let letters = ["A","B","C","D","E","F","G","H"];
        lastActionString = `\`${attacker.name} fired at ${letters[c]}${r+1} and missed.\``;
    }
    
    activePlayer = activePlayer === 1 ? 2 : 1;
    updateTurnIndicator();
    renderBattleBoards();
    checkAITurn();
}

// ==========================================
// 4. AI LOGIC
// ==========================================
function checkAITurn() {
    if (!gameActive || players[activePlayer].isUser) return;
    
    turnIndicator.innerText = `${players[activePlayer].name} is targeting...`;
    
    setTimeout(() => {
        if (!gameActive) return;
        let attacker = players[activePlayer];
        let target = players[activePlayer === 1 ? 2 : 1];
        let diffConfig = attacker.diff; 
        
        let isOptimal = Math.random() <= diffConfig.optimalChance;
        let r, c;
        let fired = false;
        
        // 1. If optimal and we have targets in the queue (from a recent hit)
        if (isOptimal && attacker.aiState.targetQueue.length > 0) {
            while (attacker.aiState.targetQueue.length > 0 && !fired) {
                let t = attacker.aiState.targetQueue.shift();
                if (!target.grid[t.r][t.c].fired) {
                    r = t.r; c = t.c;
                    fired = true;
                }
            }
        }
        
        // 2. If no target queue or we rolled random, pick a random un-fired cell
        if (!fired) {
            let available = [];
            for (let tr=0; tr<ROWS; tr++) {
                for (let tc=0; tc<COLS; tc++) {
                    if (!target.grid[tr][tc].fired) available.push({r: tr, c: tc});
                }
            }
            
            if (available.length > 0) {
                // If Optimal, favor checkerboard pattern for hunting
                if (isOptimal) {
                    let parityMatch = available.filter(cell => (cell.r + cell.c) % 2 === attacker.aiState.huntParity);
                    if (parityMatch.length > 0) {
                        let pick = parityMatch[Math.floor(Math.random() * parityMatch.length)];
                        r = pick.r; c = pick.c;
                    } else {
                        let pick = available[Math.floor(Math.random() * available.length)];
                        r = pick.r; c = pick.c;
                    }
                } else {
                    let pick = available[Math.floor(Math.random() * available.length)];
                    r = pick.r; c = pick.c;
                }
            }
        }
        
        if (r !== undefined && c !== undefined) {
            handleFire(r, c);
        }
    }, 800);
}

// ==========================================
// 5. PUSH MESSAGES & GAME OVER
// ==========================================
function getDamageString(player) {
    let active = player.fleet.filter(s => !s.sunk);
    let damaged = active.filter(s => s.hits > 0);
    
    if (damaged.length === 0) return `${player.name} has ${active.length} ships left!`;
    
    let hitCounts = {};
    damaged.forEach(s => {
        hitCounts[s.hits] = (hitCounts[s.hits] || 0) + 1;
    });
    
    let parts = [];
    for (let h in hitCounts) {
        parts.push(`${hitCounts[h]} hit ${h} time${h > 1 ? 's' : ''}`);
    }
    
    return `${player.name} has ${active.length} ships left, with ${parts.join(", ")}!`;
}

btnPushMidgame.addEventListener("click", () => {
    let p1Status = getDamageString(players[1]);
    let p2Status = getDamageString(players[2]);
    
    let pushStr = `${lastActionString}\n${p1Status}\n${p2Status}`;
    
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

function endGame(winnerIdx) {
    gameActive = false;
    let winner = players[winnerIdx];
    let loser = players[winnerIdx === 1 ? 2 : 1];
    
    finalState = { winner, loser };
    
    setTimeout(() => {
        battlePhase.style.display = "none";
        gameControlsPhase.style.display = "none";
        endPhase.style.display = "block";
        
        let color = winnerIdx === 1 ? "#7aa2f7" : "#f7768e";
        endStats.innerHTML = `<span style="color: ${color};">${winner.name} won the naval battle!</span>`;
    }, 1500);
}

btnPushEnd.addEventListener("click", () => {
    if (!finalState) return;
    
    let w = finalState.winner;
    let l = finalState.loser;
    
    let summaryStr = `\`${w.name} sunk ${l.name}'s entire fleet and won the game of Battleships!\``;
    
    let diffTags = [];
    if (!w.isUser) {
        diffTags.push(`<${w.name} played on ${w.diff.name} difficulty. Take into account for roleplay, for example a canonically intelligent character played at easy difficulty would be taking it easy and letting the other character win>`);
    }
    if (!l.isUser) {
        diffTags.push(`<${l.name} played on ${l.diff.name} difficulty. Take into account for roleplay, for example a canonically intelligent character played at easy difficulty would be taking it easy and letting the other character win>`);
    }
    if (diffTags.length > 0) summaryStr += `\n${diffTags.join("\n")}`;

    const userRp = endRpText.value.trim();
    if (userRp) summaryStr += `\n${userRp}`;

    STBridge.sendMessage(summaryStr, { losers: [l.name] });
    
    endRpText.value = "";
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});