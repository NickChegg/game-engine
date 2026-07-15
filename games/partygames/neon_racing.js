// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const modeSelect = document.getElementById("game-mode");
const distGroup = document.getElementById("dist-group");
const distInput = document.getElementById("race-dist");
const sidesSelect = document.getElementById("game-sides");
const notifsSelect = document.getElementById("game-notifs");
const playerCount = document.getElementById("player-count");
const playersContainer = document.getElementById("players-container");

const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");
const btnMenu = document.getElementById("btn-menu");
const btnPushEnd = document.getElementById("btn-push-end");
const raceStandings = document.getElementById("race-standings");

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const gearDisplay = document.getElementById("gear-display");
const gearFill = document.getElementById("gear-fill");

const midModal = document.getElementById("mid-modal");
const midModalText = document.getElementById("mid-modal-text");
const midRpText = document.getElementById("mid-rp-text");
const btnMidPush = document.getElementById("btn-mid-push");

// Constants
const COLORS = ["#7aa2f7", "#f7768e", "#9ece6a", "#e0af68", "#bb9af7", "#89ddff"];
const DIFFS = { 
    "easy": { speedScale: 0.8, aggro: 0.1 }, 
    "medium": { speedScale: 0.95, aggro: 0.4 }, 
    "hard": { speedScale: 1.1, aggro: 0.8 } 
};

// Expanded to 8 Gears.
const GEARS = [
    { min: 0, max: 30 },
    { min: 15, max: 50 },
    { min: 30, max: 70 },
    { min: 45, max: 90 },
    { min: 60, max: 110 },
    { min: 75, max: 130 },
    { min: 90, max: 150 },
    { min: 105, max: 175 }
];
const CAR_W = 30;
const CAR_H = 60;
const LANE_W = 60;

// State
let gameState = {
    active: false, paused: false, mode: "race", dist: 15000, sides: true, notifs: true,
    cameraY: 0, countdown: 0, losers: []
};
let cars = [];
let keys = { w: false, a: false, s: false, d: false };
let keyLocks = { space: false, a: false, d: false };
let animationId;
let bgOffset = 0;
let pendingPushReason = "";
let pendingPushCar = "";

// ==========================================
// 1. DYNAMIC SETUP UI
// ==========================================
modeSelect.addEventListener("change", () => {
    distGroup.style.display = modeSelect.value === "race" ? "block" : "none";
});

function generatePlayerInputs() {
    let count = parseInt(playerCount.value);
    playersContainer.innerHTML = "";
    
    for (let i = 0; i < count; i++) {
        let isUser = i === 0;
        let div = document.createElement("div");
        div.className = "player-row";
        
        let header = `<div class="player-row-header" style="color: ${COLORS[i]}">${isUser ? 'Player 1 (You)' : 'Racer ' + (i+1)}</div>`;
        let nameIn = `<input type="text" id="p${i}-name" class="text-input" value="${isUser ? '{{user}}' : 'Racer ' + (i+1)}" style="padding: 5px;">`;
        let diffIn = isUser ? "" : `<select id="p${i}-diff" class="select-input" style="padding: 5px;">
            <option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option>
        </select>`;
        
        div.innerHTML = header + nameIn + diffIn;
        playersContainer.appendChild(div);
    }
}
playerCount.addEventListener("change", generatePlayerInputs);
generatePlayerInputs(); // Init

// ==========================================
// 2. INPUT HANDLING
// ==========================================
document.addEventListener("keydown", (e) => {
    if(!gameState.active || gameState.paused) return;
    
    if(e.code === "KeyW" || e.code === "ArrowUp") keys.w = true;
    if(e.code === "KeyS" || e.code === "ArrowDown") keys.s = true;
    if(e.code === "KeyA" || e.code === "ArrowLeft") { keys.a = true; attemptLaneChange(-1); }
    if(e.code === "KeyD" || e.code === "ArrowRight") { keys.d = true; attemptLaneChange(1); }
    if(e.code === "Space") { 
        if(!keyLocks.space && gameState.countdown <= 0) { 
            gearUp(cars[0]); 
            keyLocks.space = true; 
        }
        e.preventDefault();
    }
});
document.addEventListener("keyup", (e) => {
    if(e.code === "KeyW" || e.code === "ArrowUp") keys.w = false;
    if(e.code === "KeyS" || e.code === "ArrowDown") keys.s = false;
    if(e.code === "KeyA" || e.code === "ArrowLeft") { keys.a = false; keyLocks.a = false; }
    if(e.code === "KeyD" || e.code === "ArrowRight") { keys.d = false; keyLocks.d = false; }
    if(e.code === "Space") keyLocks.space = false;
});

