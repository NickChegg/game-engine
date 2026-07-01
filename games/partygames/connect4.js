// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const gameHeader = document.getElementById("game-header");
const boardContainer = document.getElementById("board-container");
const endPhase = document.getElementById("end-phase");

const p1Name = document.getElementById("p1-name");
const p1Type = document.getElementById("p1-type");
const p1DiffGroup = document.getElementById("p1-diff-group");
const p1Diff = document.getElementById("p1-diff");

const p2Name = document.getElementById("p2-name");
const p2Type = document.getElementById("p2-type");
const p2DiffGroup = document.getElementById("p2-diff-group");
const p2Diff = document.getElementById("p2-diff");

const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");
const turnIndicator = document.getElementById("turn-indicator");
const c4Grid = document.getElementById("c4-grid");

const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");

const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");

// Game Settings & Constants
const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;

const diffConfigs = {
    "easy": { name: "Easy", optimalChance: 0.50 },
    "medium": { name: "Medium", optimalChance: 0.70 },
    "hard": { name: "Hard", optimalChance: 0.90 }
};

// State
let players = {
    1: { name: "", color: "Red", css: "c4-red", isUser: true, diff: null, diffName: "" },
    2: { name: "", color: "Yellow", css: "c4-yellow", isUser: false, diff: null, diffName: "" }
};
let board = []; // 2D array [col][row] where row 0 is the bottom
let activePlayer = 0;
let gameActive = false;
let finalState = null; // "win", "draw"
let finalWinner = 0;

// ==========================================
// 1. SETUP UI
// ==========================================
p1Type.addEventListener("change", () => p1DiffGroup.style.display = p1Type.value === "ai" ? "block" : "none");
p2Type.addEventListener("change", () => p2DiffGroup.style.display = p2Type.value === "ai" ? "block" : "none");

btnStart.addEventListener("click", initGame);
btnRestart.addEventListener("click", initGame);

function initGame() {
    players[1].name = p1Name.value.trim() || "Player 1";
    players[1].isUser = (p1Type.value === "user");
    if (!players[1].isUser) {
        players[1].diff = diffConfigs[p1Diff.value].optimalChance;
        players[1].diffName = diffConfigs[p1Diff.value].name;
    }

    players[2].name = p2Name.value.trim() || "Player 2";
    players[2].isUser = (p2Type.value === "user");
    if (!players[2].isUser) {
        players[2].diff = diffConfigs[p2Diff.value].optimalChance;
        players[2].diffName = diffConfigs[p2Diff.value].name;
    }

    // Reset Board array
    board = [];
    for (let c = 0; c < COLS; c++) {
        board[c] = [];
        for (let r = 0; r < ROWS; r++) board[c][r] = EMPTY;
    }

    // Randomize who goes first
    activePlayer = Math.random() < 0.5 ? 1 : 2;
    gameActive = true;
    finalState = null;

    setupPhase.style.display = "none";
    endPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    gameHeader.style.display = "block";
    boardContainer.style.display = "flex";

    drawBoard();
    updateTurnIndicator();
    checkAITurn();
}

// ==========================================
// 2. RENDERING & INPUT
// ==========================================
function drawBoard() {
    c4Grid.innerHTML = "";
    for (let c = 0; c < COLS; c++) {
        let colDiv = document.createElement("div");
        colDiv.className = "c4-column";
        colDiv.setAttribute("data-col", c);
        
        // Disable column interaction if game over or AI turn
        if (!gameActive || !players[activePlayer].isUser) colDiv.classList.add("disabled");

        colDiv.addEventListener("click", () => handleColumnClick(c));

        for (let r = 0; r < ROWS; r++) {
            let cell = document.createElement("div");
            cell.className = "c4-cell";
            if (board[c][r] === RED) cell.classList.add("c4-red");
            if (board[c][r] === YELLOW) cell.classList.add("c4-yellow");
            colDiv.appendChild(cell);
        }
        c4Grid.appendChild(colDiv);
    }
}

function updateTurnIndicator() {
    let p = players[activePlayer];
    turnIndicator.innerText = `${p.name}'s Turn (${p.color})`;
    turnIndicator.style.color = p.color === "Red" ? "#f7768e" : "#e0af68";
}

