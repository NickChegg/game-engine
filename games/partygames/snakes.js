// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gamePhase = document.getElementById("game-phase");
const endPhase = document.getElementById("end-phase");

const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const randomizeOrderCheck = document.getElementById("randomize-order");
const btnStart = document.getElementById("btn-start");

const ghostGrid = document.getElementById("ghost-grid");
const playerListUI = document.getElementById("player-list-ui");
const btnRoll = document.getElementById("btn-roll");
const btnForfeit = document.getElementById("btn-forfeit");
const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");
const endRpText = document.getElementById("end-rp-text");
const btnRestart = document.getElementById("btn-restart");

// Game Settings
let winCondition = "winner"; // 'winner' or 'loser'
let diceCount = 1;
const defaultColors = ["#f7768e", "#7aa2f7", "#9ece6a", "#e0af68", "#bb9af7", "#ff9eaf", "#89ddff", "#ff00ff", "#00ff00", "#00ffff"];

// Game Data
const snakesAndLadders = {
    // Ladders
    4: 25, 13: 46, 42: 63, 50: 69, 62: 81, 74: 92,
    // Snakes
    99: 41, 95: 77, 89: 53, 66: 45, 56: 31, 43: 18, 40: 3, 27: 5
};

let players = [];
let turnIndex = 0;
let placeCounter = 1;
let lastActionString = "The game has started.";

// ==========================================
// 1. SETUP LOGIC
// ==========================================
window.setCondition = (cond) => {
    winCondition = cond;
    document.getElementById("cond-winner").classList.toggle("active", cond === "winner");
    document.getElementById("cond-loser").classList.toggle("active", cond === "loser");
};

window.setDice = (count) => {
    diceCount = count;
    document.getElementById("dice-1").classList.toggle("active", count === 1);
    document.getElementById("dice-2").classList.toggle("active", count === 2);
};

function renderSetupPlayers() {
    let targetCount = parseInt(numPlayersInput.value) || 2;
    let currentCount = playersContainer.children.length;
    
    // ADD missing rows
    if (currentCount < targetCount) {
        for (let i = currentCount; i < targetCount; i++) {
            let row = document.createElement("div");
            row.className = "player-setup-row";
            
            // Picks the color sequentially from the defaultColors array
            let color = defaultColors[i % defaultColors.length];
            
            row.innerHTML = `
                <input type="color" class="color-picker p-color" value="${color}">
                <input type="text" class="text-input p-name" ${i === 0 ? 'value="{{user}}"' : `placeholder="Player ${i+1}"`}>
            `;
            playersContainer.appendChild(row);
        }
    } 
    // REMOVE excess rows from the bottom
    else if (currentCount > targetCount) {
        for (let i = currentCount; i > targetCount; i--) {
            playersContainer.removeChild(playersContainer.lastChild);
        }
    }
}
numPlayersInput.addEventListener("input", renderSetupPlayers);
window.addEventListener("DOMContentLoaded", () => {
    renderSetupPlayers();
    buildGhostGrid();
});

// ==========================================
// 2. GRID GENERATION (The Math Magic)
// ==========================================
function buildGhostGrid() {
    ghostGrid.innerHTML = "";
    
    for (let r = 9; r >= 0; r--) {
        let start = r * 10 + 1;
        let rowCells = [];
        for (let c = 0; c < 10; c++) rowCells.push(start + c);
        
        // Rows 1, 3, 5, 7, 9 move right-to-left visually, so we reverse the DOM insertion order
        if (r % 2 !== 0) rowCells.reverse();
        
        rowCells.forEach(num => {
            let cell = document.createElement("div");
            cell.id = `sl-cell-${num}`;
            cell.className = "sl-cell";
            ghostGrid.appendChild(cell);
        });
    }
}

// ==========================================
// 3. START GAME
// ==========================================
btnStart.addEventListener("click", () => {
    players = [];
    const rows = playersContainer.querySelectorAll(".player-setup-row");
    
    rows.forEach(row => {
        let name = row.querySelector(".p-name").value.trim();
        let color = row.querySelector(".p-color").value;
        if (!name) name = "Unknown";
        
        players.push({
            name: name,
            color: color,
            pos: 0,
            status: "active",
            place: null
        });
    });

    if (randomizeOrderCheck.checked) {
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
    }
    
    turnIndex = 0;
    placeCounter = 1;
    lastActionString = "The game has started.";
    
    // Clear all existing tokens
    document.querySelectorAll('.sl-token').forEach(t => t.remove());
    
    setupPhase.style.display = "none";
    gamePhase.style.display = "block";
    
    updateBoard();
});

