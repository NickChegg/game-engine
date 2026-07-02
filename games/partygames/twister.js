// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const refereeNameInput = document.getElementById("referee-name");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const turnIndicator = document.getElementById("turn-indicator");
const btnSpin = document.getElementById("btn-spin");
const playerStatsUI = document.getElementById("player-stats-ui");

const eventBox = document.getElementById("event-box");
const eventTitle = document.getElementById("event-title");
const eventDesc = document.getElementById("event-desc");
const eventRpText = document.getElementById("event-rp-text");
const btnResolveEvent = document.getElementById("btn-resolve-event");

const turnPushBox = document.getElementById("turn-push-box");
const turnRpText = document.getElementById("turn-rp-text");
const btnPushTurn = document.getElementById("btn-push-turn");
const btnSkipTurn = document.getElementById("btn-skip-turn");

const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");

const canvas = document.getElementById("twister-canvas");
const ctx = canvas.getContext("2d");

// Game Constants
const COLS = 4;
const ROWS = 6;
const CELL_W = 100;
const CELL_H = 100;
const COL_COLORS = ["#9ece6a", "#e0af68", "#7aa2f7", "#f7768e"];
const COL_NAMES = ["Green", "Yellow", "Blue", "Red"];
const LIMB_NAMES = { "LF": "Left Foot", "RF": "Right Foot", "LH": "Left Hand", "RH": "Right Hand" };
const PLAYER_COLORS = ["#111111", "#ff00ff", "#00bcd4"]; 

// State
let players = [];
let mat = []; 
let currentCommand = null; 
let refCommandStr = ""; // Persists the command on screen
let gameState = "WAITING_SPIN"; 
let currentEvent = null; 
let roundCount = 0;
let roundActions = []; 
let resolveQueue = []; 

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
            row.style.borderColor = PLAYER_COLORS[i];
            
            row.innerHTML = `
                <div class="flex-row">
                    <div class="input-group" style="flex:2; margin-bottom:0;">
                        <label class="input-label">Player ${i+1}</label>
                        <input type="text" class="text-input p-name" ${i === 0 ? 'value="{{user}}"' : `placeholder="Name"`}>
                    </div>
                    <div class="input-group" style="flex:1; margin-bottom:0;">
                        <label class="input-label">Athleticism (0-10)</label>
                        <input type="number" class="num-input p-ath" value="5" min="0" max="10" step="0.1">
                    </div>
                </div>
                <div class="input-group" style="margin-top: 10px; margin-bottom: 0;">
                    <select class="select-input p-type">
                        <option value="user">User Operated</option>
                        <option value="ai" ${i !== 0 ? 'selected' : ''}>AI Driven</option>
                    </select>
                </div>
            `;
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
    mat = [];
    for(let c=0; c<COLS; c++) {
        mat[c] = [];
        for(let r=0; r<ROWS; r++) mat[c][r] = null;
    }

    players = [];
    let cards = document.querySelectorAll(".p-setup-card");
    cards.forEach((card, idx) => {
        let name = card.querySelector(".p-name").value.trim() || `Player ${idx+1}`;
        let athRaw = parseFloat(card.querySelector(".p-ath").value) || 0;
        let ath = athRaw === 0 ? 0.5 : athRaw;
        
        // Speed Math
        let speedSecs = 3 - ((ath - 0.5) / 9.5) * 2.8; 
        
        // Fatigue Rate Math (10 ath = 0.5% loss, 0.5 ath = 1.5% loss)
        let fRate = 1.5 - ((ath - 0.5) / 9.5) * 1.0;
        
        let p = {
            id: idx, name: name, color: PLAYER_COLORS[idx],
            isUser: card.querySelector(".p-type").value === "user",
            ath: ath, moveTime: speedSecs * 1000, fatigueRate: fRate,
            fatigue: 0, balance: 100, active: true, crossedLimbs: 0,
            limbs: { LF: null, RF: null, LH: null, RH: null },
            geom: { pelvis: null, shoulders: null, head: null, overlaps: [], limbSegs: [], headProx: [] },
            pendingMove: null
        };
        players.push(p);
    });

    // P1: Bottom
    placeLimb(players[0], "LF", 1, 5); 
    placeLimb(players[0], "RF", 2, 5); 
    
    // P2: Top (Row 1 so head doesn't clip off the screen)
    placeLimb(players[1], "LF", 1, 0); 
    placeLimb(players[1], "RF", 2, 0); 

    // P3: Middle
    if (players.length > 2) {
        placeLimb(players[2], "LF", 3, 2); 
        placeLimb(players[2], "RF", 3, 3); 
    }

    gameState = "WAITING_SPIN";
    roundCount = 0;
    
    updateGeometryAndBalance();
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    document.querySelector(".main-panel").style.display = "block"; // Ensure visible
    
    drawMat();
});

