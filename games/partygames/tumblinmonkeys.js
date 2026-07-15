// Data Constants
const COLORS = [
    { hex: '#f7768e', name: 'Red' },
    { hex: '#7aa2f7', name: 'Blue' },
    { hex: '#9ece6a', name: 'Green' },
    { hex: '#e0af68', name: 'Yellow' },
    { hex: '#bb9af7', name: 'Purple' },
    { hex: '#ff9eaf', name: 'Pink' }
];

const RADIUS_BY_LEVEL = [120, 105, 95, 105, 120];
const Y_LEVELS = [80, 140, 200, 260, 320];

// Elements
const setupPanel = document.getElementById('setup-panel');
const gamePanel = document.getElementById('game-panel');
const endPanel = document.getElementById('end-panel');
const btnStart = document.getElementById('btn-start');

// Player Setup Elements
const playerCountSelect = document.getElementById("player-count");
const p3Group = document.getElementById("p3-group");
const p4Group = document.getElementById("p4-group");

const playerListUI = document.getElementById('player-list-ui');
const dieDisplay = document.getElementById('die-display');
const btnRoll = document.getElementById('btn-roll');
const rollControls = document.getElementById('roll-controls');
const stickControls = document.getElementById('stick-controls');
const stickButtonsContainer = document.getElementById('stick-buttons-container');
const eventLog = document.getElementById('event-log');
const canvasSide = document.getElementById('canvas-side');
const canvasTop = document.getElementById('canvas-top');
const ctxSide = canvasSide.getContext('2d');
const ctxTop = canvasTop.getContext('2d');

// State
let players = [];
let currentPlayerIndex = 0;
let sticks = [];
let monkeys = [];
let activeColor = null;
let hoveredStickId = null;

// Dynamic setup menu
playerCountSelect.addEventListener("change", (e) => {
    const count = parseInt(e.target.value);
    p3Group.style.display = count >= 3 ? "block" : "none";
    p4Group.style.display = count === 4 ? "block" : "none";
});

// Initialization
btnStart.addEventListener('click', () => {
    const count = parseInt(playerCountSelect.value);
    players = [];
    
    // Player 1 is always the User (Human)
    players.push({ name: "{{user}}", type: "human", score: 0 });
    
    // Opponent 1
    let p2Name = document.getElementById("p2-name").value.trim() || "Opponent 1";
    players.push({ name: p2Name, type: "ai", score: 0 });
    
    // Opponent 2
    if (count >= 3) {
        let p3Name = document.getElementById("p3-name").value.trim() || "Opponent 2";
        players.push({ name: p3Name, type: "ai", score: 0 });
    }
    
    // Opponent 3
    if (count === 4) {
        let p4Name = document.getElementById("p4-name").value.trim() || "Opponent 3";
        players.push({ name: p4Name, type: "ai", score: 0 });
    }
    
    currentPlayerIndex = 0;
    setupGame();
    
    setupPanel.style.display = 'none';
    gamePanel.style.display = 'block';
});

