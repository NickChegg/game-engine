// DOM Elements
const panels = { setup: document.getElementById('setup-panel'), game: document.getElementById('game-panel'), end: document.getElementById('end-panel') };
const canvas = document.getElementById('pool-canvas');
const ctx = canvas.getContext('2d');
const UI = {
    mode: document.getElementById('game-mode'), p1Name: document.getElementById('p1-name'), p1Type: document.getElementById('p1-type'), p2Name: document.getElementById('p2-name'), p2Type: document.getElementById('p2-type'),
    turnDisplay: document.getElementById('turn-display'), suitDisplay: document.getElementById('suit-display'), actionLog: document.getElementById('action-log'), midRp: document.getElementById('mid-rp-text'),
    btnStart: document.getElementById('btn-start'), btnPush: document.getElementById('btn-push-mid'), btnForfeit: document.getElementById('btn-forfeit'), btnEnd: document.getElementById('btn-confirm-end'),
    btnReset: document.getElementById('btn-reset'), endStats: document.getElementById('end-stats'), endRp: document.getElementById('end-rp-text')
};

// --- TABLE & PHYSICS CONSTANTS ---
const TABLE_MARGIN = 25; 
const CUSHION = 20;      
const PLAY_X1 = TABLE_MARGIN + CUSHION;        
const PLAY_Y1 = TABLE_MARGIN + CUSHION;        
const PLAY_X2 = canvas.width - TABLE_MARGIN - CUSHION;   
const PLAY_Y2 = canvas.height - TABLE_MARGIN - CUSHION;  

const W = PLAY_X2 - PLAY_X1; 
const H = PLAY_Y2 - PLAY_Y1; 

const FRICTION = 0.985;
const BALL_RADIUS = 9;
const POCKET_RADIUS = 16;
const POCKETS = [
    {x: PLAY_X1, y: PLAY_Y1}, {x: PLAY_X2, y: PLAY_Y1},
    {x: PLAY_X1, y: PLAY_Y1 + H/2}, {x: PLAY_X2, y: PLAY_Y1 + H/2},
    {x: PLAY_X1, y: PLAY_Y2}, {x: PLAY_X2, y: PLAY_Y2}
];

// Colors mapped
const cMap = {
    cue: "#ffffff", black: "#111111", 8: "#111111", 9: "#f5d142",
    red: "#d32f2f", yellow: "#f5d142", green: "#2e7d32", brown: "#5c4033",
    blue: "#2b4cb3", pink: "#f48fb1"
};

const poolCols = ["#fff", "#f5d142", "#2b4cb3", "#d32f2f", "#5e35b1", "#e65100", "#2e7d32", "#880e4f", "#111"];

// State Variables
let gameState = "SETUP"; // SETUP, IDLE, DRAGGING, ROLLING, PLACING_CUE
let mode = "8ball";
let players = [], currentPlayerIndex = 0;
let balls = [];
let isTableOpen = true;
let p1Suit = null, p2Suit = null;
let snookerTarget = 'red';
let lastActionText = "";

let dragStart = {x: 0, y: 0}, dragCurrent = {x: 0, y: 0}, cueBall = null;
let ballsPocketedThisTurn = [], firstBallHitThisTurn = null, scratchThisTurn = false;

// --- CLASSES ---
class Ball {
    constructor(id, x, y, type, colorTag=null) {
        this.id = id; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.type = type; 
        this.colorTag = colorTag;
        this.active = true;
        this.homeX = x; this.homeY = y; 
    }
    draw() {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2);
        
        if (mode === 'snooker' || mode === 'blackball') {
            let col = cMap.cue;
            if (this.colorTag) col = cMap[this.colorTag];
            else if (this.type === 'red') col = cMap.red;
            else if (this.type === 'yellow') col = cMap.yellow;
            else if (this.type === '8') col = cMap.black;
            
            ctx.fillStyle = col;
            ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#111"; ctx.stroke();
            return; // No numbers or stripes in these modes
        }

        let idx = this.id > 8 ? this.id - 8 : this.id;
        ctx.fillStyle = poolCols[idx];
        ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#111"; ctx.stroke();

