// UI Elements
const boardEl = document.getElementById('board');
const setupPanel = document.getElementById('setup-panel');
const controlsPanel = document.getElementById('controls-panel');
const gameArea = document.getElementById('game-area');
const turnIndicator = document.getElementById('turn-indicator');
const scoreRedEl = document.getElementById('score-red');
const scoreBlackEl = document.getElementById('score-black');

// Globals
let engine = null;
let players = { r: {}, b: {} };
let selectedSquare = null; 
let currentLegalMoves = [];
let lastActionStr = "";

// ==========================================
// 1. CHECKERS ENGINE (LOGIC & RULES)
// ==========================================
class CheckersEngine {
    constructor() {
        // 'r' = Red (moves UP), 'b' = Black (moves DOWN)
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        this.turn = 'r';
        this.blackPiecesCaptured = 0; // Black pieces taken BY red
        this.redPiecesCaptured = 0;   // Red pieces taken BY black
        this.initBoard();
    }

    initBoard() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 !== 0) {
                    if (r < 3) this.board[r][c] = { player: 'b', isKing: false };
                    if (r > 4) this.board[r][c] = { player: 'r', isKing: false };
                }
            }
        }
    }

    // Returns all legal moves for current player. Enforces mandatory jumps (US Rules).
    getLegalMoves(player = this.turn) {
        let jumps = [];
        let steps = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let p = this.board[r][c];
                if (p && p.player === player) {
                    jumps.push(...this.getJumps(r, c, p, [{r, c}], []));
                    steps.push(...this.getSteps(r, c, p));
                }
            }
        }
        return jumps.length > 0 ? jumps : steps;
    }

    getSteps(r, c, piece) {
        let steps = [];
        let dirs = piece.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (piece.player === 'r' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
        for (let [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !this.board[nr][nc]) {
                let promotes = (!piece.isKing && ((piece.player === 'r' && nr === 0) || (piece.player === 'b' && nr === 7)));
                steps.push({ from: {r,c}, to: {r:nr, c:nc}, captured: [], promotes: promotes });
            }
        }
        return steps;
    }

    getJumps(r, c, piece, currentPath, currentCaptures) {
        let jumps = [];
        let dirs = piece.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (piece.player === 'r' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
        
        let foundFurther = false;

        for (let [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            let jr = r + dr*2, jc = c + dc*2;
            
            if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8) {
                let neighbor = this.board[nr][nc];
                let landing = this.board[jr][jc];
                
                if (neighbor && neighbor.player !== piece.player && !landing) {
                    // Prevent circular jumping over the exact same piece
                    if (!currentCaptures.some(cap => cap.r === nr && cap.c === nc)) {
                        foundFurther = true;
                        let promotes = (!piece.isKing && ((piece.player === 'r' && jr === 0) || (piece.player === 'b' && jr === 7)));
                        let newCaptures = [...currentCaptures, {r: nr, c: nc, piece: neighbor}];
                        let newPath = [...currentPath, {r: jr, c: jc}];
                        
                        if (promotes) {
                            // Reaching opposite end ends turn immediately for a newly promoted king
                            jumps.push({ from: currentPath[0], to: {r: jr, c: jc}, captured: newCaptures, promotes: true });
                        } else {
                            // Temporarily apply jump to board to search for more jumps
                            let tempP = this.board[r][c];
                            this.board[r][c] = null;
                            this.board[jr][jc] = piece;
                            let subJumps = this.getJumps(jr, jc, piece, newPath, newCaptures);
                            this.board[jr][jc] = null;
                            this.board[r][c] = tempP;

                            if (subJumps.length > 0) {
                                jumps.push(...subJumps);
                            } else {
                                // Terminal jump
                                jumps.push({ from: currentPath[0], to: {r: jr, c: jc}, captured: newCaptures, promotes: false });
                            }
                        }
                    }
                }
            }
        }
        return jumps;
    }

    move(m) {
        let piece = this.board[m.from.r][m.from.c];
        this.board[m.from.r][m.from.c] = null;
        this.board[m.to.r][m.to.c] = piece;
        
        if (m.promotes) piece.isKing = true;
        
        for (let cap of m.captured) {
            this.board[cap.r][cap.c] = null;
        }

        if (this.turn === 'r') this.blackPiecesCaptured += m.captured.length;
        else this.redPiecesCaptured += m.captured.length;

        this.turn = this.turn === 'r' ? 'b' : 'r';
    }

    undo(m) {
        let piece = this.board[m.to.r][m.to.c];
        this.board[m.to.r][m.to.c] = null;
        this.board[m.from.r][m.from.c] = piece;
        
        if (m.promotes) piece.isKing = false;
        
        for (let cap of m.captured) {
            this.board[cap.r][cap.c] = cap.piece;
        }

        this.turn = this.turn === 'r' ? 'b' : 'r'; // Flip back

        if (this.turn === 'r') this.blackPiecesCaptured -= m.captured.length;
        else this.redPiecesCaptured -= m.captured.length;
    }

    isGameOver() {
        return this.getLegalMoves(this.turn).length === 0;
    }
}

// ==========================================
// 2. UI & GAME LOOP
// ==========================================
document.getElementById('btn-start').addEventListener('click', () => {
    players.r = {
        name: document.getElementById('p1-name').value || "Red",
        type: document.getElementById('p1-type').value,
        diff: parseInt(document.getElementById('p1-diff').value) 
    };
    players.b = {
        name: document.getElementById('p2-name').value || "Black",
        type: document.getElementById('p2-type').value,
        diff: parseInt(document.getElementById('p2-diff').value)
    };

    engine = new CheckersEngine(); 
    lastActionStr = "Match started.";
    
    setupPanel.style.display = "none";
    controlsPanel.style.display = "block";
    gameArea.style.opacity = "1";
    gameArea.style.pointerEvents = "auto";
    
    initBoardUI();
    updateUI();
    checkTurn();
});

function initBoardUI() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 64; i++) {
        let r = Math.floor(i / 8);
        let c = i % 8;
        let sq = document.createElement('div');
        
        let isLight = (r + c) % 2 === 0;
        sq.className = `square ${isLight ? 'light-sq' : 'dark-sq'}`;
        sq.id = `sq-${r}-${c}`;
        
        if (!isLight) {
            sq.addEventListener('click', () => handleSquareClick(r, c));
        }
        boardEl.appendChild(sq);
    }
}

