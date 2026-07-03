// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const endPhase = document.getElementById("end-phase");
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const arena = document.getElementById("arena");
const poolUI = document.getElementById("pool-ui");
const actionLog = document.getElementById("action-log");

const btnPlay1 = document.getElementById("btn-play-1");
const btnPlay10 = document.getElementById("btn-play-10");
const btnPlay50 = document.getElementById("btn-play-50");

const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");

const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");

// Game State
let players = [];
let pool = [];
let warActive = false;
let warCombatants = []; // Array of Player IDs tied in the war
let lastActionString = "";

// ==========================================
// 1. SETUP UI
// ==========================================
function renderSetupPlayers() {
    let targetCount = parseInt(numPlayersInput.value) || 2;
    let currentCount = playersContainer.children.length;
    
    if (currentCount < targetCount) {
        for (let i = currentCount; i < targetCount; i++) {
            let input = document.createElement("input");
            input.type = "text";
            input.className = "text-input p-name";
            if (i === 0) input.value = "{{user}}";
            else input.placeholder = `Player ${i+1}`;
            playersContainer.appendChild(input);
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
    let names = Array.from(document.querySelectorAll(".p-name")).map(i => i.value.trim() || "NPC");
    
    players = names.map((n, i) => ({
        id: i,
        name: n,
        hand: [],
        active: true
    }));
    
    pool = [];
    warActive = false;
    warCombatants = [];
    actionLog.innerHTML = `<div style="color:#9ece6a;">Game started! Cards dealt.</div>`;
    lastActionString = "The game has started.";
    
    buildAndDealDeck(players.length);
    renderBoard();
    
    setupPhase.style.display = "none";
    endPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
});

function buildAndDealDeck(numPlayers) {
    let deck = [];
    const suits = ['♥', '♦', '♠', '♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    
    for (let s of suits) {
        for (let r of ranks) {
            let val = parseInt(r);
            if (r === 'J') val = 11;
            if (r === 'Q') val = 12;
            if (r === 'K') val = 13;
            if (r === 'A') val = 14; // Aces High
            let color = (s === '♥' || s === '♦') ? 'card-red' : 'card-black';
            deck.push({ rank: r, suit: s, val: val, color: color, display: `${r}${s}` });
        }
    }
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Deal evenly
    let cardsPerPlayer = Math.floor(52 / numPlayers);
    for (let i = 0; i < cardsPerPlayer; i++) {
        players.forEach(p => p.hand.push(deck.pop()));
    }
}

// ==========================================
// 3. RENDERING
// ==========================================
function renderBoard() {
    // Remove old player mats
    document.querySelectorAll(".war-player-mat").forEach(el => el.remove());
    
    players.forEach(p => {
        let mat = document.createElement("div");
        mat.className = `war-player-mat war-pos-${p.id}`;
        
        let cardVisual = p.active 
            ? `<div class="playing-card card-hidden">?</div>` 
            : `<div style="width:40px; height:55px; border:1px dashed #565f89; border-radius:5px;"></div>`;
            
        let countVisual = p.active 
            ? `<div class="war-count">${p.hand.length} Cards</div>`
            : `<div class="war-count eliminated">Eliminated</div>`;
            
        mat.innerHTML = `
            <div class="war-name">${p.name}</div>
            ${cardVisual}
            ${countVisual}
        `;
        arena.appendChild(mat);
    });
    
    // Render Pool
    poolUI.innerHTML = "";
    if (pool.length === 0) {
        poolUI.innerHTML = `<div style="color: #565f89; font-style: italic; width: 100%; text-align: center;">The Pool</div>`;
    } else {
        pool.forEach(item => {
            if (item.faceDown) {
                poolUI.innerHTML += `<div class="playing-card card-hidden" title="${item.ownerName}'s Stake">?</div>`;
            } else {
                poolUI.innerHTML += `<div class="playing-card ${item.card.color}" title="${item.ownerName}">${item.card.display}</div>`;
            }
        });
    }
}

function logAction(msg) {
    let div = document.createElement("div");
    div.innerHTML = msg;
    actionLog.appendChild(div);
    actionLog.scrollTop = actionLog.scrollHeight;
}

// ==========================================
// 4. GAME LOGIC
// ==========================================
function playRound() {
    let activePlayers = players.filter(p => p.hand.length > 0);
    
    // Check Elimination
    players.forEach(p => {
        if (p.active && p.hand.length === 0) {
            p.active = false;
            logAction(`<span style="color:#f7768e;">${p.name} ran out of cards and is eliminated!</span>`);
        }
    });
    
    if (activePlayers.length <= 1) {
        endGame(activePlayers[0]);
        return false; // Game over
    }

    let combatants = warActive ? players.filter(p => warCombatants.includes(p.id) && p.hand.length > 0) : activePlayers;
    
    // Edge case: In a war, but only 1 person has cards left to fight it
    if (warActive && combatants.length === 1) {
        let winner = combatants[0];
        winner.hand.unshift(...pool.map(i => i.card));
        let wonCount = pool.length;
        pool = [];
        warActive = false;
        warCombatants = [];
        let msg = `${winner.name} wins ${wonCount} cards by default (opponents ran out).`;
        lastActionString = `\`${msg}\``;
        logAction(`<span style="color:#9ece6a;">${msg}</span>`);
        renderBoard();
        return true;
    }

    let faceUpCards = [];
    
    combatants.forEach(p => {
        if (warActive) {
            // War Stakes: Place 1 card face down (if they have enough to spare)
            if (p.hand.length > 1) {
                pool.push({ card: p.hand.pop(), ownerName: p.name, faceDown: true });
            }
        }
        // Place 1 card face up
        let c = p.hand.pop();
        pool.push({ card: c, ownerName: p.name, faceDown: false });
        faceUpCards.push({ card: c, owner: p });
    });

    // Evaluate
    let maxVal = -1;
    faceUpCards.forEach(item => { if (item.card.val > maxVal) maxVal = item.card.val; });
    
    let tied = faceUpCards.filter(item => item.card.val === maxVal).map(item => item.owner);
    let playedStr = faceUpCards.map(i => `${i.owner.name}: ${i.card.display}`).join(", ");

    if (tied.length === 1) {
        let winner = tied[0];
        let wonCount = pool.length;
        // Put pool cards at the BOTTOM of the winner's deck (unshift)
        // Note: Array.pop() takes from the end, so unshift() puts at the beginning
        winner.hand.unshift(...pool.map(i => i.card)); 
        pool = [];
        warActive = false;
        warCombatants = [];
        
        let msg = `${playedStr}. ${winner.name} wins ${wonCount} cards!`;
        lastActionString = `\`${msg}\``;
        logAction(`${playedStr}. <span style="color:#9ece6a;">${winner.name} wins!</span>`);
    } else {
        warActive = true;
        warCombatants = tied.map(t => t.id);
        
        let tiedNames = tied.map(t => t.name).join(" and ");
        let msg = `${playedStr}. WAR! ${tiedNames} tied!`;
        lastActionString = `\`${msg}\``;
        logAction(`${playedStr}. <span style="color:#f7768e; font-weight:bold;">WAR!</span>`);
    }

    renderBoard();
    return true; // Round completed successfully
}

btnPlay1.addEventListener("click", () => playRound());

function fastForward(rounds) {
    for (let i = 0; i < rounds; i++) {
        let success = playRound();
        if (!success) break; // Game Over hit
        if (warActive) {
            // Pause fast forward if a war breaks out so player can see it!
            logAction(`<span style="color:#e0af68;">Fast-forward paused for WAR!</span>`);
            break;
        }
    }
}

btnPlay10.addEventListener("click", () => fastForward(10));
btnPlay50.addEventListener("click", () => fastForward(50));

btnRestart.addEventListener("click", () => {
    gameControlsPhase.style.display = "none";
    setupPhase.style.display = "block";
});

// ==========================================
// 5. PUSH MESSAGES & END GAME
// ==========================================
btnPushMidgame.addEventListener("click", () => {
    let stateArray = players.map(p => `${p.name} has ${p.hand.length} cards`);
    let pushStr = `<War Game State: ${stateArray.join(", ")}>\n${lastActionString}`;
    
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

function endGame(winnerObj) {
    gameControlsPhase.style.display = "none";
    endPhase.style.display = "block";
    
    let winnerName = winnerObj ? winnerObj.name : "Nobody";
    endStats.innerHTML = `<span style="color: #9ece6a;">${winnerName} took all the cards and won the War!</span>`;
    
    btnPushEnd.onclick = () => {
        let pushStr = `\`${winnerName} took all the cards and won the game of War!\``;
        const rp = endRpText.value.trim();
        if (rp) pushStr += `\n${rp}`;
        
        // Everyone except the winner is a loser for Strip Mode
        let losers = players.filter(p => p.name !== winnerName).map(p => p.name);
        STBridge.sendMessage(pushStr, { losers: losers });
        
        endPhase.style.display = "none";
        setupPhase.style.display = "block";
    };
}