function placeLimb(p, limbName, c, r) {
    if (p.limbs[limbName]) {
        mat[p.limbs[limbName].c][p.limbs[limbName].r] = null;
    }
    p.limbs[limbName] = { c, r };
    mat[c][r] = p;
}

function isValidSpot(p, limb, c, r) {
    if (mat[c][r] === null) return true;
    // Exception: Exact same limb being repositioned on the same dot
    if (mat[c][r].id === p.id && p.limbs[limb] && p.limbs[limb].c === c && p.limbs[limb].r === r) return true;
    return false;
}

function getDotCenter(c, r) { return { x: c * CELL_W + 50, y: r * CELL_H + 50 }; }

function getLimbOnSpot(c, r) {
    let p = mat[c][r];
    if (!p) return "Body Part";
    for (let l in p.limbs) {
        if (p.limbs[l] && p.limbs[l].c === c && p.limbs[l].r === r) return LIMB_NAMES[l];
    }
    return "Body Part";
}

// ==========================================
// 3. SPIN LOGIC & SIMULTANEOUS QUEUE
// ==========================================
btnSpin.addEventListener("click", () => {
    players.forEach(p => { if (p.active) p.fatigue += p.fatigueRate; });
    roundCount++;
    
    let validSpin = false;
    let rCol, rLimb;
    let attempts = 0;
    
    while (!validSpin && attempts < 50) {
        attempts++;
        rCol = Math.floor(Math.random() * 4);
        let limbKeys = Object.keys(LIMB_NAMES);
        rLimb = limbKeys[Math.floor(Math.random() * limbKeys.length)];
        
        let emptyCount = 0;
        for(let r=0; r<ROWS; r++) { if (mat[rCol][r] === null) emptyCount++; }
        if (emptyCount >= players.filter(pl => pl.active).length) validSpin = true;
    }

    currentCommand = { limb: rLimb, colIdx: rCol, colName: COL_NAMES[rCol] };
    
    let refName = refereeNameInput.value.trim() || "The Referee";
    refCommandStr = `<span style="color:#787c99;">${refName} calls:</span> <span style="font-weight:bold;">${LIMB_NAMES[rLimb]} <span style="color:${COL_COLORS[rCol]}">${COL_NAMES[rCol]}</span></span>!`;
    
    turnIndicator.innerHTML = `${refCommandStr}<br><span style="font-size: 0.8em; color: #a9b1d6;">Everyone move!</span>`;
    
    btnSpin.style.display = "none";
    gameState = "TARGETING";
    roundActions = [];
    
    players.forEach(p => {
        if (p.active) {
            p.pendingMove = null;
            if (!p.isUser) aiLockTarget(p);
        }
    });
    
    checkAllTargetsLocked();
});