function handleColumnClick(c) {
    if (!gameActive || !players[activePlayer].isUser) return;
    dropPiece(c);
}

function dropPiece(c) {
    // Find lowest empty row in column
    let r = board[c].indexOf(EMPTY);
    if (r === -1) return; // Column is full

    board[c][r] = activePlayer;
    drawBoard();

    if (checkWin(board, activePlayer)) {
        gameActive = false;
        finalState = "win";
        finalWinner = activePlayer;
        showEndGame();
        return;
    }

    if (checkDraw(board)) {
        gameActive = false;
        finalState = "draw";
        showEndGame();
        return;
    }

    // Switch turn
    activePlayer = activePlayer === 1 ? 2 : 1;
    updateTurnIndicator();
    drawBoard(); // Re-render to disable/enable columns based on new turn
    checkAITurn();
}

// ==========================================
// 3. AI & MINIMAX
// ==========================================
function checkAITurn() {
    if (!gameActive || players[activePlayer].isUser) return;
    
    turnIndicator.innerText = `${players[activePlayer].name} is thinking...`;
    
    // Add small delay for realism so it doesn't instantly teleport pieces
    setTimeout(() => {
        if (!gameActive) return;
        let p = players[activePlayer];
        let validCols = getValidColumns(board);
        if (validCols.length === 0) return;

        let chosenCol = -1;
        let isOptimal = Math.random() <= p.diff;

        if (isOptimal) {
            // Find best mathematical move
            chosenCol = getBestMoveMinimax(board, activePlayer);
        } else {
            // Random mistake
            chosenCol = validCols[Math.floor(Math.random() * validCols.length)];
        }

        dropPiece(chosenCol);
    }, 600);
}

function getValidColumns(b) {
    let valid = [];
    for (let c = 0; c < COLS; c++) {
        if (b[c].includes(EMPTY)) valid.push(c);
    }
    return valid;
}

function getBestMoveMinimax(b, playerNum) {
    let bestScore = -Infinity;
    let bestCol = getValidColumns(b)[0];
    let validCols = getValidColumns(b);

    // Prefer center columns for tied scores
    validCols.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));

    for (let c of validCols) {
        let bCopy = copyBoard(b);
        let r = bCopy[c].indexOf(EMPTY);
        bCopy[c][r] = playerNum;

        // Depth 5 is deep enough to be smart but fast enough for JS
        let score = minimax(bCopy, 5, -Infinity, Infinity, false, playerNum);
        
        if (score > bestScore) {
            bestScore = score;
            bestCol = c;
        }
    }
    return bestCol;
}

function minimax(b, depth, alpha, beta, isMaximizing, aiPlayer) {
    let oppPlayer = aiPlayer === 1 ? 2 : 1;
    
    if (checkWin(b, aiPlayer)) return 1000000;
    if (checkWin(b, oppPlayer)) return -1000000;
    if (checkDraw(b)) return 0;
    if (depth === 0) return scorePosition(b, aiPlayer);

    let validCols = getValidColumns(b);

    if (isMaximizing) {
        let value = -Infinity;
        for (let c of validCols) {
            let bCopy = copyBoard(b);
            bCopy[c][bCopy[c].indexOf(EMPTY)] = aiPlayer;
            value = Math.max(value, minimax(bCopy, depth - 1, alpha, beta, false, aiPlayer));
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return value;
    } else {
        let value = Infinity;
        for (let c of validCols) {
            let bCopy = copyBoard(b);
            bCopy[c][bCopy[c].indexOf(EMPTY)] = oppPlayer;
            value = Math.min(value, minimax(bCopy, depth - 1, alpha, beta, true, aiPlayer));
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return value;
    }
}

// Basic heuristic scoring for Minimax
function scorePosition(b, playerNum) {
    let score = 0;
    // The center column is mathematically the most valuable in Connect 4
    let centerArray = b[3];
    let centerCount = centerArray.filter(cell => cell === playerNum).length;
    score += centerCount * 3;
    return score;
}

function copyBoard(b) {
    let newB = [];
    for (let c = 0; c < COLS; c++) newB[c] = [...b[c]];
    return newB;
}

// ==========================================
// 4. WIN CHECK & UNBLOCKED LINE SCANNER
// ==========================================
function checkWin(b, p) {
    // Horizontal
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS; r++) {
            if (b[c][r] === p && b[c+1][r] === p && b[c+2][r] === p && b[c+3][r] === p) return true;
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (b[c][r] === p && b[c][r+1] === p && b[c][r+2] === p && b[c][r+3] === p) return true;
        }
    }
    // Diagonal Right
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (b[c][r] === p && b[c+1][r+1] === p && b[c+2][r+2] === p && b[c+3][r+3] === p) return true;
        }
    }
    // Diagonal Left
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 3; r < ROWS; r++) {
            if (b[c][r] === p && b[c+1][r-1] === p && b[c+2][r-2] === p && b[c+3][r-3] === p) return true;
        }
    }
    return false;
}