        if (this.type === 'stripe') {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(this.x - BALL_RADIUS, this.y - BALL_RADIUS/3, BALL_RADIUS*2, BALL_RADIUS*0.66);
            ctx.beginPath(); ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI * 2); ctx.stroke();
        }
        
        if (this.id > 0) {
            ctx.beginPath(); ctx.arc(this.x, this.y, BALL_RADIUS * 0.45, 0, Math.PI*2);
            ctx.fillStyle = "#fff"; ctx.fill();
            ctx.fillStyle = "#000"; ctx.font = "bold 8px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(this.id, this.x, this.y + 1);
        }
    }
}

// --- SETUP & RACKING ---
UI.btnStart.addEventListener('click', () => {
    mode = UI.mode.value;
    players = [
        { name: UI.p1Name.value || "Player 1", type: UI.p1Type.value, score: 0 },
        { name: UI.p2Name.value || "Player 2", type: UI.p2Type.value, score: 0 }
    ];
    currentPlayerIndex = 0;
    isTableOpen = true; p1Suit = null; p2Suit = null; snookerTarget = 'red';
    lastActionText = "Game started. " + players[0].name + " is breaking.";
    
    rackBalls();
    panels.setup.style.display = 'none'; panels.end.style.display = 'none'; panels.game.style.display = 'block';
    
    gameState = "IDLE";
    updateUI(); requestAnimationFrame(gameLoop); checkAITurn();
});

function rackBalls() {
    balls = [];
    // Cue ball starts at the bottom of the vertical table
    cueBall = new Ball(0, PLAY_X1 + W/2, PLAY_Y2 - H*0.15, 'cue', 'cue');
    balls.push(cueBall);

    let startX = PLAY_X1 + W/2;
    let startY = PLAY_Y1 + H*0.25; // Foot spot (apex of the triangle)
    let spacing = BALL_RADIUS * 2 + 1;

    if (mode === '8ball' || mode === 'blackball') {
        let p;
        if (mode === '8ball') {
            p = [ [1,'solid'], [9,'stripe'], [2,'solid'], [10,'stripe'], [8,'8'], [3,'solid'], [11,'stripe'], [4,'solid'], [12,'stripe'], [13,'stripe'], [5,'solid'], [14,'stripe'], [6,'solid'], [15,'stripe'], [7,'solid'] ];
        } else {
            // Valid English 8-ball (Blackball) Rack
            p = [ [1,'red'], [2,'yellow'], [3,'yellow'], [4,'red'], [8,'8'], [5,'red'], [6,'yellow'], [7,'red'], [9,'yellow'], [10,'red'], [11,'yellow'], [12,'red'], [13,'yellow'], [14,'red'], [15,'yellow'] ];
        }
        
        let index = 0;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                let bx = startX - (row * spacing / 2) + (col * spacing);
                // FIXED: Changed to subtract so the triangle builds UPWARDS, leaving the apex facing the cue ball
                let by = startY - row * (spacing * 0.866); 
                balls.push(new Ball(p[index][0], bx, by, p[index][1])); index++;
            }
        }
    } else if (mode === '9ball') {
        const p = [ [1,'9ball'], [2,'9ball'], [3,'9ball'], [4,'9ball'], [9,'9ball'], [5,'9ball'], [6,'9ball'], [7,'9ball'], [8,'9ball'] ];
        const coords = [ [0,0], [-0.5,1], [0.5,1], [-1,2], [0,2], [1,2], [-0.5,3], [0.5,3], [0,4] ];
        for (let i=0; i<9; i++) {
            let bx = startX + coords[i][0] * spacing;
            // FIXED: Flipped 9-ball diamond to point towards cue ball
            let by = startY - coords[i][1] * (spacing * 0.866);
            balls.push(new Ball(p[i][0], bx, by, p[i][1]));
        }
    } else if (mode === 'snooker') {
        let dLine = PLAY_Y2 - H*0.2;
        
        balls.push(new Ball(40, startX, PLAY_Y1 + H*0.09, 'color', 'black'));
        // Pink ball is placed just below the apex of the reds (higher Y value)
        balls.push(new Ball(39, startX, startY + BALL_RADIUS * 2.5, 'color', 'pink')); 
        balls.push(new Ball(38, startX, PLAY_Y1 + H/2, 'color', 'blue'));
        balls.push(new Ball(37, startX, dLine, 'color', 'brown'));
        balls.push(new Ball(36, startX - W*0.2, dLine, 'color', 'green'));
        balls.push(new Ball(35, startX + W*0.2, dLine, 'color', 'yellow'));
        
        let index = 20;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                let bx = startX - (row * spacing / 2) + (col * spacing);
                // FIXED: Pyramid of reds builds up towards the black ball
                let by = startY - row * (spacing * 0.866);
                balls.push(new Ball(index++, bx, by, 'red', 'red'));
            }
        }
    }
}