// ==========================================
// 4. GAME LOOP & BOARD UPDATES
// ==========================================
function updateBoard() {
    // 1. Update List UI
    playerListUI.innerHTML = "";
    
    // Get Placements for Mid-Game Push & UI Display
    let activePlayers = players.filter(p => p.status === "active").sort((a, b) => b.pos - a.pos);
    
    players.forEach((p, index) => {
        let row = document.createElement("div");
        row.className = "sl-player-row";
        if (p.status === "active" && index === turnIndex) row.classList.add("active");
        if (p.status === "finished") row.classList.add("finished");
        
        let rankText = "";
        if (p.status === "finished") {
            rankText = p.place === 1 ? `<span style="color:#9ece6a;">Winner!</span>` : `<span style="color:#e0af68;">${getOrdinal(p.place)}</span>`;
        } else {
            let currRank = activePlayers.indexOf(p) + placeCounter; // Calculates current standing
            rankText = `Pos: ${p.pos} <span style="font-size:0.8em; color:#787c99;">(${getOrdinal(currRank)})</span>`;
        }
        
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:15px; height:15px; border-radius:50%; background:${p.color}; border:1px solid white;"></div>
                <strong>${p.name}</strong>
            </div>
            <div class="sl-rank-badge">${rankText}</div>
        `;
        playerListUI.appendChild(row);
        
        // 2. Update Token on Visual Board
        let existingToken = document.getElementById(`token-${index}`);
        if (existingToken) existingToken.remove();
        
        if (p.pos > 0) {
            let token = document.createElement("div");
            token.id = `token-${index}`;
            token.className = "sl-token";
            token.style.backgroundColor = p.color;
            
            let cell = document.getElementById(`sl-cell-${p.pos}`);
            if (cell) cell.appendChild(token); // Last appended visually renders on top!
        }
    });
    
    // Check Forfeit Condition
    let remaining = players.filter(p => p.status === "active");
    if (winCondition === "loser" && remaining.length === 1) {
        btnRoll.style.display = "none";
        btnForfeit.style.display = "block";
        btnForfeit.innerText = `${remaining[0].name} Forfeits (Last Place)`;
    } else {
        btnRoll.style.display = "block";
        btnForfeit.style.display = "none";
        btnRoll.innerText = `${players[turnIndex].name}'s Turn (Roll ${diceCount}d6)`;
    }
}

// ==========================================
// 5. TURN ACTION
// ==========================================
btnRoll.addEventListener("click", () => {
    let p = players[turnIndex];
    
    // Roll Math
    let roll1 = Math.floor(Math.random() * 6) + 1;
    let roll2 = (diceCount === 2) ? Math.floor(Math.random() * 6) + 1 : 0;
    let totalRoll = roll1 + roll2;
    
    let oldPos = p.pos;
    p.pos += totalRoll;
    if (p.pos > 100) p.pos = 100; // Cap at 100
    
    lastActionString = `\`${p.name} rolled a ${totalRoll} and moved to ${p.pos}.\``;
    
    // Check Snakes & Ladders
    if (snakesAndLadders[p.pos]) {
        let newPos = snakesAndLadders[p.pos];
        let diff = Math.abs(newPos - p.pos);
        if (newPos > p.pos) {
            lastActionString = `\`${p.name} rolled a ${totalRoll}, landed on a ladder, and climbed ahead ${diff} places to ${newPos}!\``;
        } else {
            lastActionString = `\`${p.name} rolled a ${totalRoll}, landed on a snake, and fell back ${diff} places to ${newPos}!\``;
        }
        p.pos = newPos;
    }
    
    // Check Win Condition
    if (p.pos === 100) {
        p.status = "finished";
        p.place = placeCounter++;
        
        if (winCondition === "winner") {
            // First person reached 100, game over instantly!
            players.filter(pl => pl.status === "active").forEach(pl => {
                pl.status = "finished";
                pl.place = placeCounter++;
            });
            endGame();
            return;
        }
    }
    
    // Advance Turn
    let loopProtect = 0;
    do {
        turnIndex = (turnIndex + 1) % players.length;
        loopProtect++;
    } while (players[turnIndex].status === "finished" && loopProtect < 20);
    
    updateBoard();
});

btnForfeit.addEventListener("click", () => {
    let p = players.find(pl => pl.status === "active");
    if (p) {
        p.status = "finished";
        p.place = placeCounter;
    }
    endGame();
});

// ==========================================
// 6. PUSH MESSAGES
// ==========================================
function getOrdinal(n) {
    let s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

btnPushMidgame.addEventListener("click", () => {
    let ranksArr = [];
    let activePlayers = players.filter(p => p.status === "active").sort((a, b) => b.pos - a.pos);
    
    players.forEach(p => {
        if (p.status === "finished") {
            ranksArr.push(`${p.name} finished in ${getOrdinal(p.place)} Place`);
        } else {
            let currRank = activePlayers.indexOf(p) + placeCounter;
            ranksArr.push(`${p.name} is on ${p.pos} and is in ${getOrdinal(currRank)} Place`);
        }
    });
    
    let pushStr = `<Snakes & Ladders Game State: ${ranksArr.join(" | ")}>\n${lastActionString}`;
    
    const rpText = midgameRpText.value.trim();
    if (rpText) pushStr += `\n${rpText}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

function endGame() {
    gamePhase.style.display = "none";
    endPhase.style.display = "block";
}

btnPushEnd.addEventListener("click", () => {
    let winnersArr = [];
    let losersArr = [];
    let sortedPlayers = [...players].sort((a, b) => a.place - b.place);
    
    let summaryStr = "";
    
    if (winCondition === "winner") {
        let winner = sortedPlayers[0].name;
        winnersArr.push(winner);
        
        let losersList = sortedPlayers.slice(1).map(p => p.name);
        losersArr.push(...losersList);
        
        summaryStr = `\`${winner} won the game of Snakes and Ladders!\``;
    } else {
        let loser = sortedPlayers[sortedPlayers.length - 1].name;
        losersArr.push(loser);
        
        let winnersList = sortedPlayers.slice(0, -1).map(p => p.name);
        winnersArr.push(...winnersList);
        
        let placementStr = sortedPlayers.map(p => `${getOrdinal(p.place)}: ${p.name}`).join(", ");
        summaryStr = `\`${loser} came in last and is the loser of Snakes and Ladders! Final standings: ${placementStr}\``;
    }
    
    const rpText = endRpText.value.trim();
    if (rpText) summaryStr += `\n${rpText}`;
    
    STBridge.sendMessage(summaryStr, { winners: winnersArr, losers: losersArr });
    
    endRpText.value = "";
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});

btnRestart.addEventListener("click", () => {
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});