function checkDraw(b) {
    return getValidColumns(b).length === 0;
}

function getLongestUnblockedLine(b, p) {
    let maxLine = 0;
    
    // Helper to evaluate a window of 4 cells
    function evaluateWindow(cells) {
        let pCount = cells.filter(x => x === p).length;
        let emptyCount = cells.filter(x => x === EMPTY).length;
        if (pCount > 0 && emptyCount === (4 - pCount)) {
            if (pCount > maxLine) maxLine = pCount;
        }
    }

    // Horizontal
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS; r++) {
            evaluateWindow([b[c][r], b[c+1][r], b[c+2][r], b[c+3][r]]);
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            evaluateWindow([b[c][r], b[c][r+1], b[c][r+2], b[c][r+3]]);
        }
    }
    // Diagonals
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS - 3; r++) evaluateWindow([b[c][r], b[c+1][r+1], b[c+2][r+2], b[c+3][r+3]]);
        for (let r = 3; r < ROWS; r++) evaluateWindow([b[c][r], b[c+1][r-1], b[c+2][r-2], b[c+3][r-3]]);
    }
    return maxLine;
}

// ==========================================
// 5. PUSH TO SILLYTAVERN
// ==========================================
btnPushMidgame.addEventListener("click", () => {
    let strArray = [];
    
    // Evaluate both players
    [1, 2].forEach(pNum => {
        let p = players[pNum];
        let maxLine = getLongestUnblockedLine(board, pNum);
        strArray.push(`${p.name} - ${p.color} - current longest unblocked line is ${maxLine}`);
    });
    
    let pushStr = `<Connect 4 Game State: ${strArray.join(" | ")}>`;
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

function showEndGame() {
    setTimeout(() => {
        endPhase.style.display = "block";
        if (finalState === "win") {
            let winner = players[finalWinner];
            let color = winner.color === "Red" ? "#f7768e" : "#e0af68";
            endStats.innerHTML = `<span style="color: ${color};">${winner.name} Wins!</span>`;
        } else {
            endStats.innerHTML = `<span style="color: #a9b1d6;">It's a Draw!</span>`;
        }
    }, 1000);
}

btnPushEnd.addEventListener("click", () => {
    let summaryStr = "";
    let stripPayload = null;
    
    if (finalState === "win") {
        let winner = players[finalWinner];
        let loser = players[finalWinner === 1 ? 2 : 1];
        summaryStr = `\`${winner.name} won the game of Connect 4 against ${loser.name}!\``;
        stripPayload = { losers: [loser.name] };
    } else {
        summaryStr = `\`The game of Connect 4 ended in a draw!\``;
    }
    
    // Add difficulty tags for AI players
    let diffTags = [];
    if (!players[1].isUser) {
        diffTags.push(`<${players[1].name} played on ${players[1].diffName} difficulty. Take into account for roleplay, for example a canonically intelligent character played at easy difficulty would be taking it easy and letting the other character win>`);
    }
    if (!players[2].isUser) {
        diffTags.push(`<${players[2].name} played on ${players[2].diffName} difficulty. Take into account for roleplay, for example a canonically intelligent character played at easy difficulty would be taking it easy and letting the other character win>`);
    }
    if (diffTags.length > 0) summaryStr += `\n${diffTags.join("\n")}`;

    const userRp = endRpText.value.trim();
    if (userRp) summaryStr += `\n${userRp}`;

    STBridge.sendMessage(summaryStr, stripPayload);
    
    endRpText.value = "";
    endPhase.style.display = "none";
});