// --- PHYSICS ENGINE ---
function gameLoop() {
    if (gameState === "ROLLING") updatePhysics();
    drawTable();
    if (gameState !== "SETUP") requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    let moving = false;

    balls.forEach(b => {
        if (!b.active) return;
        b.x += b.vx; b.y += b.vy;
        b.vx *= FRICTION; b.vy *= FRICTION;
        if (Math.abs(b.vx) < 0.05) b.vx = 0;
        if (Math.abs(b.vy) < 0.05) b.vy = 0;
        if (b.vx !== 0 || b.vy !== 0) moving = true;

        if (b.x < PLAY_X1 + BALL_RADIUS) { b.x = PLAY_X1 + BALL_RADIUS; b.vx *= -1; }
        if (b.x > PLAY_X2 - BALL_RADIUS) { b.x = PLAY_X2 - BALL_RADIUS; b.vx *= -1; }
        if (b.y < PLAY_Y1 + BALL_RADIUS) { b.y = PLAY_Y1 + BALL_RADIUS; b.vy *= -1; }
        if (b.y > PLAY_Y2 - BALL_RADIUS) { b.y = PLAY_Y2 - BALL_RADIUS; b.vy *= -1; }

        POCKETS.forEach(p => {
            let dx = b.x - p.x, dy = b.y - p.y;
            if (Math.sqrt(dx*dx + dy*dy) < POCKET_RADIUS) pocketBall(b);
        });
    });

    for (let i = 0; i < balls.length; i++) {
        if (!balls[i].active) continue;
        for (let j = i + 1; j < balls.length; j++) {
            if (!balls[j].active) continue;
            let b1 = balls[i], b2 = balls[j];
            let dx = b2.x - b1.x, dy = b2.y - b1.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < BALL_RADIUS * 2) {
                if (firstBallHitThisTurn === null) {
                    if (b1.type === 'cue') firstBallHitThisTurn = b2;
                    else if (b2.type === 'cue') firstBallHitThisTurn = b1;
                }
                let overlap = (BALL_RADIUS * 2 - dist) / 2;
                let nx = dx / dist, ny = dy / dist;
                b1.x -= nx * overlap; b1.y -= ny * overlap;
                b2.x += nx * overlap; b2.y += ny * overlap;
                let kx = b1.vx - b2.vx, ky = b1.vy - b2.vy;
                let p = (nx * kx + ny * ky); 
                b1.vx -= p * nx; b1.vy -= p * ny;
                b2.vx += p * nx; b2.vy += p * ny;
            }
        }
    }

    if (!moving) { gameState = "EVALUATE"; evaluateTurn(); }
}

function pocketBall(b) {
    b.active = false; b.vx = 0; b.vy = 0;
    if (b.type === 'cue') scratchThisTurn = true;
    else ballsPocketedThisTurn.push(b);
}

// --- RENDERING ---
function drawTable() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#5c4033";
    ctx.fillRect(TABLE_MARGIN, TABLE_MARGIN, canvas.width - 2*TABLE_MARGIN, canvas.height - 2*TABLE_MARGIN);
    ctx.strokeStyle = "#3a251c"; ctx.lineWidth = 4;
    ctx.strokeRect(TABLE_MARGIN, TABLE_MARGIN, canvas.width - 2*TABLE_MARGIN, canvas.height - 2*TABLE_MARGIN);

    ctx.fillStyle = "#2d662e";
    ctx.fillRect(PLAY_X1, PLAY_Y1, W, H);
    
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1;
    if (mode === 'snooker') {
        let dLine = PLAY_Y2 - H*0.2;
        ctx.beginPath(); ctx.moveTo(PLAY_X1, dLine); ctx.lineTo(PLAY_X2, dLine); ctx.stroke();
        ctx.beginPath(); ctx.arc(PLAY_X1 + W/2, dLine, W*0.2, Math.PI, Math.PI*2); ctx.stroke();
    } else {
        ctx.beginPath(); ctx.moveTo(PLAY_X1, PLAY_Y2 - H*0.25); ctx.lineTo(PLAY_X2, PLAY_Y2 - H*0.25); ctx.stroke();
    }

    ctx.fillStyle = "#050505";
    POCKETS.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI*2); ctx.fill();
    });

    balls.forEach(b => b.draw());

    if (gameState === "DRAGGING" && cueBall.active) {
        ctx.beginPath(); ctx.moveTo(cueBall.x, cueBall.y); ctx.lineTo(dragCurrent.x, dragCurrent.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }

    if (gameState === "PLACING_CUE") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        if (mode === 'snooker') {
            ctx.beginPath(); ctx.arc(PLAY_X1 + W/2, PLAY_Y2 - H*0.2, W*0.2, Math.PI, Math.PI*2); ctx.fill();
        } else {
            ctx.fillRect(PLAY_X1, PLAY_Y2 - H*0.25, W, H*0.25); 
        }
    }
}

