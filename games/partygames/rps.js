// Game State (Starts fresh every time the page loads)
let scores = { player: 0, ai: 0, ties: 0 };
const choices = ['rock', 'paper', 'scissors'];
const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };

// DOM Elements
const roundResult = document.getElementById("round-result");
const rpsButtons = document.querySelectorAll(".rps-btn");

// Panels & Action Buttons
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");
const btnResetGame = document.getElementById("btn-reset-game");
const btnEndGame = document.getElementById("btn-end-game");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// ==========================================
// 1. LOCAL GAME MECHANICS
// ==========================================
rpsButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const playerMove = btn.getAttribute("data-move");
        const aiMove = choices[Math.floor(Math.random() * choices.length)];
        
        resolveRound(playerMove, aiMove);
    });
});

function resolveRound(player, ai) {
    let resultMsg = `You: ${emojis[player]} &nbsp;|&nbsp; AI: ${emojis[ai]}<br>`;

    if (player === ai) {
        scores.ties++;
        resultMsg += `<span style="color: #e0af68;">It's a tie! Go again.</span>`;
    } else if (
        (player === 'rock' && ai === 'scissors') ||
        (player === 'paper' && ai === 'rock') ||
        (player === 'scissors' && ai === 'paper')
    ) {
        scores.player++;
        resultMsg += `<span style="color: #9ece6a;">You win the match!</span>`;
    } else {
        scores.ai++;
        resultMsg += `<span style="color: #f7768e;">You lose the match!</span>`;
    }

    roundResult.innerHTML = resultMsg;
    updateScoreUI();

    // HARD STOP: Disable RPS buttons if either side gets a win
    if (scores.player > 0 || scores.ai > 0) {
        rpsButtons.forEach(btn => btn.disabled = true);
        roundResult.innerHTML += `<br><span style="font-size: 0.8em; color: #787c99;">Match over. End game or Reset.</span>`;
    }
}

// ==========================================
// 2. GAME MANAGEMENT & ENDING
// ==========================================
function resetGame() {
    scores = { player: 0, ai: 0, ties: 0 };
    updateScoreUI();
    roundResult.innerHTML = "Make your move!";
    rpsButtons.forEach(btn => btn.disabled = false);
}

btnResetGame.addEventListener("click", resetGame);

btnEndGame.addEventListener("click", () => {
    let total = scores.player + scores.ai + scores.ties;
    
    // Build the stats display for the user
    let winStatus = "tied with";
    if (scores.player > scores.ai) winStatus = "beating";
    if (scores.player < scores.ai) winStatus = "losing to";

    endStats.innerHTML = `You are currently <b>${winStatus}</b> the AI.<br><br>
                          Rounds: <b>${total}</b> &nbsp;|&nbsp; Draws: <b>${scores.ties}</b>`;
    
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
});

btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    gamePanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    let total = scores.player + scores.ai + scores.ties;
    if (total === 0) {
        endGamePanel.style.display = "none";
        gamePanel.style.display = "block";
        return;
    }
    
    let outcome = "It's a tie!";
    let gameResult = null; // Prepare our strip state object

    if (scores.player > scores.ai) {
        outcome = "{{user}} won!";
        gameResult = { winners: ["{{user}}"] }; // Tell bridge user won
    }
    if (scores.player < scores.ai) {
        outcome = "{{user}} lost!";
        gameResult = { losers: ["{{user}}"] }; // Tell bridge user lost
    }

    let resultString = `\`${outcome} ${total} Round${total !== 1 ? 's' : ''}.`;
    if (scores.ties > 0) {
        resultString += ` ${scores.ties} Draw${scores.ties !== 1 ? 's' : ''}.`;
    }
    resultString += `\``;

    const userRp = endRpText.value.trim();
    if (userRp) {
        resultString += `\n${userRp}`;
    }

    // Call our shared bridge, passing the new gameResult parameter!
    STBridge.sendMessage(resultString, gameResult);

    window.location.href = "index.html";
});

function updateScoreUI() {
    document.getElementById("score-player").innerText = scores.player;
    document.getElementById("score-ties").innerText = scores.ties;
    document.getElementById("score-ai").innerText = scores.ai;
}