function setupGame() {
    sticks = [];
    monkeys = [];
    
    // Generate Sticks (30 total, 5 of each color, 6 per level)
    let colorPool = [];
    COLORS.forEach(c => { for(let i=0; i<5; i++) colorPool.push(c); });
    colorPool.sort(() => Math.random() - 0.5); // Shuffle

    let stickId = 0;
    for (let l = 0; l < 5; l++) {
        let r = RADIUS_BY_LEVEL[l];
        for (let s = 0; s < 6; s++) {
            // Generate two random angles ensuring it crosses the tree reasonably well
            let a1, a2, dist;
            do {
                a1 = Math.random() * Math.PI * 2;
                a2 = a1 + (Math.random() * 1.5 + 0.5) * Math.PI/2; // Angle difference to ensure length
                let x1 = r * Math.cos(a1), z1 = r * Math.sin(a1);
                let x2 = r * Math.cos(a2), z2 = r * Math.sin(a2);
                dist = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
            } while (dist < r * 1.2); // Stick must be at least somewhat long
            
            let colorObj = colorPool.pop();
            sticks.push({
                id: stickId++,
                level: l,
                colorObj: colorObj,
                x1: r * Math.cos(a1), z1: r * Math.sin(a1),
                x2: r * Math.cos(a2), z2: r * Math.sin(a2),
                active: true
            });
        }
    }

    // Initial Monkey Pour
    eventLog.innerText = "Pouring monkeys into the tree... Please wait.";
    render();
    
    setTimeout(() => {
        for(let i=0; i<30; i++) {
            monkeys.push({ id: i, x: 0, z: 0, level: -1, state: 'falling', stickId: null });
        }
        
        let unplaced = monkeys.slice();
        let loopCount = 0;
        
        while(unplaced.length > 0 && loopCount < 50) {
            unplaced.forEach(m => {
                let r = Math.random() * 80; // Keep them towards center initially
                let theta = Math.random() * Math.PI * 2;
                m.x = r * Math.cos(theta);
                m.z = r * Math.sin(theta);
                m.level = -1;
                m.state = 'falling';
                m.stickId = null;
            });
            
            simulateFalls(unplaced);
            unplaced = monkeys.filter(m => m.state === 'dropped');
            loopCount++;
        }
        
        // Force catch stragglers to prevent infinite loop setup
        unplaced.forEach(m => {
            let activeSticks = sticks.filter(s => s.active);
            let s = activeSticks[Math.floor(Math.random() * activeSticks.length)];
            m.level = s.level;
            m.stickId = s.id;
            m.state = 'resting';
            m.x = (s.x1 + s.x2)/2 + (Math.random()-0.5)*10;
            m.z = (s.z1 + s.z2)/2 + (Math.random()-0.5)*10;
        });
        
        eventLog.innerText = `All 30 monkeys caught in the tree! It's ${players[currentPlayerIndex].name}'s turn.`;
        updateUI();
        processTurn();
    }, 500);
}

