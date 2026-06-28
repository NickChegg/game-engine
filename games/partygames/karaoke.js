// DOM Elements
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");

const songStyleSelect = document.getElementById("song-style");
const difficultySelect = document.getElementById("difficulty");

const track = document.getElementById("karaoke-track");
const targetRing = document.getElementById("target-ring");
const scoreDisplay = document.getElementById("score-display");
const comboDisplay = document.getElementById("combo-display");

const btnHit = document.getElementById("btn-hit");
const dpadControls = document.getElementById("dpad-controls");
const dpadBtns = document.querySelectorAll(".dpad-btn");
const controlHint = document.getElementById("control-hint");

const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Game Engine State
let isPlaying = false;
let currentDifficulty = "normal";
let animationFrameId;
let gameStartTime = 0;
let beatmap = [];
let stats = { perfect: 0, good: 0, miss: 0, score: 0, combo: 0, maxCombo: 0 };

const targetX = 50; 
const noteSpeed = 0.4; 

// ==========================================
// 1. GAME SETUP & BEATMAP GENERATION
// ==========================================
btnStart.addEventListener("click", () => {
    currentDifficulty = difficultySelect.value;
    
    // Reset stats & UI
    stats = { perfect: 0, good: 0, miss: 0, score: 0, combo: 0, maxCombo: 0 };
    updateUI();
    
    // Configure Controls UI
    if (currentDifficulty === "hard") {
        btnHit.style.display = "none";
        dpadControls.style.display = "flex";
        controlHint.innerText = "USE ARROW KEYS (or buttons) to match the notes!";
    } else {
        btnHit.style.display = "block";
        dpadControls.style.display = "none";
        controlHint.innerText = "Hit SPACEBAR (or button) when notes reach the ring!";
    }
    
    beatmap = generateBeatmap(currentDifficulty);
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    
    isPlaying = true;
    gameStartTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
});

function generateBeatmap(difficulty) {
    let map = [];
    let time = 3000; // First note arrives exactly 3 seconds after starting
    let duration = 25000; 
    
    const hardDirs = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"];
    const hardIcons = {"ArrowLeft":"⬅️", "ArrowDown":"⬇️", "ArrowUp":"⬆️", "ArrowRight":"➡️"};
    const hardColors = {"ArrowLeft":"#f7768e", "ArrowDown":"#7aa2f7", "ArrowUp":"#9ece6a", "ArrowRight":"#e0af68"};
    
    while (time < duration) {
        let note = { hitTime: time, isHit: false, isMissed: false, el: document.createElement("div") };
        note.el.className = "rhythm-note";
        
        // Setup Note Logic
        if (difficulty === 'hard') {
            let dir = hardDirs[Math.floor(Math.random() * hardDirs.length)];
            note.direction = dir;
            note.el.innerText = hardIcons[dir];
            note.el.style.backgroundColor = hardColors[dir];
        } else {
            note.direction = "any";
            note.el.innerText = "🎵";
            note.el.style.backgroundColor = "#f7768e";
        }
        
        track.appendChild(note.el);
        map.push(note);
        
        // Density Logic
        let jump = 1000; 
        if (difficulty === 'easy') {
            jump = 1000; 
        } else {
            // Normal AND Hard use the fast logic!
            let r = Math.random();
            if (r > 0.6) jump = 250;
            else if (r > 0.2) jump = 500;
            else jump = 1000;
        }
        
        time += jump;
    }
    return map;
}

// ==========================================
// 2. THE MAIN ENGINE LOOP
// ==========================================
function gameLoop(currentTime) {
    if (!isPlaying) return;
    
    let timeElapsed = currentTime - gameStartTime;
    let activeNotes = 0;
    
    for (let note of beatmap) {
        if (note.isHit || note.isMissed) continue;
        
        activeNotes++;
        
        let timeUntilHit = note.hitTime - timeElapsed;
        let currentX = targetX + (timeUntilHit * noteSpeed);
        
        note.el.style.left = `${currentX}px`;
        
        if (timeUntilHit < -150) {
            note.isMissed = true;
            note.el.remove();
            registerHit("miss");
        }
    }
    
    if (activeNotes === 0 && timeElapsed > 5000) {
        endGame();
        return;
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// ==========================================
// 3. INPUT HANDLING
// ==========================================
// Easy/Normal Button
btnHit.addEventListener("mousedown", () => attemptHit("any"));
btnHit.addEventListener("touchstart", (e) => { e.preventDefault(); attemptHit("any"); });

// Hard D-Pad Buttons
dpadBtns.forEach(btn => {
    let dir = btn.getAttribute("data-dir");
    btn.addEventListener("mousedown", () => attemptHit(dir));
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); attemptHit(dir); });
});

// Keyboard Listeners
document.addEventListener("keydown", (e) => {
    if (!isPlaying) return;
    
    if (currentDifficulty === 'hard') {
        if (["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"].includes(e.code)) {
            e.preventDefault();
            visualizeRingHit(e.code);
            attemptHit(e.code);
        }
    } else {
        if (e.code === "Space") {
            e.preventDefault();
            visualizeRingHit("any");
            attemptHit("any");
            
            btnHit.style.transform = "scale(0.95)";
            btnHit.style.backgroundColor = "white";
            setTimeout(() => {
                btnHit.style.transform = "none";
                btnHit.style.backgroundColor = "#89ddff";
            }, 100);
        }
    }
});