function updateUI() {
    currentLegalMoves = engine.getLegalMoves();
    let validTargets = [];
    if (selectedSquare) {
        validTargets = currentLegalMoves.filter(m => m.from.r === selectedSquare.r && m.from.c === selectedSquare.c);
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let sq = document.getElementById(`sq-${r}-${c}`);
            if (!sq) continue;
            
            sq.innerHTML = '';
            sq.classList.remove('selected', 'valid-move');

            let pieceObj = engine.board[r][c];
            if (pieceObj) {
                let pDiv = document.createElement('div');
                pDiv.className = `piece ${pieceObj.player === 'r' ? 'piece-red' : 'piece-black'}`;
                if (pieceObj.isKing) pDiv.classList.add('king');
                sq.appendChild(pDiv);
            }

            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                sq.classList.add('selected');
            }
            if (validTargets.some(m => m.to.r === r && m.to.c === c)) {
                sq.classList.add('valid-move');
            }
        }
    }

    const activePlayer = players[engine.turn];
    turnIndicator.innerText = `${engine.turn === 'r' ? 'Red' : 'Black'}'s Turn (${activePlayer.name})`;
    turnIndicator.style.color = engine.turn === 'r' ? "#f7768e" : "#565f89";

    scoreRedEl.innerText = `${players.r.name} captures: ${engine.blackPiecesCaptured}`;
    scoreBlackEl.innerText = `${players.b.name} captures: ${engine.redPiecesCaptured}`;
}

function handleSquareClick(r, c) {
    if (engine.isGameOver()) return;
    const activePlayer = players[engine.turn];
    if (activePlayer.type === "ai") return;

    let pieceObj = engine.board[r][c];
    let isOwnPiece = pieceObj && pieceObj.player === engine.turn;

    // Filter valid targets based on currently selected square
    let validTargets = [];
    if (selectedSquare) {
        validTargets = currentLegalMoves.filter(m => m.from.r === selectedSquare.r && m.from.c === selectedSquare.c);
    }

    let targetMove = validTargets.find(m => m.to.r === r && m.to.c === c);

    if (targetMove) {
        executeMove(targetMove);
    } else if (isOwnPiece) {
        // Enforce mandatory jump visualization: Only highlight if piece actually has legal moves available
        let pieceMoves = currentLegalMoves.filter(m => m.from.r === r && m.from.c === c);
        if (pieceMoves.length > 0) {
            selectedSquare = (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) ? null : { r, c };
            updateUI();
        }
    } else {
        selectedSquare = null;
        updateUI();
    }
}

function executeMove(moveObj) {
    let pName = players[engine.turn].name;
    let capMsg = moveObj.captured.length > 0 ? `, capturing ${moveObj.captured.length} piece(s)` : '';
    let promMsg = moveObj.promotes ? `, and was crowned King` : '';
    lastActionStr = `${pName} moved${capMsg}${promMsg}`;

    engine.move(moveObj);
    selectedSquare = null;
    updateUI();
    
    if (engine.isGameOver()) {
        triggerGameOver();
    } else {
        checkTurn();
    }
}

function checkTurn() {
    const activePlayer = players[engine.turn];
    if (activePlayer.type === "ai") {
        turnIndicator.innerText = `AI is calculating...`;
        setTimeout(() => {
            const bestMove = getBestAIMove(activePlayer.diff);
            if (bestMove) executeMove(bestMove);
        }, 150); // Small visual delay
    }
}