function attemptLaneChange(dir) {
    if(gameState.countdown > 0) return; // Block steering during countdown
    if(dir === -1 && !keyLocks.a && cars[0].targetLane > 0) { cars[0].targetLane--; keyLocks.a = true; }
    if(dir === 1 && !keyLocks.d && cars[0].targetLane < 5) { cars[0].targetLane++; keyLocks.d = true; }
}

function gearUp(car) {
    let gMax = GEARS[car.gear].max;
    let gMin = GEARS[car.gear].min;
    let requiredSpeed = gMin + ((gMax - gMin) * 0.9);

    if (car.speed >= requiredSpeed && car.gear < 7) {
        car.gear++;
    }
}

// ==========================================
// 3. START GAME
// ==========================================
btnStart.addEventListener("click", () => {
    gameState.mode = modeSelect.value;
    gameState.dist = parseInt(distInput.value) || 15000;
    gameState.sides = sidesSelect.value === "true";
    gameState.notifs = notifsSelect.value === "true";
    gameState.active = true;
    gameState.paused = false;
    gameState.countdown = 3.99; // 3, 2, 1, GO
    gameState.losers = [];
    
    let count = parseInt(playerCount.value);
    cars = [];
    
    let startLanes = [2, 3, 1, 4, 0, 5];
    
    for(let i=0; i<count; i++) {
        cars.push({
            id: i,
            isUser: i === 0,
            name: document.getElementById(`p${i}-name`).value.trim(),
            color: COLORS[i],
            diff: i === 0 ? null : document.getElementById(`p${i}-diff`).value,
            lane: startLanes[i],
            targetLane: startLanes[i],
            x: startLanes[i] * LANE_W + 15,
            y: 0,
            speed: 0,
            gear: 0,
            active: true,
            status: "Racing",
            draftBoost: 1.0,
            knockback: 0
        });
    }
    
    setupPhase.style.display = "none";
    endPhase.style.display = "none";
    gameControlsPhase.style.display = "flex";
    
    lastTime = performance.now();
    gameLoop(lastTime);
});