// --- INPUT ---
canvas.addEventListener('mousedown', (e) => {
    let rect = canvas.getBoundingClientRect();
    let mx = e.clientX - rect.left; let my = e.clientY - rect.top;

    if (gameState === "PLACING_CUE") {
        cueBall.x = Math.max(PLAY_X1+BALL_RADIUS, Math.min(PLAY_X2-BALL_RADIUS, mx)); 
        cueBall.y = Math.max(PLAY_Y1+BALL_RADIUS, Math.min(PLAY_Y2-BALL_RADIUS, my));
        cueBall.active = true; scratchThisTurn = false; gameState = "IDLE";
        checkAITurn(); return;
    }

    if (gameState === "IDLE" && players[currentPlayerIndex].type === 'human') {
        gameState = "DRAGGING"; dragStart = {x: mx, y: my}; dragCurrent = {x: mx, y: my};
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (gameState === "DRAGGING") {
        let rect = canvas.getBoundingClientRect();
        dragCurrent.x = e.clientX - rect.left; dragCurrent.y = e.clientY - rect.top;
    }
});

canvas.addEventListener('mouseup', () => {
    if (gameState === "DRAGGING") {
        let dx = dragStart.x - dragCurrent.x; let dy = dragStart.y - dragCurrent.y;
        let power = Math.sqrt(dx*dx + dy*dy) * 0.12; 
        if (power > 25) power = 25; 
        
        if (power > 1) {
            let angle = Math.atan2(dy, dx);
            cueBall.vx = Math.cos(angle) * power; cueBall.vy = Math.sin(angle) * power;
            startRoll();
        } else {
            gameState = "IDLE";
        }
    }
});

function startRoll() {
    gameState = "ROLLING"; ballsPocketedThisTurn = []; firstBallHitThisTurn = null; scratchThisTurn = false;
    UI.actionLog.innerText = "Balls are rolling...";
}

// --- AI LOGIC ---
function checkAITurn() {
    if (gameState === "IDLE" && players[currentPlayerIndex].type.startsWith("ai")) setTimeout(takeAIShot, 1000);
    else if (gameState === "PLACING_CUE" && players[currentPlayerIndex].type.startsWith("ai")) {
        cueBall.x = PLAY_X1 + W/2; cueBall.y = PLAY_Y2 - H*0.1;
        cueBall.active = true; scratchThisTurn = false; gameState = "IDLE"; setTimeout(takeAIShot, 1000);
    }
}

function takeAIShot() {
    if (gameState !== "IDLE") return;
    let type = players[currentPlayerIndex].type;
    let errorMargin = type === "ai-easy" ? 0.3 : type === "ai-med" ? 0.1 : 0.02;

    let targetBall = null;
    let act = balls.filter(b => b.active && b.id !== 0);
    if (act.length === 0) return;

    if (mode === '8ball' || mode === 'blackball') {
        let s = currentPlayerIndex === 0 ? p1Suit : p2Suit;
        let valid = !s ? act.filter(b=>b.type!=='8') : (act.filter(b=>b.type===s).length > 0 ? act.filter(b=>b.type===s) : act.filter(b=>b.type==='8'));
        targetBall = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : act[0];
    } else if (mode === '9ball') {
        act.sort((a,b) => a.id - b.id); targetBall = act[0];
    } else {
        let reds = act.filter(b => b.type === 'red');
        if (snookerTarget === 'red' && reds.length > 0) targetBall = reds[Math.floor(Math.random() * reds.length)];
        else {
            let cols = act.filter(b => b.type === 'color').sort((a,b) => a.id - b.id);
            targetBall = cols.length > 0 ? cols[0] : act[0];
        }
    }

    let tp = POCKETS[Math.floor(Math.random() * POCKETS.length)];
    let angle = Math.atan2(targetBall.y - cueBall.y, targetBall.x - cueBall.x);
    angle += (Math.random() - 0.5) * errorMargin;
    let power = 10 + Math.random() * 10;
    cueBall.vx = Math.cos(angle) * power; cueBall.vy = Math.sin(angle) * power;
    startRoll();
}

// --- RULES & EVALUATION ---
function evaluateTurn() {
    let cpName = players[currentPlayerIndex].name;
    let keepTurn = false;
    let actionStr = `${cpName} shot. `;

    if (scratchThisTurn) {
        actionStr += "Scratched! Cue ball in hand. ";
        gameState = "PLACING_CUE"; keepTurn = false;
    } else if (!firstBallHitThisTurn) {
        actionStr += "Missed! "; gameState = "IDLE"; keepTurn = false;
    } else {
        gameState = "IDLE";
        
        if (mode === '8ball' || mode === 'blackball') {
            let myS = currentPlayerIndex === 0 ? p1Suit : p2Suit;
            let validHit = (!myS && firstBallHitThisTurn.type !== '8') || (firstBallHitThisTurn.type === myS) || (!balls.some(b=>b.active && b.type===myS) && firstBallHitThisTurn.type === '8');

            if (!validHit) { actionStr += `Hit wrong ball (${firstBallHitThisTurn.type}). `; keepTurn = false; }
            else {
                if (ballsPocketedThisTurn.length > 0) {
                    
                    let pottedDesc = ballsPocketedThisTurn.map(b => {
                        if (b.type === '8') return '8-Ball';
                        if (mode === 'blackball') return b.type.charAt(0).toUpperCase() + b.type.slice(1);
                        return b.id;
                    });
                    actionStr += `Potted: ${pottedDesc.join(', ')}. `;
                    
                    if (ballsPocketedThisTurn.find(b => b.type === '8')) {
                        balls.some(b => b.active && b.type === myS) ? gameOver(1-currentPlayerIndex, "Sank 8-Ball early!") : gameOver(currentPlayerIndex, "Clean 8-Ball Win!"); return;
                    }
                    if (isTableOpen) {
                        myS = ballsPocketedThisTurn[0].type;
                        let oppS = (mode==='8ball') ? (myS === 'solid' ? 'stripe' : 'solid') : (myS === 'red' ? 'yellow' : 'red');
                        if (currentPlayerIndex === 0) { p1Suit = myS; p2Suit = oppS; } else { p2Suit = myS; p1Suit = oppS; }
                        isTableOpen = false; actionStr += `${cpName} is ${myS}s. `;
                    }
                    if (ballsPocketedThisTurn.some(b => b.type === myS)) keepTurn = true;
                } else actionStr += "Nothing potted. ";
            }
        } 
        else if (mode === 'snooker') {
            let h = firstBallHitThisTurn;
            let redsLeft = balls.some(b => b.active && b.type === 'red');
            let isRedTarget = snookerTarget === 'red' && redsLeft;

            if ((isRedTarget && h.type !== 'red') || (!isRedTarget && h.type === 'red')) {
                actionStr += `Foul: Hit ${h.colorTag} instead of ${snookerTarget}. `; gameState = "PLACING_CUE"; keepTurn = false;
            } else {
                if (ballsPocketedThisTurn.length > 0) {
                    let pts = 0;
                    ballsPocketedThisTurn.forEach(b => {
                        pts += b.type === 'red' ? 1 : (b.id - 33);
                        actionStr += `Potted ${b.colorTag}. `;
                        if (b.type === 'color' && redsLeft) {
                            b.active = true; b.x = b.homeX; b.y = b.homeY; b.vx = 0; b.vy = 0;
                            actionStr += `(${b.colorTag} respotted). `;
                        }
                    });
                    players[currentPlayerIndex].score += pts;
                    snookerTarget = (isRedTarget && redsLeft) ? 'color' : 'red';
                    keepTurn = true;
                } else {
                    actionStr += "Nothing potted. ";
                }
            }
            if (!balls.some(b => b.active && b.id !== 0)) {
                let w = players[0].score > players[1].score ? 0 : 1;
                gameOver(w, `Cleared Table! Score: ${players[0].score} to ${players[1].score}`); return;
            }
        } else {
            let act = balls.filter(b => b.active && b.id !== 0).map(b => b.id).sort((a,b)=>a-b);
            if (firstBallHitThisTurn.id !== act[0]) {
                actionStr += `Foul! `; gameState = "PLACING_CUE"; keepTurn = false;
            } else if (ballsPocketedThisTurn.length > 0) {
                if (ballsPocketedThisTurn.find(b => b.id === 9)) { gameOver(currentPlayerIndex, "Sank the 9-Ball!"); return; }
                keepTurn = true;
            }
        }
    }

    if (!keepTurn) { currentPlayerIndex = 1 - currentPlayerIndex; actionStr += `Turn -> ${players[currentPlayerIndex].name}.`; }
    lastActionText = actionStr; updateUI(); checkAITurn();
}

function updateUI() {
    UI.turnDisplay.innerText = `${players[currentPlayerIndex].name}'s Turn`;
    UI.turnDisplay.style.color = currentPlayerIndex === 0 ? "#7aa2f7" : "#f7768e";
    
    if (mode === '8ball' || mode === 'blackball') {
        if (isTableOpen) UI.suitDisplay.innerText = "Table is Open";
        else {
            let p1b, p2b;
            if (mode === '8ball') {
                p1b = p1Suit==='solid'?'<span class="badge badge-solid">Solids</span>':'<span class="badge badge-stripe">Stripes</span>';
                p2b = p2Suit==='solid'?'<span class="badge badge-solid">Solids</span>':'<span class="badge badge-stripe">Stripes</span>';
            } else {
                p1b = p1Suit==='red'?'<span class="badge badge-red">Reds</span>':'<span class="badge badge-yellow">Yellows</span>';
                p2b = p2Suit==='red'?'<span class="badge badge-red">Reds</span>':'<span class="badge badge-yellow">Yellows</span>';
            }
            UI.suitDisplay.innerHTML = `P1: ${p1b} | P2: ${p2b}`;
        }
    } else if (mode === 'snooker') {
        let tg = snookerTarget === 'red' ? '<span class="badge badge-snooker">Reds</span>' : '<span class="badge badge-stripe">Colors</span>';
        UI.suitDisplay.innerHTML = `Scores: P1(${players[0].score}) - P2(${players[1].score})<br>Target: ${tg}`;
    } else {
        UI.suitDisplay.innerText = "Aim for the lowest number.";
    }
    UI.actionLog.innerText = lastActionText;
}

// --- COMMUNICATION BRIDGE ---
UI.btnPush.addEventListener('click', () => {
    let rpText = UI.midRp.value.trim();
    let msg = `\`[${mode.toUpperCase()}] ${lastActionText}\``;
    if (rpText) msg += `\n${rpText}`;
    STBridge.sendMessage(msg, null); UI.midRp.value = "";
});

UI.btnForfeit.addEventListener('click', () => { gameOver(1 - currentPlayerIndex, `${players[currentPlayerIndex].name} forfeited.`); });

function gameOver(winnerIndex, reason) {
    gameState = "SETUP"; panels.game.style.display = 'none'; panels.end.style.display = 'block';
    let winner = players[winnerIndex], loser = players[1 - winnerIndex];
    UI.endStats.innerHTML = `${winner.name} Wins!<br><span style="font-size: 0.7em; color: #a9b1d6;">${reason}</span>`;
    UI.endStats.dataset.winner = winner.name; UI.endStats.dataset.loser = loser.name; UI.endStats.dataset.reason = reason;
}

UI.btnEnd.addEventListener('click', () => {
    let wName = UI.endStats.dataset.winner, lName = UI.endStats.dataset.loser;
    let resultMsg = `\`[${mode.toUpperCase()}] ${wName} won! (${UI.endStats.dataset.reason})\``;
    if (UI.endRp.value.trim()) resultMsg += `\n${UI.endRp.value.trim()}`;
    STBridge.sendMessage(resultMsg, { winners: [wName], losers: [lName] });
    UI.endRp.value = ""; panels.end.style.display = 'none'; panels.setup.style.display = 'block';
});
UI.btnReset.addEventListener('click', () => { panels.end.style.display = 'none'; panels.setup.style.display = 'block'; });