// ==========================================
// 3. AI EVALUATION (MINIMAX WITH ALPHA-BETA)
// ==========================================
function evaluateBoard(boardEngine) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = boardEngine.board[r][c];
            if (p) {
                let val = p.isKing ? 30 : 10;
                
                // Positional bonuses
                if (!p.isKing) {
                    let advance = p.player === 'r' ? (7 - r) : r;
                    val += advance; // Reward pushing forward
                }
                
                // Edge protection bonus
                if (c === 0 || c === 7) val += 2; 

                score += (p.player === 'r') ? val : -val;
            }
        }
    }
    return score;
}

function minimax(boardEngine, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || boardEngine.isGameOver()) {
        return evaluateBoard(boardEngine);
    }
    
    let moves = boardEngine.getLegalMoves(isMaximizing ? 'r' : 'b');
    moves.sort((a, b) => b.captured.length - a.captured.length); // Try captures first
    
    if (isMaximizing) {
        let bestVal = -Infinity;
        for (let m of moves) {
            boardEngine.move(m);
            bestVal = Math.max(bestVal, minimax(boardEngine, depth - 1, alpha, beta, false));
            boardEngine.undo(m);
            alpha = Math.max(alpha, bestVal);
            if (beta <= alpha) break;
        }
        return bestVal;
    } else {
        let bestVal = Infinity;
        for (let m of moves) {
            boardEngine.move(m);
            bestVal = Math.min(bestVal, minimax(boardEngine, depth - 1, alpha, beta, true));
            boardEngine.undo(m);
            beta = Math.min(beta, bestVal);
            if (beta <= alpha) break;
        }
        return bestVal;
    }
}

function getBestAIMove(level) {
    let isMaximizing = engine.turn === 'r';
    let bestMove = null;
    let bestValue = isMaximizing ? -Infinity : Infinity;
    let moves = engine.getLegalMoves();
    if (moves.length === 0) return null;
    
    // Sort moves to speed up alpha-beta pruning
    moves.sort((a, b) => b.captured.length - a.captured.length);

    let depth = 3;
    let addNoise = false;

    // Apply specific difficulty settings
    if (level === 1) { // Easy
        if (Math.random() < 0.3) return moves[Math.floor(Math.random() * moves.length)]; // Very dumb random choice
        depth = 2;
        addNoise = true;
    } else if (level === 2) { // Medium
        depth = 3;
        addNoise = true;
    } else if (level === 3) { // Hard
        depth = 5;
        addNoise = false;
    }

    for (let m of moves) {
        engine.move(m);
        let boardValue = minimax(engine, depth - 1, -Infinity, Infinity, !isMaximizing);
        engine.undo(m);

        if (addNoise) boardValue += (Math.random() * 6 - 3);

        if (isMaximizing) {
            if (boardValue > bestValue) { bestValue = boardValue; bestMove = m; }
        } else {
            if (boardValue < bestValue) { bestValue = boardValue; bestMove = m; }
        }
    }
    return bestMove || moves[0];
}

// ==========================================
// 4. BRIDGE MESSAGES & ENDGAME
// ==========================================
document.getElementById('btn-push-state').addEventListener('click', () => {
    let customMsg = document.getElementById('mid-game-rp').value.trim();
    let isRedTurn = engine.turn === 'r';
    
    let text = `[Match: ${players.r.name} (Red) vs ${players.b.name} (Black)]\n`;
    text += `It is currently ${isRedTurn ? players.r.name : players.b.name}'s turn.\n`;
    text += `Current Score: ${players.r.name} has captured ${engine.blackPiecesCaptured} pieces. ${players.b.name} has captured ${engine.redPiecesCaptured} pieces.\n`;
    if (lastActionStr) text += `Last Action: ${lastActionStr}.\n`;
    if (customMsg) text += `\n${customMsg}`;
    
    STBridge.sendMessage(text);
    document.getElementById('mid-game-rp').value = "";
});

function triggerGameOver() {
    // Current turn player lost because they have no legal moves left
    const isRedTurn = engine.turn === 'r';
    const winner = isRedTurn ? players.b.name : players.r.name;
    const loser = isRedTurn ? players.r.name : players.b.name;
    
    document.getElementById('end-stats').innerText = `${winner} defeated ${loser}!`;
    document.getElementById('end-panel').style.display = "block";
    
    document.getElementById('btn-confirm-end').onclick = () => {
        let rp = document.getElementById('end-rp-text').value.trim();
        let payload = `**${winner} wiped out ${loser}'s forces and won the checkers match!**`;
        if (rp) payload += `\n${rp}`;
        
        // Pass loser via STBridge Hook to activate Strip Dashboard functionality
        STBridge.sendMessage(payload, { losers: [loser] });
        resetGame();
    };
}

document.getElementById('btn-reset').addEventListener('click', resetGame);

function resetGame() {
    document.getElementById('end-panel').style.display = "none";
    setupPanel.style.display = "block";
    controlsPanel.style.display = "none";
    gameArea.style.opacity = "0.3";
    gameArea.style.pointerEvents = "none";
}