function visualizeRingHit(dir) {
    targetRing.classList.add("ring-hit");
    
    // Add a flash of color to the ring based on the arrow key pressed
    if (dir === "ArrowLeft") targetRing.style.borderColor = "#f7768e";
    else if (dir === "ArrowDown") targetRing.style.borderColor = "#7aa2f7";
    else if (dir === "ArrowUp") targetRing.style.borderColor = "#9ece6a";
    else if (dir === "ArrowRight") targetRing.style.borderColor = "#e0af68";
    else targetRing.style.borderColor = "white";
    
    setTimeout(() => {
        targetRing.classList.remove("ring-hit");
        targetRing.style.borderColor = "var(--accent)";
    }, 100);
}

function attemptHit(inputDir) {
    if (!isPlaying) return;
    let timeElapsed = performance.now() - gameStartTime;
    
    let closestNote = null;
    let smallestDiff = 9999;
    
    for (let note of beatmap) {
        if (note.isHit || note.isMissed) continue;
        let diff = Math.abs(note.hitTime - timeElapsed);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestNote = note;
        }
    }
    
    if (!closestNote) return;
    
    // 1. Penalty for mashing / hitting way too early
    if (smallestDiff > 350) return;
    
    // 2. Strict Direction Check for Hard Mode
    if (currentDifficulty === 'hard' && closestNote.direction !== inputDir) {
        // Punish wrong key! Consume the note as a Miss immediately.
        processNote(closestNote, "miss");
        return;
    }
    
    // 3. Evaluate Timing Accuracy
    if (smallestDiff <= 80) {
        processNote(closestNote, "perfect");
    } else if (smallestDiff <= 200) {
        processNote(closestNote, "good");
    } else {
        processNote(closestNote, "miss");
    }
}

function processNote(note, judgment) {
    note.isHit = true;
    note.el.remove();
    registerHit(judgment);
}

function registerHit(judgment) {
    let popupColor = "";
    if (judgment === "perfect") {
        stats.perfect++;
        stats.combo++;
        stats.score += (100 * (1 + (stats.combo * 0.1)));
        popupColor = "#9ece6a";
    } else if (judgment === "good") {
        stats.good++;
        stats.combo++;
        stats.score += (50 * (1 + (stats.combo * 0.1)));
        popupColor = "#e0af68";
    } else if (judgment === "miss") {
        stats.miss++;
        stats.combo = 0;
        popupColor = "#f7768e";
    }
    if (stats.combo > stats.maxCombo) stats.maxCombo = stats.combo;
    
    createHitPopup(judgment.toUpperCase(), popupColor);
    updateUI();
}

function updateUI() {
    scoreDisplay.innerText = Math.floor(stats.score);
    comboDisplay.innerText = stats.combo;
    comboDisplay.style.color = stats.combo > 10 ? "#f7768e" : "#9ece6a";
}

function createHitPopup(text, color) {
    let popup = document.createElement("div");
    popup.className = "hit-feedback";
    popup.style.color = color;
    popup.innerText = text;
    track.appendChild(popup);
    setTimeout(() => popup.remove(), 600);
}

// ==========================================
// 4. GAME OVER & REPORTING
// ==========================================
function endGame() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    track.innerHTML = '<div id="target-ring"></div>'; 
    
    let totalNotes = beatmap.length;
    let hitNotes = stats.perfect + stats.good;
    let accuracy = hitNotes / totalNotes;
    
    let rank = "F"; let rankColor = "#f7768e";
    if (accuracy >= 0.95) { rank = "S"; rankColor = "#bb9af7"; }
    else if (accuracy >= 0.85) { rank = "A"; rankColor = "#9ece6a"; }
    else if (accuracy >= 0.70) { rank = "B"; rankColor = "#7aa2f7"; }
    else if (accuracy >= 0.50) { rank = "C"; rankColor = "#e0af68"; }
    
    endStats.innerHTML = `Rank: <span style="font-size: 2em; font-weight: bold; color: ${rankColor};">${rank}</span><br>
                          Max Combo: ${stats.maxCombo}<br>
                          <span style="color: #9ece6a;">Perfect: ${stats.perfect}</span> | 
                          <span style="color: #e0af68;">Good: ${stats.good}</span> | 
                          <span style="color: #f7768e;">Miss: ${stats.miss}</span>`;
                          
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
}

btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    const style = songStyleSelect.value;
    const diff = difficultySelect.value;
    const accuracyStr = Math.floor(((stats.perfect + stats.good) / beatmap.length) * 100);
    
    let rankText = "F-Rank";
    if (accuracyStr >= 95) rankText = "S-Rank";
    else if (accuracyStr >= 85) rankText = "A-Rank";
    else if (accuracyStr >= 70) rankText = "B-Rank";
    else if (accuracyStr >= 50) rankText = "C-Rank";

    let resultString = `\`{{user}} sang ${style} on ${diff.toUpperCase()} difficulty. They scored an ${rankText} (${accuracyStr}% accuracy) with a max combo of ${stats.maxCombo}!\``;

    const userRp = endRpText.value.trim();
    if (userRp) resultString += `\n${userRp}`;

    STBridge.sendMessage(resultString);
    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});