function aiLockTarget(p) {
    let bestR = -1;
    let bestDist = Infinity;
    let pelX = p.geom.pelvis ? p.geom.pelvis.x : 200; 
    let pelY = p.geom.pelvis ? p.geom.pelvis.y : 300;
    
    for (let r=0; r<ROWS; r++) {
        let cx = (currentCommand.colIdx * CELL_W) + 50;
        let cy = (r * CELL_H) + 50;
        let dist = Math.hypot(cx - pelX, cy - pelY);
        
        if (isValidSpot(p, currentCommand.limb, currentCommand.colIdx, r)) {
            if (dist < bestDist) { bestDist = dist; bestR = r; }
        }
    }
    
    if (bestR !== -1) p.pendingMove = { c: currentCommand.colIdx, r: bestR };
}

canvas.addEventListener("mousedown", (e) => {
    if (gameState !== "TARGETING" && gameState !== "WAITING_USER_FIX") return;
    
    let activeUser = players.find(p => p.active && p.isUser && !p.pendingMove);
    if (!activeUser) return;
    
    let rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    let c = Math.floor(x / CELL_W);
    let r = Math.floor(y / CELL_H);
    
    if (c === currentCommand.colIdx) {
        if (gameState === "TARGETING") {
            if (isValidSpot(activeUser, currentCommand.limb, c, r)) {
                activeUser.pendingMove = { c, r };
                checkAllTargetsLocked();
            }
        } else if (gameState === "WAITING_USER_FIX") {
            if (mat[c][r] === null) {
                activeUser.pendingMove = { c, r };
                gameState = "RESOLVING_QUEUE";
                processResolveQueue();
            }
        }
    }
});

function checkAllTargetsLocked() {
    let allLocked = players.filter(p => p.active).every(p => p.pendingMove !== null);
    if (allLocked) {
        resolveQueue = players.filter(p => p.active).sort((a, b) => b.ath - a.ath);
        gameState = "RESOLVING_QUEUE";
        processResolveQueue();
    } else {
        turnIndicator.innerHTML = `${refCommandStr}<br><span style="font-size: 0.8em; color: #a9b1d6;">Waiting for you to click a ${currentCommand.colName} spot...</span>`;
    }
}

// ==========================================
// 4. QUEUE RESOLUTION & INCIDENTS
// ==========================================
function processResolveQueue() {
    if (resolveQueue.length === 0) {
        updateGeometryAndBalance();
        drawMat();
        
        if (!resolveFalls()) {
            gameState = "TURN_END";
            turnIndicator.innerHTML = `${refCommandStr}<br><span style="font-size: 0.8em; color: #9ece6a;">Round Complete.</span>`;
            turnPushBox.style.display = "block";
        }
        return;
    }

    let p = resolveQueue[0];
    let targetC = p.pendingMove.c;
    let targetR = p.pendingMove.r;

    // A: Mistake Check
    if (p.balance < 50 && Math.random() < 0.3) {
        let adjs = [ {c:targetC, r:targetR-1}, {c:targetC, r:targetR+1}, {c:targetC-1, r:targetR}, {c:targetC+1, r:targetR} ];
        let occ = adjs.filter(a => a.c>=0 && a.c<COLS && a.r>=0 && a.r<ROWS && mat[a.c][a.r] !== null && mat[a.c][a.r].id !== p.id);
        
        if (occ.length > 0) {
            let v = mat[occ[0].c][occ[0].r];
            let vLimb = getLimbOnSpot(occ[0].c, occ[0].r);
            triggerEvent("MISTAKE", `${p.name} places their ${LIMB_NAMES[currentCommand.limb]} on top of ${v.name}'s ${vLimb}! They scramble to fix it.`, () => {
                checkDispute(p, targetC, targetR); 
            });
            return;
        }
    }

    checkDispute(p, targetC, targetR);
}

