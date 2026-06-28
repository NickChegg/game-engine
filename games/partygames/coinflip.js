// Game State
let stats = { heads: 0, tails: 0, edge: 0, total: 0, wins: 0, losses: 0 };

// DOM Elements
const flipButtons = document.querySelectorAll(".flip-btn");
const flipLog = document.getElementById("flip-log");

const scoreHeads = document.getElementById("score-heads");
const scoreTails = document.getElementById("score-tails");
const scoreBoxEdge = document.getElementById("score-box-edge");
const scoreEdge = document.getElementById("score-edge");

// Panels & Action Buttons
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");
const btnEndGame = document.getElementById("btn-end-game");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// ==========================================
// 1. LOCAL GAME MECHANICS
// ==========================================
flipButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const playerCall = btn.getAttribute("data-call");
        resolveFlip(playerCall);
    });
});

function resolveFlip(playerCall) {
    stats.total++;
    
    // THE MATH: 0.01% chance for an edge (1 in 10,000)
    const rng = Math.random();
    let result = '';
    
    if (rng < 0.0001) {
        result = 'edge';
    } else if (rng < 0.50005) {
        result = 'heads';
    } else {
        result = 'tails';
    }

    // Process Result
    let logEntry = document.createElement("div");
    logEntry.style.marginBottom = "5px";
    logEntry.innerHTML = `<b>Flip ${stats.total}:</b> Called ${playerCall}. `;

    if (result === 'edge') {
        stats.edge++;
        scoreEdge.innerText = stats.edge;
        scoreBoxEdge.style.display = "block"; // Secret revealed!
        logEntry.innerHTML += `<span style="color: #f7768e; font-weight: bold;">IT LANDED ON ITS EDGE!!</span>`;
    } else if (result === 'heads') {
        stats.heads++;
        scoreHeads.innerText = stats.heads;
        if (playerCall === 'heads') {
            stats.wins++;
            logEntry.innerHTML += `<span style="color: #9ece6a;">Landed Heads! (Win)</span>`;
        } else {
            stats.losses++;
            logEntry.innerHTML += `<span style="color: #f7768e;">Landed Heads. (Loss)</span>`;
        }
    } else if (result === 'tails') {
        stats.tails++;
        scoreTails.innerText = stats.tails;
        if (playerCall === 'tails') {
            stats.wins++;
            logEntry.innerHTML += `<span style="color: #9ece6a;">Landed Tails! (Win)</span>`;
        } else {
            stats.losses++;
            logEntry.innerHTML += `<span style="color: #f7768e;">Landed Tails. (Loss)</span>`;
        }
    }

    // Update History Log
    if (stats.total === 1) flipLog.innerHTML = ""; // Clear placeholder
    
    flipLog.appendChild(logEntry);
    flipLog.scrollTop = flipLog.scrollHeight; // Auto-scroll to bottom
}

// ==========================================
// 2. GAME MANAGEMENT & ENDING
// ==========================================
btnEndGame.addEventListener("click", () => {
    if (stats.total === 0) {
        endStats.innerHTML = "You haven't flipped the coin yet!";
    } else {
        endStats.innerHTML = `You flipped the coin <b>${stats.total}</b> times.<br>
                              Wins: <b>${stats.wins}</b> &nbsp;|&nbsp; Losses: <b>${stats.losses}</b>`;
        
        // Add secret stat to end screen if found
        if (stats.edge > 0) {
            endStats.innerHTML += `<br><span style="color: #f7768e; font-weight: bold;">EDGE LANDINGS: ${stats.edge}</span>`;
        }
    }
    
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
});

btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    gamePanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    if (stats.total === 0) {
        // Exit without sending anything
        window.location.href = "index.html";
        return;
    }
    
    // Format the backtick string for SillyTavern
    let resultString = `\`{{user}} flipped a coin ${stats.total} times. ${stats.heads} Heads. ${stats.tails} Tails.`;
    if (stats.edge > 0) {
        resultString += ` IT LANDED ON ITS EDGE ${stats.edge} TIME${stats.edge !== 1 ? 'S' : ''}!`;
    }
    resultString += `\``;

    // Attach the player's custom Roleplay text
    const userRp = endRpText.value.trim();
    if (userRp) {
        resultString += `\n${userRp}`;
    }

    // Push to ST chat
    STBridge.sendMessage(resultString);

    // Navigate back to Menu
    window.location.href = "index.html";
});