// ==========================================
// 4. MAIN LOOP & PHYSICS
// ==========================================
let lastTime = 0;
function gameLoop(time) {
    if (!gameState.active) return;
    let dt = (time - lastTime) / 1000; // seconds
    lastTime = time;
    
    if (!gameState.paused) {
        if (gameState.countdown > 0) {
            gameState.countdown -= dt;
            updateCamera();
            drawFrame(dt);
            drawCountdown();
        } else {
            updateCars(dt);
            checkCollisions();
            updateCamera();
            drawFrame(dt);
            updateHUD();
            checkWinCondition();
            
            // Show "GO!" for a tiny bit after reaching 0
            if (gameState.countdown > -1) {
                gameState.countdown -= dt;
                drawCountdown();
            }
        }
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function updateCars(dt) {
    let baseAccel = 35;
    let baseBrake = 50;

    cars.forEach(car => {
        if(!car.active) {
            car.speed *= 0.95; 
            car.y += car.speed * dt * 6; 
            return;
        }
        
        let accel = baseAccel * Math.pow(0.75, car.gear); 
        accel *= car.draftBoost; 
        
        // 1. Controls & AI
        if (car.isUser) {
            if(keys.w) car.speed += accel * dt;
            if(keys.s) car.speed -= baseBrake * dt;
        } else {
            // AI Logic
            let dConf = DIFFS[car.diff];
            let targetMax = GEARS[7].max * dConf.speedScale;
            
            car.speed += accel * dt;
            if(car.speed >= targetMax) car.speed = targetMax;
            
            let reqSpeed = GEARS[car.gear].min + ((GEARS[car.gear].max - GEARS[car.gear].min) * 0.9);
            if(car.speed >= reqSpeed && car.gear < 7) car.gear++;
            
            // Avoidance
            let carAhead = cars.find(c => c.active && c.id !== car.id && c.lane === car.targetLane && c.y > car.y && c.y - car.y < 200);
            if(carAhead && Math.random() < 0.05) {
                if (Math.random() > dConf.aggro) {
                    let leftFree = car.targetLane > 0 && !cars.some(c => c.lane === car.targetLane-1 && Math.abs(c.y - car.y) < 150);
                    let rightFree = car.targetLane < 5 && !cars.some(c => c.lane === car.targetLane+1 && Math.abs(c.y - car.y) < 150);
                    if(leftFree && rightFree) car.targetLane += Math.random() < 0.5 ? 1 : -1;
                    else if(leftFree) car.targetLane -= 1;
                    else if(rightFree) car.targetLane += 1;
                }
            }
            
            // NEW: Aggressive Side-Ramming
            if (car.targetLane === car.lane) {
                let ramChance = car.diff === "hard" ? 0.04 : (car.diff === "medium" ? 0.02 : 0.005);
                
                if (Math.random() < ramChance) {
                    let sideCars = cars.filter(c => c.active && c.id !== car.id && Math.abs(c.y - car.y) < CAR_H && Math.abs(c.lane - car.lane) === 1);
                    if (sideCars.length > 0) {
                        let target = sideCars[0];
                        let safeToRam = true;
                        
                        // Hard AI smart check: If my center is ahead of their front bumper, I will spin out if I hit them. Don't do it!
                        if (car.diff === "hard" && (car.y + 30 > target.y + 40)) {
                            safeToRam = false;
                        }
                        
                        if (safeToRam) {
                            car.targetLane = target.lane; // Swerve into them!
                        }
                    }
                }
            }
        }
        
        // 2. Drafting calculation
        let draftTarget = cars.find(c => c.active && c.id !== car.id && Math.abs(c.x - car.x) < 20 && c.y > car.y && c.y - car.y < 150);
        car.draftBoost = draftTarget ? 1.3 : 1.0;
        
        // 3. Gear Limits
        let maxS = GEARS[car.gear].max;
        let minS = GEARS[car.gear].min;
        if(car.speed > maxS * car.draftBoost) car.speed = maxS * car.draftBoost;
        if(car.speed < 0) car.speed = 0;
        
        if(car.speed < minS && car.gear > 0) car.gear--;
        
        // 4. Movement 
        car.y += car.speed * dt * 6;
        if(car.knockback > 0) { car.y -= car.knockback; car.knockback = 0; }
        
        let targetX = car.targetLane * LANE_W + 15;
        let diff = targetX - car.x;
        if(Math.abs(diff) > 1) car.x += diff * 0.15;
        else car.x = targetX;
        
        car.lane = Math.floor((car.x + 15) / LANE_W);
    });
}

// ==========================================
// 5. COLLISION ENGINE
// ==========================================
function checkCollisions() {
    for(let i=0; i<cars.length; i++) {
        for(let j=i+1; j<cars.length; j++) {
            let a = cars[i], b = cars[j];
            
            // If EITHER car is dead, ignore the collision. Dead cars are ghosts.
            if(!a.active || !b.active) continue; 
            
            if(a.x < b.x + CAR_W && a.x + CAR_W > b.x && a.y < b.y + CAR_H && a.y + CAR_H > b.y) {
                resolveCollision(a, b);
            }
        }
    }
}

function resolveCollision(a, b) {
    let cyA = a.y + 30;
    let cyB = b.y + 30;
    
    if (Math.abs(cyA - cyB) > 40) {
        // Y-Collision (Shunt)
        let front = a.y > b.y ? a : b;
        let rear = a.y > b.y ? b : a;
        
        rear.speed *= 0.7;
        rear.knockback = 10; 
        
        if(front.active) applyShuntEffect(front);
    } else {
        // X-Collision (Side Hit)
        let left = a.x < b.x ? a : b;
        let right = a.x < b.x ? b : a;
        
        let instigator = left.targetLane > left.lane ? left : (right.targetLane < right.lane ? right : left);
        let victim = instigator === left ? right : left;
        
        let iCenter = instigator.y + 30;
        
        if (iCenter < victim.y + 20) {
            spinOut(victim, instigator.name, "side-swiped their rear");
        } else if (iCenter > victim.y + 40) {
            spinOut(instigator, victim.name, "pitted themselves against their bumper");
        } else {
            // Hit Middle -> Push
            if(victim.active) {
                victim.targetLane = instigator.targetLane + (instigator === left ? +1 : -1);
                
                if (victim.targetLane < 0 || victim.targetLane > 5) {
                    if (gameState.sides) {
                        victim.speed = GEARS[0].max; 
                        victim.gear = 0;
                        victim.knockback = 60; 
                        victim.targetLane = Math.max(0, Math.min(5, victim.targetLane));
                    } else {
                        spinOut(victim, instigator.name, "pushed them off the track");
                    }
                }
            }
        }
        
        if(left === instigator) left.x -= 5;
        else right.x += 5;
    }
}

function applyShuntEffect(car) {
    let roll = Math.random() * 100;
    if(roll < 20) car.targetLane -= 1;
    else if(roll < 40) car.targetLane += 1;
    else if(roll < 50) car.targetLane -= 2;
    else if(roll < 60) car.targetLane += 2;
    else if(roll < 70) spinOut(car, null, "was aggressively shunted out of control");
    else car.speed += 5;
    
    if (car.targetLane < 0 || car.targetLane > 5) {
        if(gameState.sides) {
            car.speed = GEARS[0].max;
            car.gear = 0;
            car.targetLane = Math.max(0, Math.min(5, car.targetLane));
        } else {
            spinOut(car, null, "was shunted off the track");
        }
    }
}

function spinOut(victim, instigatorName = null, reason = "lost control") {
    if (!victim.active) return;
    victim.active = false;
    victim.speed = 0;
    victim.status = "SPUN OUT";
    gameState.losers.push(victim.name);
    
    let text = instigatorName ? `${instigatorName} ${reason}, eliminating ${victim.name}!` : `${victim.name} ${reason} and spun out!`;
    
    if (gameState.notifs) {
        pendingPushCar = victim.name;
        pendingPushReason = text;
        
        gameState.paused = true;
        midModalText.innerText = text;
        midRpText.value = "";
        midModal.style.display = "flex";
    }
}

btnMidPush.addEventListener("click", () => {
    let pushStr = `\`${pendingPushReason}\``;
    const rp = midRpText.value.trim();
    if(rp) pushStr += `\n${rp}`;
    
    STBridge.sendMessage(pushStr, { losers: [pendingPushCar] });
    midModal.style.display = "none";
    gameState.paused = false;
});

// ==========================================
// 6. CAMERA & RENDERING
// ==========================================
function updateCamera() {
    if(gameState.mode === "takedown") {
        let leader = [...cars].filter(c => c.active).sort((a,b) => b.y - a.y)[0];
        if (leader) gameState.cameraY = leader.y - 400; 
        
        cars.forEach(c => {
            if (c.active && c.y < gameState.cameraY - 60) {
                spinOut(c, null, "fell too far behind");
            }
        });
    } else {
        gameState.cameraY = cars[0].y - 100;
    }
}

function drawCountdown() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 80px sans-serif";
    
    if (gameState.countdown > 0) {
        let num = Math.ceil(gameState.countdown);
        ctx.fillStyle = num === 3 ? "#f7768e" : num === 2 ? "#e0af68" : "#9ece6a";
        ctx.fillText(num, canvas.width/2, canvas.height/2);
    } else {
        ctx.fillStyle = "#7aa2f7";
        ctx.fillText("GO!", canvas.width/2, canvas.height/2);
    }
    ctx.textAlign = "start"; 
}

function drawFrame(dt) {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    bgOffset = (bgOffset + (cars[0].speed * dt * 10)) % 50;
    ctx.strokeStyle = "#1a1b26";
    ctx.lineWidth = 2;
    for (let i = -50; i < 550; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i + bgOffset); ctx.lineTo(360, i + bgOffset); ctx.stroke();
    }
    
    for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, 500);
        if (i === 3) { ctx.strokeStyle = "#e0af68"; ctx.lineWidth = 4; ctx.setLineDash([15, 10]); } 
        else { ctx.strokeStyle = "#24283b"; ctx.lineWidth = 2; ctx.setLineDash([]); }
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    if(gameState.mode === "race") {
        let finishScreenY = 500 - (gameState.dist - gameState.cameraY);
        if(finishScreenY > -100 && finishScreenY < 600) {
            for(let c=0; c<12; c++) {
                ctx.fillStyle = c%2===0 ? "white" : "black";
                ctx.fillRect(c*30, finishScreenY, 30, 10);
                ctx.fillStyle = c%2===0 ? "black" : "white";
                ctx.fillRect(c*30, finishScreenY+10, 30, 10);
            }
        }
    }
    
    let sortedCars = [...cars].sort((a,b) => a.y - b.y);
    
    sortedCars.forEach(c => {
        let screenY = 500 - (c.y - gameState.cameraY) - CAR_H;
        
        // Off-Screen Indicators
        if (screenY < -CAR_H && c.active) {
            ctx.fillStyle = c.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = c.color;
            ctx.fillRect(c.targetLane * LANE_W + 15, 5, 30, 8);
            ctx.shadowBlur = 0;
            return;
        } else if (screenY > 500 && c.active) {
            ctx.fillStyle = c.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = c.color;
            ctx.fillRect(c.targetLane * LANE_W + 15, 487, 30, 8);
            ctx.shadowBlur = 0;
            return;
        } else if (!c.active && (screenY < -CAR_H || screenY > 500)) {
            return; 
        }
        
        ctx.shadowBlur = c.active ? 10 : 0;
        ctx.shadowColor = c.color;
        
        ctx.save();
        ctx.translate(c.x + CAR_W/2, screenY + CAR_H/2);
        if(!c.active) {
            ctx.rotate( (c.id * 45) * Math.PI/180 ); 
            ctx.globalAlpha = 0.5;
        }
        
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(-CAR_W/2, -CAR_H/2, CAR_W, CAR_H);
        ctx.fillStyle = "#050505";
        ctx.fillRect(-CAR_W/2+1, -CAR_H/2+1, CAR_W-2, CAR_H-2);
        
        if (c.active) {
            ctx.fillStyle = c.draftBoost > 1.0 ? "#89ddff" : "#f7768e";
            ctx.fillRect(-CAR_W/2 + 6, CAR_H/2, CAR_W - 12, 6);
        }
        
        ctx.restore();
    });
    ctx.shadowBlur = 0;
}