function checkDispute(p, c, r) {
    if (mat[c][r] !== null && mat[c][r].id !== p.id) {
        let occupant = mat[c][r];
        let occLimb = getLimbOnSpot(c, r);
        
        triggerEvent("DISPUTE", `${p.name} tried to place their ${LIMB_NAMES[currentCommand.limb]} on ${occupant.name}'s ${occLimb}, but ${occupant.name} grabbed the spot first! ${p.name} must pick another.`, () => {
            p.pendingMove = null;
            if (p.isUser) {
                gameState = "WAITING_USER_FIX";
                turnIndicator.innerHTML = `${refCommandStr}<br><span style="font-size: 0.8em; color: #f7768e;">${p.name}, pick a NEW ${currentCommand.colName} spot!</span>`;
            } else {
                aiLockTarget(p); 
                gameState = "RESOLVING_QUEUE";
                processResolveQueue(); 
            }
        });
        return;
    }

    resolveQueue.shift(); 
    placeLimb(p, currentCommand.limb, c, r);
    roundActions.push(`\`${p.name} moved ${LIMB_NAMES[currentCommand.limb]} to ${currentCommand.colName}.\``);
    updateGeometryAndBalance();
    drawMat();
    
    // C: Bump Check
    if (p.balance < 25 && p.geom.overlaps.length > 0 && Math.random() < 0.4) {
        let vName = p.geom.overlaps[0];
        let v = players.find(pl => pl.name === vName);
        if (v) v.balance -= 5;
        p.balance -= 5;
        triggerEvent("BUMP", `${p.name} stumbles and bumps their body into ${vName}! Both lose balance.`, () => processResolveQueue());
        return;
    }
    
    processResolveQueue();
}

function resolveFalls() {
    let fallers = players.filter(p => p.active && p.balance <= 0);
    if (fallers.length === 0) return false;

    let fallMsgs = [];
    
    fallers.forEach(f => {
        f.active = false;
        
        let l = f.limbs;
        if (l.LF) mat[l.LF.c][l.LF.r] = null;
        if (l.RF) mat[l.RF.c][l.RF.r] = null;
        if (l.LH) mat[l.LH.c][l.LH.r] = null;
        if (l.RH) mat[l.RH.c][l.RH.r] = null;
        
        let impactMsg = "";
        f.geom.overlaps.forEach(vName => {
            let v = players.find(pl => pl.name === vName && pl.active);
            if (v) {
                v.balance -= 30;
                if (v.balance <= 0) {
                    impactMsg += `crashes into ${v.name}, bringing them down as well! `;
                    v.active = false; 
                } else {
                    impactMsg += `crashes into ${v.name}, but ${v.name} keeps their balance! `;
                }
            }
        });
        
        let msg = `${f.name} lost their balance and FELL!`;
        if (impactMsg) msg += ` They ${impactMsg}`;
        fallMsgs.push(msg.trim());
    });
    
    updateGeometryAndBalance();
    drawMat();
    
    triggerEvent("FALL", fallMsgs.join("\n"), () => {
        let activeCount = players.filter(pl => pl.active).length;
        if (activeCount <= 1) {
            endGame();
        } else {
            if (!resolveFalls()) advanceToSpin();
        }
    });
    
    return true;
}

function advanceToSpin() {
    turnPushBox.style.display = "none";
    gameState = "WAITING_SPIN";
    turnIndicator.innerHTML = `Awaiting Spin...`;
    btnSpin.style.display = "block";
}

// ==========================================
// 5. EVENT SYSTEM (PAUSING FOR RP)
// ==========================================
function triggerEvent(title, desc, callback) {
    let previousState = gameState;
    gameState = "EVENT_PAUSE";
    currentEvent = { callback, previousState };
    
    eventTitle.innerText = title;
    eventDesc.innerText = desc;
    eventBox.style.display = "block";
}

btnResolveEvent.addEventListener("click", () => {
    let rp = eventRpText.value.trim();
    let pushStr = `<Twister Incident: ${eventDesc.innerText}>`;
    if (rp) pushStr += `\n${rp}`;
    
    STBridge.sendMessage(pushStr);
    
    eventRpText.value = "";
    eventBox.style.display = "none";
    
    if (currentEvent && currentEvent.callback) {
        gameState = currentEvent.previousState;
        currentEvent.callback();
    }
});

