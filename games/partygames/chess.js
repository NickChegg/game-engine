// UI Elements
const boardEl = document.getElementById('board');
const setupPanel = document.getElementById('setup-panel');
const controlsPanel = document.getElementById('controls-panel');
const gameArea = document.getElementById('game-area');
const turnIndicator = document.getElementById('turn-indicator');

let game = null;
let players = { w: {}, b: {} };
let selectedSquare = null; 
let lastActionStr = "";

const pieceMap = {
    'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
    'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
};
const pieceNames = { 'p': 'Pawn', 'n': 'Knight', 'b': 'Bishop', 'r': 'Rook', 'q': 'Queen', 'k': 'King' };

// --- Enhanced AI Values ---
const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const center_table = [ // Bias to encourage controlling the middle of the board
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0, 10, 20, 20, 10,  0,-10,
    -10,  0, 10, 20, 20, 10,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
];

document.getElementById('btn-start').addEventListener('click', () => {
    players.w = {
        name: document.getElementById('p1-name').value || "White",
        type: document.getElementById('p1-type').value,
        diff: parseInt(document.getElementById('p1-diff').value) 
    };
    players.b = {
        name: document.getElementById('p2-name').value || "Black",
        type: document.getElementById('p2-type').value,
        diff: parseInt(document.getElementById('p2-diff').value)
    };

    game = new Chess(); 
    lastActionStr = "Match started.";
    
    setupPanel.style.display = "none";
    controlsPanel.style.display = "block";
    gameArea.style.opacity = "1";
    gameArea.style.pointerEvents = "auto";
    
    initBoardUI();
    updateUI();
    checkTurn();
});

// Convert 0-63 grid to a8-h1
function indexToAlg(i) {
    const file = String.fromCharCode(97 + (i % 8)); 
    const rank = 8 - Math.floor(i / 8);             
    return `${file}${rank}`;
}

// Draw the actual HTML squares EXACTLY ONCE to prevent layout shifts!
function initBoardUI() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 64; i++) {
        let sq = document.createElement('div');
        let isLight = (Math.floor(i / 8) + i % 8) % 2 === 0;
        let alg = indexToAlg(i);
        
        sq.className = `square ${isLight ? 'light-sq' : 'dark-sq'}`;
        sq.id = `sq-${alg}`;
        
        // Attach listener strictly once
        sq.addEventListener('click', () => handleSquareClick(alg));
        boardEl.appendChild(sq);
    }
}

// Update the pieces inside the existing squares
function updateUI() {
    const legalMoves = game.moves({ verbose: true });
    const validTargetSquares = selectedSquare 
        ? legalMoves.filter(m => m.from === selectedSquare).map(m => m.to)
        : [];

    for (let i = 0; i < 64; i++) {
        let alg = indexToAlg(i);
        let sq = document.getElementById(`sq-${alg}`);
        let pieceObj = game.get(alg);

        // Reset highlights
        sq.classList.remove('selected', 'valid-move');

        if (pieceObj) {
            let char = pieceObj.color === 'w' ? pieceObj.type.toUpperCase() : pieceObj.type;
            sq.innerText = pieceMap[char];
        } else {
            sq.innerText = '';
        }

        if (alg === selectedSquare) sq.classList.add('selected');
        if (validTargetSquares.includes(alg)) sq.classList.add('valid-move');
    }
    
    const turnColor = game.turn();
    const activePlayer = players[turnColor];
    turnIndicator.innerText = `${turnColor === 'w' ? 'White' : 'Black'}'s Turn (${activePlayer.name})`;
    turnIndicator.style.color = turnColor === 'w' ? "#a9b1d6" : "#565f89";
}

function handleSquareClick(alg) {
    if (game.game_over()) return;
    const turnColor = game.turn();
    const activePlayer = players[turnColor];
    if (activePlayer.type === "ai") return;

    let pieceObj = game.get(alg);
    const legalMoves = game.moves({ verbose: true });
    const validTargetSquares = selectedSquare 
        ? legalMoves.filter(m => m.from === selectedSquare).map(m => m.to)
        : [];

    const isOwnPiece = pieceObj && pieceObj.color === turnColor;

    if (isOwnPiece) {
        selectedSquare = selectedSquare === alg ? null : alg; // toggle
        updateUI();
    } else if (selectedSquare && validTargetSquares.includes(alg)) {
        executeMove(selectedSquare, alg);
    } else {
        selectedSquare = null;
        updateUI();
    }
}

function executeMove(from, to) {
    let piece = game.get(from);
    let promotion = (piece && piece.type === 'p' && (to[1] === '1' || to[1] === '8')) ? 'q' : undefined;

    let moveObj = game.move({ from: from, to: to, promotion: promotion });
    selectedSquare = null;

    if (moveObj) {
        let pName = pieceNames[moveObj.piece];
        if (moveObj.captured) {
            lastActionStr = `${pName} moved to ${to}, capturing ${pieceNames[moveObj.captured]}`;
        } else {
            lastActionStr = `${pName} moved to ${to}`;
        }
    }

    updateUI();
    
    if (game.game_over()) {
        checkGameOver();
    } else {
        checkTurn();
    }
}

function checkTurn() {
    const turnColor = game.turn();
    const activePlayer = players[turnColor];

    if (activePlayer.type === "ai") {
        turnIndicator.innerText = `AI is thinking...`;
        setTimeout(() => {
            const bestMove = getBestAIMove(activePlayer.diff);
            if (bestMove) {
                executeMove(bestMove.from, bestMove.to);
            }
        }, 50); // Give the UI a tiny moment to render the thinking text
    }
}