// ==========================================
// 7. HUD & WIN LOGIC
// ==========================================
function updateHUD() {
    let u = cars[0];
    let gMax = GEARS[u.gear].max;
    let gMin = GEARS[u.gear].min;
    let range = gMax - gMin;
    let currentIntoGear = u.speed - gMin;
    let pct = (currentIntoGear / range) * 100;
    
    gearDisplay.innerText = u.gear + 1;
    gearFill.style.height = `${Math.min(100, Math.max(0, pct))}%`;
    
    if (pct >= 90) gearFill.classList.add("ready");
    else gearFill.classList.remove("ready");
    
    let activeSort = [...cars].sort((a,b) => b.y - a.y);
    raceStandings.innerHTML = activeSort.map((c, i) => {
        let dist = gameState.mode === "race" ? ` - ${Math.max(0, Math.floor(gameState.dist - c.y))}m` : "";
        let color = c.active ? c.color : "#565f89";
        return `<div style="color: ${color};">${i+1}. ${c.name} [${c.status}]${c.active ? dist : ''}</div>`;
    }).join("");
}

function checkWinCondition() {
    let activeCars = cars.filter(c => c.active);
    
    if (gameState.mode === "takedown") {
        if (activeCars.length <= 1 || !cars[0].active) {
            endGame(activeCars.length === 1 ? activeCars[0] : null);
        }
    } else {
        let winner = cars.find(c => c.active && c.y >= gameState.dist);
        if (winner || !cars[0].active) { 
            endGame(winner);
        }
    }
}