btnPushTurn.addEventListener("click", pushTurnToChat);
btnSkipTurn.addEventListener("click", advanceToSpin);

function pushTurnToChat() {
    let stateArray = players.filter(p => p.active).map(p => {
        let cStr = p.crossedLimbs > 0 ? ` (${p.crossedLimbs} crossed limbs)` : "";
        return `${p.name} Balance: ${Math.floor(p.balance)}%${cStr}`;
    });
    
    let overlapArray = players.filter(p => p.active && p.geom.overlaps.length > 0).map(p => `${p.name} overlapping ${p.geom.overlaps.join(", ")}`);
    let headArray = players.filter(p => p.active && p.geom.headProx.length > 0).map(p => `${p.name}'s Head near ${p.geom.headProx.join(", ")}`);
    
    let pushStr = `<Twister State: ${stateArray.join(" | ")}. Overlaps: ${overlapArray.join(" | ") || "None"}. ${headArray.join(" | ")}>\n${roundActions.join("\n")}`;
    
    let rp = turnRpText.value.trim();
    if (rp) pushStr += `\n${rp}`;
    
    STBridge.sendMessage(pushStr);
    turnRpText.value = "";
    advanceToSpin();
}

// ==========================================
// 6. KINEMATICS & MATH (PROXIMITY LOGIC)
// ==========================================
function ccw(A, B, C) { return (C.y-A.y) * (B.x-A.x) > (B.y-A.y) * (C.x-A.x); }
function intersect(A, B, C, D) { return ccw(A,C,D) !== ccw(B,C,D) && ccw(A,B,C) !== ccw(A,B,D); }