// ------------------------------------
// PHYSICS ENGINE
// ------------------------------------
function distToSegment(px, pz, x1, z1, x2, z2) {
    let l2 = (x2 - x1)**2 + (z2 - z1)**2;
    if (l2 == 0) return Math.sqrt((px-x1)**2 + (pz-z1)**2);
    let t = ((px - x1)*(x2 - x1) + (pz - z1)*(z2 - z1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((px - (x1 + t*(x2 - x1)))**2 + (pz - (z1 + t*(z2 - z1)))**2);
}

function simulateFalls(fallingMonkeys) {
    let events = { caught: 0, knocked: 0, fellOut: 0, bounces: 0 };
    let activeFalling = [...fallingMonkeys];

    while(activeFalling.length > 0) {
        let m = activeFalling.shift();
        let nextLevel = m.level + 1;
        
        if (nextLevel > 4) {
            events.fellOut++;
            m.state = 'dropped';
            m.level = 5;
            continue;
        }

        let caught = false;
        let levelSticks = sticks.filter(s => s.active && s.level === nextLevel);
        
        for (let s of levelSticks) {
            let dist = distToSegment(m.x, m.z, s.x1, s.z1, s.x2, s.z2);
            if (dist < 18) { // Proximity
                let r = Math.random();
                if (r < 0.35) { // Catch Rest
                    m.level = nextLevel; m.state = 'resting'; m.stickId = s.id;
                    caught = true; events.caught++; break;
                } else if (r < 0.70) { // Catch Hang
                    m.level = nextLevel; m.state = 'hanging'; m.stickId = s.id;
                    caught = true; events.caught++; break;
                } else { // Bounce
                    m.x += (Math.random() - 0.5) * 40;
                    m.z += (Math.random() - 0.5) * 40;
                    
                    let currentR = RADIUS_BY_LEVEL[nextLevel];
                    let distC = Math.sqrt(m.x*m.x + m.z*m.z);
                    if (distC > currentR) {
                        m.x = (m.x/distC) * (currentR - 5);
                        m.z = (m.z/distC) * (currentR - 5);
                    }
                    events.bounces++;
                    break;
                }
            }
        }

        if (!caught) {
            // Check knocking other monkeys
            let rests = monkeys.filter(other => other.level === nextLevel && other.state !== 'dropped' && other.id !== m.id);
            for (let other of rests) {
                let d = Math.sqrt((m.x - other.x)**2 + (m.z - other.z)**2);
                if (d < 15 && Math.random() < 0.4) {
                    other.state = 'falling';
                    other.stickId = null;
                    activeFalling.push(other);
                    events.knocked++;
                    break;
                }
            }
            m.level = nextLevel;
            activeFalling.push(m);
        }
    }
    return events;
}

// ------------------------------------
// GAMEPLAY LOOP
// ------------------------------------
function updateUI() {
    playerListUI.innerHTML = "";
    players.forEach((p, i) => {
        let div = document.createElement('div');
        div.className = `player-row ${i === currentPlayerIndex ? 'active' : ''}`;
        div.innerHTML = `<span>${p.name}</span> <span class="player-score">${p.score} 🐒</span>`;
        playerListUI.appendChild(div);
    });
    render();
}

function processTurn() {
    let p = players[currentPlayerIndex];
    activeColor = null;
    dieDisplay.style.backgroundColor = '#24283b';
    dieDisplay.style.color = '#fff';
    dieDisplay.innerText = "?";
    
    stickControls.style.display = 'none';
    rollControls.style.display = 'block';
    btnRoll.disabled = (p.type === 'ai');
    
    if (p.type === 'ai') {
        setTimeout(() => executeRoll(), 1000);
    }
}

btnRoll.addEventListener('click', executeRoll);

function executeRoll() {
    rollControls.style.display = 'none';
    dieDisplay.classList.add('rolling');
    
    setTimeout(() => {
        dieDisplay.classList.remove('rolling');
        
        let availableColors = [...new Set(sticks.filter(s => s.active).map(s => s.colorObj))];
        if (availableColors.length === 0) {
            endGame();
            return;
        }
        
        let chosenColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        activeColor = chosenColor;
        
        dieDisplay.style.backgroundColor = chosenColor.hex;
        dieDisplay.style.color = '#1a1b26';
        dieDisplay.innerText = "";
        eventLog.innerText = `${players[currentPlayerIndex].name} rolled ${chosenColor.name}!`;
        
        promptStickPull();
    }, 600);
}

function promptStickPull() {
    let p = players[currentPlayerIndex];
    let validSticks = sticks.filter(s => s.active && s.colorObj.hex === activeColor.hex);
    
    if (validSticks.length === 0) {
        // Should not happen due to availableColors check, but fallback
        executeRoll(); 
        return;
    }
    
    if (p.type === 'human') {
        stickButtonsContainer.innerHTML = "";
        validSticks.forEach(s => {
            let btn = document.createElement('button');
            btn.className = 'stick-btn';
            btn.style.borderLeft = `8px solid ${s.colorObj.hex}`;
            
            // Count monkeys on it
            let mCount = monkeys.filter(m => m.stickId === s.id).length;
            btn.innerHTML = `Level ${s.level + 1} <span>${mCount} 🐒 on it</span>`;
            
            btn.onmouseenter = () => { hoveredStickId = s.id; render(); };
            btn.onmouseleave = () => { hoveredStickId = null; render(); };
            btn.onclick = () => pullStick(s);
            
            stickButtonsContainer.appendChild(btn);
        });
        stickControls.style.display = 'block';
    } else {
        // AI Logic
        setTimeout(() => {
            let best = getAIBestStick(validSticks);
            pullStick(best);
        }, 1500);
    }
}

function getAIBestStick(validSticks) {
    let bestScore = -Infinity;
    let best = null;
    
    for (let s of validSticks) {
        let mOnIt = monkeys.filter(m => m.stickId === s.id).length;
        let sBelow = sticks.filter(other => other.active && other.level > s.level).length;
        
        // Want fewer monkeys directly on it, but higher up so there are catching sticks
        let score = (sBelow * 1.5) - (mOnIt * 10) - (s.level * 2);
        
        // Add tiny randomness
        score += Math.random() * 2;
        
        if (score > bestScore) {
            bestScore = score;
            best = s;
        }
    }
    return best || validSticks[0];
}

function pullStick(stick) {
    stickControls.style.display = 'none';
    hoveredStickId = null;
    stick.active = false;
    
    let falling = monkeys.filter(m => m.stickId === stick.id);
    falling.forEach(m => { m.state = 'falling'; m.stickId = null; });
    
    let initialDrop = falling.length;
    let events = simulateFalls(falling);
    
    players[currentPlayerIndex].score += events.fellOut;
    
    let logStr = `${players[currentPlayerIndex].name} pulled a ${stick.colorObj.name} stick on Level ${stick.level+1}.`;
    if (initialDrop > 0) {
        logStr += ` ${initialDrop} monkey(s) fell!`;
        if (events.knocked > 0) logStr += ` Knocked ${events.knocked} loose.`;
        if (events.caught > 0) logStr += ` ${events.caught} were caught below.`;
        if (events.fellOut > 0) logStr += ` ${events.fellOut} dropped completely!`;
    } else {
        logStr += ` Phew, no monkeys fell.`;
    }
    eventLog.innerText = logStr;
    
    updateUI();
    
    // Check end condition (no sticks left, or all monkeys dropped)
    let activeSticks = sticks.filter(s => s.active).length;
    let monkeysLeft = monkeys.filter(m => m.state !== 'dropped').length;
    
    if (activeSticks === 0 || monkeysLeft === 0) {
        setTimeout(endGame, 2000);
    } else {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        setTimeout(processTurn, 2000);
    }
}

// ------------------------------------
// RENDERING
// ------------------------------------
function render() {
    ctxSide.clearRect(0,0,300,400);
    ctxTop.clearRect(0,0,300,300);
    
    // Side View Base Tree
    ctxSide.fillStyle = 'rgba(224, 175, 104, 0.15)'; // Yellow transparent
    ctxSide.beginPath();
    ctxSide.moveTo(150 - RADIUS_BY_LEVEL[0], Y_LEVELS[0] - 20);
    for(let l=0; l<5; l++) {
        ctxSide.lineTo(150 - RADIUS_BY_LEVEL[l], Y_LEVELS[l]);
    }
    ctxSide.lineTo(150 + RADIUS_BY_LEVEL[4], Y_LEVELS[4]);
    for(let l=4; l>=0; l--) {
        ctxSide.lineTo(150 + RADIUS_BY_LEVEL[l], Y_LEVELS[l]);
    }
    ctxSide.closePath();
    ctxSide.fill();
    ctxSide.strokeStyle = '#565f89'; ctxSide.stroke();
    
    // Leaves at top
    ctxSide.fillStyle = 'rgba(158, 206, 106, 0.6)';
    ctxSide.beginPath(); ctxSide.ellipse(150, 60, 130, 40, 0, 0, Math.PI*2); ctxSide.fill();

    // Top View Base Circles
    ctxTop.strokeStyle = 'rgba(224, 175, 104, 0.3)';
    RADIUS_BY_LEVEL.forEach(r => {
        ctxTop.beginPath(); ctxTop.arc(150, 150, r, 0, Math.PI*2); ctxTop.stroke();
    });
    ctxTop.fillStyle = 'rgba(158, 206, 106, 0.2)';
    ctxTop.beginPath(); ctxTop.arc(150, 150, RADIUS_BY_LEVEL[0], 0, Math.PI*2); ctxTop.fill();

    // Draw Sticks
    sticks.filter(s => s.active).forEach(s => {
        let isHover = hoveredStickId === s.id;
        
        // Side
        ctxSide.strokeStyle = s.colorObj.hex;
        ctxSide.lineWidth = isHover ? 6 : 3;
        ctxSide.globalAlpha = isHover ? 1.0 : 0.8;
        ctxSide.beginPath();
        ctxSide.moveTo(150 + s.x1, Y_LEVELS[s.level]);
        ctxSide.lineTo(150 + s.x2, Y_LEVELS[s.level]);
        ctxSide.stroke();
        
        // Top
        ctxTop.strokeStyle = s.colorObj.hex;
        ctxTop.lineWidth = isHover ? 6 : 3;
        ctxTop.beginPath();
        ctxTop.moveTo(150 + s.x1, 150 + s.z1);
        ctxTop.lineTo(150 + s.x2, 150 + s.z2);
        ctxTop.stroke();
    });
    ctxSide.globalAlpha = 1.0;
    ctxTop.globalAlpha = 1.0;

    // Draw Monkeys
    monkeys.filter(m => m.state !== 'dropped').forEach(m => {
        // Side
        let y = m.level === -1 ? 60 : Y_LEVELS[m.level];
        if (m.state === 'resting') y -= 6;
        if (m.state === 'hanging') y += 6;
        
        ctxSide.fillStyle = '#8B4513';
        ctxSide.beginPath(); ctxSide.arc(150 + m.x, y, 5, 0, Math.PI*2); ctxSide.fill();
        ctxSide.strokeStyle = '#3e1e07'; ctxSide.lineWidth = 1; ctxSide.stroke();
        
        // Top
        ctxTop.fillStyle = '#8B4513';
        ctxTop.beginPath(); ctxTop.arc(150 + m.x, 150 + m.z, 5, 0, Math.PI*2); ctxTop.fill();
        ctxTop.stroke();
    });
}

// ------------------------------------
// SILLY TAVERN BRIDGE
// ------------------------------------
document.getElementById('btn-push-mid').addEventListener('click', () => {
    let summary = players.map(p => `${p.name}: ${p.score} dropped`).join(" | ");
    let statusText = `\`Tumblin' Monkeys - Score: ${summary}. It is currently ${players[currentPlayerIndex].name}'s turn.\``;
    
    let customText = document.getElementById('mid-push-text').value.trim();
    if (customText) statusText += `\n${customText}`;
    
    STBridge.sendMessage(statusText);
    document.getElementById('mid-push-text').value = "";
});

function endGame() {
    gamePanel.style.display = 'none';
    
    // Sort players by lowest score
    let sorted = [...players].sort((a,b) => a.score - b.score);
    let highestScore = sorted[sorted.length-1].score;
    let losers = sorted.filter(p => p.score === highestScore);
    
    let endHTML = `<strong>Final Scores:</strong><br>`;
    sorted.forEach(p => { endHTML += `${p.name}: ${p.score} monkeys<br>`; });
    
    let loserNames = losers.map(l => l.name).join(' and ');
    endHTML += `<br><span style="color: #f7768e; font-weight:bold;">${loserNames} dropped the most monkeys and lost!</span>`;
    
    document.getElementById('end-stats').innerHTML = endHTML;
    endPanel.style.display = 'block';
}

document.getElementById('btn-confirm-end').addEventListener('click', () => {
    let sorted = [...players].sort((a,b) => a.score - b.score);
    let highestScore = sorted[sorted.length-1].score;
    let losers = sorted.filter(p => p.score === highestScore).map(l => l.name);
    
    let report = `\`Game over! ${losers.join(' and ')} dropped the most monkeys and lost!\``;
    
    let rpText = document.getElementById('end-rp-text').value.trim();
    if (rpText) report += `\n${rpText}`;
    
    STBridge.sendMessage(report, { losers: losers });
    
    document.getElementById('end-rp-text').value = "";
    endPanel.style.display = 'none';
    setupPanel.style.display = 'block';
});

document.getElementById('btn-no-push').addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('btn-cancel-end').addEventListener('click', () => {
    endPanel.style.display = 'none';
    setupPanel.style.display = 'block';
});