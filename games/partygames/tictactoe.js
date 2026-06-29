// DOM Elements
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");

const difficultySelect = document.getElementById("difficulty");
const boardContainer = document.getElementById("board");
const statusHeader = document.getElementById("status-header");

const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Game State
let board = ["", "", "", "", "", "", "", "", ""];
let currentDifficulty = "medium";
let isPlayerTurn = true;
let gameActive = false;

// Difficulty Settings Map
const difficultyConfig = {
    "easy": { name: "Easy", optimalChance: 0.40 },
    "medium": { name: "Medium", optimalChance: 0.70 },
    "hard": { name: "Hard", optimalChance: 0.90 }
};

const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// ==========================================
// 1. GAME SETUP
// ==========================================
btnStart.addEventListener("click", () => {
    currentDifficulty = difficultySelect.value;
    board = ["", "", "", "", "", "", "", "", ""];
    isPlayerTurn = true;
    gameActive = true;
    
    renderBoard();
    statusHeader.innerText = "Your Turn (X)";
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
});

function renderBoard() {
    boardContainer.innerHTML = "";
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "ttt-cell";
        
        if (board[i] === "X") {
            cell.innerText = "X";
            cell.classList.add("cell-x", "taken");
        } else if (board[i] === "O") {
            cell.innerText = "O";
            cell.classList.add("cell-o", "taken");
        }
        
        cell.addEventListener("click", () => handleCellClick(i));
        boardContainer.appendChild(cell);
    }
}

// ==========================================
// 2. TURN LOGIC
// ==========================================
function handleCellClick(index) {
    if (!gameActive || !isPlayerTurn || board[index] !== "") return;
    
    // Player Move
    board[index] = "X";
    renderBoard();
    
    if (checkGameState("X")) return;
    
    // Pass turn to AI
    isPlayerTurn = false;
    statusHeader.innerText = "AI is thinking...";
    
    // Small delay so the AI feels alive
    setTimeout(aiTurn, 600);
}

function aiTurn() {
    if (!gameActive) return;

    let availableMoves = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (availableMoves.length === 0) return;

    let chosenMove;
    const rng = Math.random();
    const config = difficultyConfig[currentDifficulty];

    // Probability Check: Do we make the best move, or a random mistake?
    if (rng <= config.optimalChance) {
        chosenMove = getBestMove(); // Minimax
    } else {
        chosenMove = availableMoves[Math.floor(Math.random() * availableMoves.length)]; // Random
    }

    board[chosenMove] = "O";
    renderBoard();
    
    if (checkGameState("O")) return;

    isPlayerTurn = true;
    statusHeader.innerText = "Your Turn (X)";
}

function checkGameState(lastPlayer) {
    // Check Win
    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            endGame(lastPlayer === "X" ? "win" : "loss");
            return true;
        }
    }
    
    // Check Tie
    if (!board.includes("")) {
        endGame("tie");
        return true;
    }
    
    return false;
}

// ==========================================
// 3. AI MINIMAX ALGORITHM
// ==========================================
function getBestMove() {
    let bestScore = -Infinity;
    let move = null;
    let available = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    
    for (let i of available) {
        board[i] = "O"; // Simulate move
        let score = minimax(board, 0, false);
        board[i] = ""; // Undo move
        
        if (score > bestScore) {
            bestScore = score;
            move = i;
        }
    }
    return move !== null ? move : available[0];
}

function minimax(simBoard, depth, isMaximizing) {
    // Check terminal states
    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (simBoard[a] && simBoard[a] === simBoard[b] && simBoard[a] === simBoard[c]) {
            if (simBoard[a] === "O") return 10 - depth; // AI wins
            if (simBoard[a] === "X") return depth - 10; // Player wins
        }
    }
    
    let available = simBoard.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (available.length === 0) return 0; // Tie

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i of available) {
            simBoard[i] = "O";
            let score = minimax(simBoard, depth + 1, false);
            simBoard[i] = "";
            bestScore = Math.max(score, bestScore);
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i of available) {
            simBoard[i] = "X";
            let score = minimax(simBoard, depth + 1, true);
            simBoard[i] = "";
            bestScore = Math.min(score, bestScore);
        }
        return bestScore;
    }
}

// ==========================================
// 4. GAME OVER & REPORTING
// ==========================================
let finalResultState = "";

function endGame(result) {
    gameActive = false;
    finalResultState = result;
    
    let color = "#a9b1d6";
    let text = "It's a Tie!";
    
    if (result === "win") {
        color = "#9ece6a";
        text = "You Won!";
    } else if (result === "loss") {
        color = "#f7768e";
        text = "You Lost!";
    }
    
    endStats.innerHTML = `<span style="color: ${color}; font-weight: bold;">${text}</span>`;
    
    setTimeout(() => {
        gamePanel.style.display = "none";
        endGamePanel.style.display = "block";
    }, 1000); // Wait 1 second before snapping to the end screen
}

btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    let resultWord = "tied";
    let gameResult = null; // Prepare our strip state object
    
    if (finalResultState === "win") {
        resultWord = "won";
        gameResult = { winners: ["{{user}}"] }; // User won, strip the AI
    }
    if (finalResultState === "loss") {
        resultWord = "lost";
        gameResult = { losers: ["{{user}}"] }; // User lost, strip the User
    }
    
    let diffName = difficultyConfig[currentDifficulty].name;

    // 1. The visible summary
    let resultString = `\`{{user}} ${resultWord} a game of Tic Tac Toe!\``;
    
    // 2. The invisible instruction tag
    resultString += `\n<Game played at difficulty ${diffName}. Take into account for roleplay, for example a canonically intelligent character played at easy difficulty would be taking it easy and letting {{user}} win>`;

    // 3. User Roleplay
    const userRp = endRpText.value.trim();
    if (userRp) resultString += `\n${userRp}`;

    // 4. Push to ST and intercept for clothing removal
    STBridge.sendMessage(resultString, gameResult);

    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});