// ==========================================
// SCALABLE AI EVALUATION (Levels 1 - 6)
// ==========================================
function evaluateBoard(boardGame) {
    let score = 0;
    const board = boardGame.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c];
            if (p) {
                let val = pieceValues[p.type];
                val += center_table[r * 8 + c]; 
                score += (p.color === 'w') ? val : -val;
            }
        }
    }
    return score;
}

function minimax(boardGame, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || boardGame.game_over()) {
        return evaluateBoard(boardGame);
    }
    
    let moves = boardGame.moves({ verbose: true });
    
    // Basic move ordering (check captures first) for faster pruning
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    if (isMaximizing) {
        let bestVal = -Infinity;
        for (let i = 0; i < moves.length; i++) {
            boardGame.move(moves[i]);
            bestVal = Math.max(bestVal, minimax(boardGame, depth - 1, alpha, beta, !isMaximizing));
            boardGame.undo();
            alpha = Math.max(alpha, bestVal);
            if (beta <= alpha) break;
        }
        return bestVal;
    } else {
        let bestVal = Infinity;
        for (let i = 0; i < moves.length; i++) {
            boardGame.move(moves[i]);
            bestVal = Math.min(bestVal, minimax(boardGame, depth - 1, alpha, beta, !isMaximizing));
            boardGame.undo();
            beta = Math.min(beta, bestVal);
            if (beta <= alpha) break;
        }
        return bestVal;
    }
}

function getMinimaxMove(searchDepth, addNoise = false) {
    let isMaximizing = game.turn() === 'w';
    let bestMove = null;
    let bestValue = isMaximizing ? -Infinity : Infinity;
    let moves = game.moves({ verbose: true });

    // Move ordering logic for the root node
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    for (let i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        let boardValue = minimax(game, searchDepth - 1, -Infinity, Infinity, !isMaximizing);
        game.undo();

        if (addNoise) {
            boardValue += (Math.random() * 50 - 25); // Adds mild randomness to trick the AI into sub-optimal moves
        }

        if (isMaximizing) {
            if (boardValue > bestValue) { bestValue = boardValue; bestMove = moves[i]; }
        } else {
            if (boardValue < bestValue) { bestValue = boardValue; bestMove = moves[i]; }
        }
    }
    return bestMove || moves[Math.floor(Math.random() * moves.length)];
}

function getBestAIMove(level) {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Map the 6 UI difficulties to actual engine depths and randomness
    switch(level) {
        case 1: // Elo 600 - 50% Random move, 50% Depth 1
            if (Math.random() < 0.5) return moves[Math.floor(Math.random() * moves.length)];
            return getMinimaxMove(1);
        case 2: // Elo 1000 - Depth 1 (Looks 1 step ahead, will take free pieces)
            return getMinimaxMove(1);
        case 3: // Elo 1400 - Depth 2 with noise (Looks 2 steps ahead, but occasionally miscalculates value)
            return getMinimaxMove(2, true);
        case 4: // Elo 2000 - Strict Depth 2 (Solid tactical awareness)
            return getMinimaxMove(2, false);
        case 5: // Elo 2500 - Depth 3 (Considers opponent's responses deeply)
            return getMinimaxMove(3, false);
        case 6: // Elo 3000+ - Depth 4 (Will pause for ~1 second, extremely hard to beat)
            return getMinimaxMove(4, false);
        default:
            return getMinimaxMove(2, false);
    }
}

// ==========================================
// BRIDGE MESSAGES & ENDGAME
// ==========================================
document.getElementById('btn-push-state').addEventListener('click', () => {
    let customMsg = document.getElementById('mid-game-rp').value.trim();
    let isWhiteTurn = game.turn() === 'w';
    
    let text = `[Match: ${players.w.name} (White) vs ${players.b.name} (Black)]\n`;
    text += `It is currently ${isWhiteTurn ? players.w.name : players.b.name}'s turn.\n`;
    if (game.in_check()) text += `**${isWhiteTurn ? players.w.name : players.b.name} is in CHECK!**\n`;
    if (lastActionStr) text += `Last Action: ${lastActionStr}.\n`;
    if (customMsg) text += `\n${customMsg}`;
    
    STBridge.sendMessage(text);
    document.getElementById('mid-game-rp').value = "";
});

function checkGameOver() {
    if (game.in_checkmate()) {
        const isWhiteTurn = game.turn() === 'w';
        const winner = isWhiteTurn ? players.b.name : players.w.name;
        const loser = isWhiteTurn ? players.w.name : players.b.name;
        
        document.getElementById('end-stats').innerText = `${winner} won against ${loser}!`;
        document.getElementById('end-panel').style.display = "block";
        
        document.getElementById('btn-confirm-end').onclick = () => {
            let rp = document.getElementById('end-rp-text').value.trim();
            let payload = `**${winner} checkmated ${loser} and won the chess match!**`;
            if (rp) payload += `\n${rp}`;
            STBridge.sendMessage(payload, { losers: [loser] });
            resetGame();
        };
    } else {
        document.getElementById('end-stats').innerText = `The game ended in a Draw/Stalemate!`;
        document.getElementById('end-panel').style.display = "block";
        
        document.getElementById('btn-confirm-end').onclick = () => {
            let rp = document.getElementById('end-rp-text').value.trim();
            let payload = `**The chess match ended in a stalemate/draw!**`;
            if (rp) payload += `\n${rp}`;
            STBridge.sendMessage(payload);
            resetGame();
        };
    }
}

document.getElementById('btn-reset').addEventListener('click', resetGame);

function resetGame() {
    document.getElementById('end-panel').style.display = "none";
    setupPanel.style.display = "block";
    controlsPanel.style.display = "none";
    gameArea.style.opacity = "0.3";
    gameArea.style.pointerEvents = "none";
}