function endGame(winner) {
    gameState.active = false;
    cancelAnimationFrame(animationId);
    
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    
    let html = "";
    if (winner) {
        html = `<span style="color: ${winner.color}; font-size: 1.3em;">${winner.name} won the ${gameState.mode}!</span>`;
    } else {
        html = `<span style="color: #f7768e; font-size: 1.3em;">The race ended in disaster!</span>`;
    }
    endStats.innerHTML = html;
    
    cars.forEach(c => {
        if(c !== winner && !gameState.losers.includes(c.name)) {
            gameState.losers.push(c.name);
        }
    });
}

btnRestart.addEventListener("click", () => {
    gameState.active = false;
    cancelAnimationFrame(animationId);
    gameControlsPhase.style.display = "none";
    setupPhase.style.display = "block";
});

btnMenu.addEventListener("click", () => {
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});

btnPushEnd.addEventListener("click", () => {
    let winner = cars.find(c => !gameState.losers.includes(c.name));
    let summaryStr = "";
    
    if (winner) {
        summaryStr = `\`${winner.name} won the high-stakes Neon Racing ${gameState.mode} match!\``;
    } else {
        summaryStr = `\`The Neon Racing match ended with no winners! Everyone spun out.\``;
    }
    
    if(gameState.losers.length > 0) {
        summaryStr += `\n\`Losers: ${gameState.losers.join(", ")}\``;
    }
    
    const userRp = document.getElementById("end-rp-text").value.trim();
    if (userRp) summaryStr += `\n${userRp}`;

    STBridge.sendMessage(summaryStr, { losers: gameState.losers });
    
    document.getElementById("end-rp-text").value = "";
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});