function distToSegment(p, v, w) {
    let l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return { dist2: (p.x - v.x)**2 + (p.y - v.y)**2, t: 0 };
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    let dist2 = (p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2;
    return { dist2, t };
}

function getSegmentProximityName(t) {
    if (t < 0.33) return "Pelvis";
    if (t > 0.66) return "Chest";
    return "Stomach";
}

function updateGeometryAndBalance() {
    players.forEach(p => {
        if (!p.active) return;
        p.geom.limbSegs = [];
        let l = p.limbs;
        
        let lfPos = l.LF ? getDotCenter(l.LF.c, l.LF.r) : null;
        let rfPos = l.RF ? getDotCenter(l.RF.c, l.RF.r) : null;
        let lhPos = l.LH ? getDotCenter(l.LH.c, l.LH.r) : null;
        let rhPos = l.RH ? getDotCenter(l.RH.c, l.RH.r) : null;
        
        let feetAvg = null, handsAvg = null;
        if (lfPos && rfPos) feetAvg = { x: (lfPos.x + rfPos.x)/2, y: (lfPos.y + rfPos.y)/2 };
        else if (lfPos) feetAvg = lfPos; else if (rfPos) feetAvg = rfPos;
        
        if (lhPos && rhPos) handsAvg = { x: (lhPos.x + rhPos.x)/2, y: (lhPos.y + rhPos.y)/2 };
        else if (lhPos) handsAvg = lhPos; else if (rhPos) handsAvg = rhPos;

        if (!feetAvg) feetAvg = { x: 200, y: 300 }; 

        if (handsAvg) {
            let dx = handsAvg.x - feetAvg.x;
            let dy = handsAvg.y - feetAvg.y;
            p.geom.pelvis = { x: feetAvg.x + dx * 0.3, y: feetAvg.y + dy * 0.3 };
            p.geom.shoulders = { x: feetAvg.x + dx * 0.7, y: feetAvg.y + dy * 0.7 };
        } else {
            // Force completely vertical orientation (Head above feet)
            p.geom.pelvis = { x: feetAvg.x, y: feetAvg.y - 15 };
            p.geom.shoulders = { x: feetAvg.x, y: feetAvg.y - 95 };
        }

        let angle = Math.atan2(p.geom.shoulders.y - p.geom.pelvis.y, p.geom.shoulders.x - p.geom.pelvis.x);
        let lx = Math.cos(angle - Math.PI/2) * 15; let ly = Math.sin(angle - Math.PI/2) * 15;
        let rx = Math.cos(angle + Math.PI/2) * 15; let ry = Math.sin(angle + Math.PI/2) * 15;
        
        p.geom.pelLeft = {x: p.geom.pelvis.x + lx, y: p.geom.pelvis.y + ly};
        p.geom.pelRight = {x: p.geom.pelvis.x + rx, y: p.geom.pelvis.y + ry};
        p.geom.shLeft = {x: p.geom.shoulders.x + lx, y: p.geom.shoulders.y + ly};
        p.geom.shRight = {x: p.geom.shoulders.x + rx, y: p.geom.shoulders.y + ry};

        if (lfPos) p.geom.limbSegs.push({name: "LF", p1: p.geom.pelLeft, p2: lfPos});
        if (rfPos) p.geom.limbSegs.push({name: "RF", p1: p.geom.pelRight, p2: rfPos});
        if (lhPos) p.geom.limbSegs.push({name: "LH", p1: p.geom.shLeft, p2: lhPos});
        if (rhPos) p.geom.limbSegs.push({name: "RH", p1: p.geom.shRight, p2: rhPos});

        let tdx = p.geom.shoulders.x - p.geom.pelvis.x;
        let tdy = p.geom.shoulders.y - p.geom.pelvis.y;
        p.geom.head = { x: p.geom.shoulders.x + (tdx * 0.3), y: p.geom.shoulders.y + (tdy * 0.3) };
    });

    players.forEach(p => {
        if (!p.active) return;
        p.crossedLimbs = 0;
        let segs = p.geom.limbSegs;
        for (let i=0; i<segs.length; i++) {
            for (let j=i+1; j<segs.length; j++) {
                if (intersect(segs[i].p1, segs[i].p2, segs[j].p1, segs[j].p2)) p.crossedLimbs++;
            }
        }
    });

    players.forEach(p => p.geom.overlaps = []);
    for (let i=0; i<players.length; i++) {
        for (let j=i+1; j<players.length; j++) {
            let p1 = players[i]; let p2 = players[j];
            if (!p1.active || !p2.active) continue;
            
            let overlap = false;
            if (Math.hypot(p1.geom.head.x - p2.geom.head.x, p1.geom.head.y - p2.geom.head.y) < 60) overlap = true;
            if (Math.hypot(p1.geom.pelvis.x - p2.geom.pelvis.x, p1.geom.pelvis.y - p2.geom.pelvis.y) < 80) overlap = true;
            
            if (overlap) { p1.geom.overlaps.push(p2.name); p2.geom.overlaps.push(p1.name); }
        }
    }

    players.forEach(p => {
        if (!p.active) return;
        p.geom.headProx = [];
        players.forEach(o => {
            if (o.id === p.id || !o.active) return;
            if (Math.hypot(p.geom.head.x - o.geom.head.x, p.geom.head.y - o.geom.head.y) < 50) p.geom.headProx.push(`${o.name}'s Head`);
            
            let { dist2, t } = distToSegment(p.geom.head, o.geom.pelvis, o.geom.shoulders);
            if (Math.sqrt(dist2) < 40) p.geom.headProx.push(`${o.name}'s ${getSegmentProximityName(t)}`);
            
            o.geom.limbSegs.forEach(seg => {
                let sMath = distToSegment(p.geom.head, seg.p1, seg.p2);
                if (Math.sqrt(sMath.dist2) < 30) p.geom.headProx.push(`${o.name}'s ${LIMB_NAMES[seg.name]}`);
            });
        });
        p.geom.headProx = [...new Set(p.geom.headProx)]; 
    });

    players.forEach(p => {
        if (!p.active) return;
        let maxBal = 100 - p.fatigue;
        let overlapPen = p.geom.overlaps.length * 10;
        let crossPen = p.crossedLimbs * 20; 
        
        let stretch = 0;
        let dist = Math.hypot(p.geom.pelvis.x - p.geom.shoulders.x, p.geom.pelvis.y - p.geom.shoulders.y);
        if (dist > 150) stretch = (dist - 150) * 0.4;
        
        p.balance = Math.max(0, maxBal - overlapPen - crossPen - stretch);
    });

    playerStatsUI.innerHTML = "";
    players.forEach(p => {
        if (p.active) {
            let color = p.balance < 25 ? "#f7768e" : (p.balance < 50 ? "#e0af68" : "#9ece6a");
            let cStr = p.crossedLimbs > 0 ? ` <span style="color:#e0af68; font-size:0.8em;">(Crossed)</span>` : "";
            playerStatsUI.innerHTML += `<div style="display:flex; justify-content:space-between; font-size:0.9em; padding:5px; border-bottom:1px solid #24283b;">
                <span style="color:${p.color}; font-weight:bold; text-shadow: 1px 1px 0 #000;">${p.name}${cStr}</span>
                <span style="color:${color};">${Math.floor(p.balance)}%</span>
            </div>`;
        }
    });
}

// ==========================================
// 7. DRAWING MAT & STICK FIGURES
// ==========================================
function drawMat() {
    ctx.clearRect(0, 0, 400, 600);
    
    for(let c=0; c<COLS; c++) {
        for(let r=0; r<ROWS; r++) {
            ctx.beginPath();
            ctx.arc((c*CELL_W) + 50, (r*CELL_H) + 50, 30, 0, Math.PI*2);
            ctx.fillStyle = COL_COLORS[c];
            ctx.fill();
            ctx.strokeStyle = "#a9b1d6";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    
    players.forEach(p => {
        if (!p.active) return;
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        
        let pel = p.geom.pelvis;
        let sh = p.geom.shoulders;
        let hd = p.geom.head;
        
        if (pel && sh) {
            let angle = Math.atan2(sh.y - pel.y, sh.x - pel.x);
            let dist = Math.hypot(sh.x - pel.x, sh.y - pel.y);
            
            ctx.save();
            ctx.translate(pel.x, pel.y);
            ctx.rotate(angle);
            ctx.fillRect(0, -15, dist, 30);
            ctx.strokeStyle = "#1a1b26";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, -15, dist, 30);
            ctx.restore();
            
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 8;
        }
        
        p.geom.limbSegs.forEach(seg => {
            ctx.beginPath(); ctx.moveTo(seg.p1.x, seg.p1.y); ctx.lineTo(seg.p2.x, seg.p2.y); ctx.stroke();
        });
        
        if (hd) {
            ctx.beginPath(); ctx.arc(hd.x, hd.y, 22, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#1a1b26"; ctx.lineWidth = 2; ctx.stroke(); 
        }
    });
}

// ==========================================
// 8. END GAME
// ==========================================
function endGame() {
    document.querySelector(".main-panel").style.display = "none";
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    
    let winner = players.find(p => p.active);
    let losers = players.filter(p => p.id !== winner.id).map(p => p.name);
    
    endStats.innerHTML = `<span style="color: #9ece6a;">${winner.name} is the last one standing!</span>`;
    
    btnPushEnd.onclick = () => {
        let pushStr = `\`${winner.name} won the game of Twister after ${roundCount} rounds!\``;
        const rp = endRpText.value.trim();
        if (rp) pushStr += `\n${rp}`;
        
        STBridge.sendMessage(pushStr, { losers: losers });
        
        endPhase.style.display = "none";
        document.querySelector(".main-panel").style.display = "flex";
        setupPhase.style.display = "block";
    };
}

btnRestart.addEventListener("click", () => {
    gameControlsPhase.style.display = "none";
    document.querySelector(".main-panel").style.display = "flex";
    setupPhase.style.display = "block";
});