// DOM Elements
const numNamedInput = document.getElementById("num-named");
const nameSlotsContainer = document.getElementById("name-slots-container");
const btnStart = document.getElementById("btn-start");

const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const endGamePanel = document.getElementById("end-game-panel");

const statusHeader = document.getElementById("status-header");
const playerCountsContainer = document.getElementById("player-counts-container");
const btnAction = document.getElementById("btn-action");
const actionLog = document.getElementById("action-log");
const targetHandArea = document.getElementById("target-hand-area");
const targetCardsContainer = document.getElementById("target-cards-container");
const targetNameUI = document.getElementById("target-name-ui");
const userHandContainer = document.getElementById("user-hand-container");
const userHandCount = document.getElementById("user-hand-count");

const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");

const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");

// Global Game State
let players = [];
let deck = [];
let currentDrawerIndex = 1; 
let currentTargetIndex = 0;
let currentState = "START_TURN"; // Modes: START_TURN, RESOLVE_PAIR, END_TURN
let pendingPairRank = null; 

// ==========================================
// 1. SETUP LOBBY
// ==========================================
function generateNameSlots() {
    const count = parseInt(numNamedInput.value) || 0;
    nameSlotsContainer.innerHTML = ""; 

    for (let i = 1; i <= count; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "text-input player-name-input";
        if (i === 1) input.value = "{{user}}"; 
        else input.placeholder = `Player ${i} Name`;
        nameSlotsContainer.appendChild(input);
    }
}

window.addEventListener("DOMContentLoaded", generateNameSlots);
numNamedInput.addEventListener("input", generateNameSlots);

// ==========================================
// 2. GAME INITIALIZATION
// ==========================================
btnStart.addEventListener("click", () => {
    const nameInputs = document.querySelectorAll(".player-name-input");
    players = [];
    nameInputs.forEach((input, i) => {
        let n = input.value.trim() || `Player ${i + 1}`;
        players.push({ name: n, hand: [], isUser: (i === 0), hasWon: false });
    });

    if (players.length < 2) return alert("Requires at least 2 players!");

    // Build and deal deck (51 cards, no Queen of Clubs)
    deck = [];
    const suits = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    
    for(let s of suits) {
        for(let r of ranks) {
            if(s === 'Clubs' && r === 'Q') continue; // Exclude QC
            if(s === 'Spades' && r === 'Q') {
                // BUGFIX: We change the rank strictly to 'OM' so it mathematically CANNOT pair with the other Queens!
                deck.push({rank: 'OM', suit: 'Spades', name: 'Old Maid', isMaid: true});
            } else {
                deck.push({rank: r, suit: s, name: `${r} of ${s}`, isMaid: false});
            }
        }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal sequentially
    for (let i = 0; i < deck.length; i++) {
        players[i % players.length].hand.push(deck[i]);
    }

    // Discard initial pairs behind the scenes
    actionLog.innerHTML = "";
    players.forEach(p => {
        let pairs = removeInitialPairs(p);
        if (pairs > 0) addLog(`${p.name} discarded ${pairs} initial pairs.`);
        if (p.hand.length === 0) {
            p.hasWon = true;
            addLog(`<span style="color:#9ece6a;">${p.name} was dealt 0 odd cards and wins instantly!</span>`);
        }
    });

    // Set first turn indexes (Player 2 draws from Player 1)
    currentDrawerIndex = 1 % players.length;
    while(players[currentDrawerIndex].hasWon) {
        currentDrawerIndex = (currentDrawerIndex + 1) % players.length;
    }
    currentTargetIndex = currentDrawerIndex;
    do {
        currentTargetIndex = (currentTargetIndex - 1 + players.length) % players.length;
    } while (players[currentTargetIndex].hasWon);

    currentState = "START_TURN";
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    renderGame();
});

// ==========================================
// 3. CORE GAME LOOP (STATE MACHINE)
// ==========================================
function renderGame() {
    renderUserHand();
    renderPlayerCounts(); // NEW: Update the visual tracker
    
    let drawer = players[currentDrawerIndex];
    let target = players[currentTargetIndex];
    
    targetHandArea.style.display = "none";
    btnAction.style.display = "block";
    btnAction.style.backgroundColor = "#7aa2f7";
    btnAction.style.color = "#1a1b26";
    
    if (currentState === "START_TURN") {
        statusHeader.innerText = `Turn: ${drawer.name} draws from ${target.name}`;
        
        if (drawer.isUser) {
            btnAction.style.display = "none"; // Hide button, user must click a card manually
            targetHandArea.style.display = "block";
            targetNameUI.innerText = target.name;
            renderFaceDownCards(target);
        } else {
            btnAction.innerText = `Let ${drawer.name} Draw`;
            btnAction.onclick = () => {
                let rIdx = Math.floor(Math.random() * target.hand.length);
                performDraw(drawer, target, rIdx);
            };
        }
    } 
    else if (currentState === "RESOLVE_PAIR") {
        statusHeader.innerText = `Pair Found!`;
        btnAction.innerText = `Discard Pair of ${pendingPairRank}s`;
        btnAction.style.backgroundColor = "#f7768e"; // Pop out in red
        btnAction.onclick = () => {
            removeSpecificPair(drawer, pendingPairRank);
            addLog(`${drawer.name} discarded a pair of ${pendingPairRank}s.`);
            currentState = "END_TURN";
            renderGame();
        };
    } 
    else if (currentState === "END_TURN") {
        statusHeader.innerText = `Turn Complete`;
        btnAction.innerText = `Progress to Next Turn ➡`;
        btnAction.onclick = () => endTurn();
    }
}

function performDraw(drawer, target, cardIndex) {
    let drawnCard = target.hand.splice(cardIndex, 1)[0];
    drawer.hand.push(drawnCard);
    
    if (drawer.isUser) addLog(`You drew a card from ${target.name}.`);
    else addLog(`${drawer.name} drew a card from ${target.name}.`);
    
    // Check if target won by having their last card stolen
    if (target.hand.length === 0) {
        target.hasWon = true;
        addLog(`<span style="color:#9ece6a;">${target.name} has 0 cards left and wins!</span>`);
    }
    
    // Check if drawer got a pair
    pendingPairRank = getPairRank(drawer);
    if (pendingPairRank) currentState = "RESOLVE_PAIR";
    else currentState = "END_TURN";
    
    renderGame();
}

function endTurn() {
    // Check if drawer won
    if (players[currentDrawerIndex].hand.length === 0 && !players[currentDrawerIndex].hasWon) {
        players[currentDrawerIndex].hasWon = true;
        addLog(`<span style="color:#9ece6a;">${players[currentDrawerIndex].name} has 0 cards left and wins!</span>`);
    }
    
    // Check Global Game Over
    let activePlayers = players.filter(p => !p.hasWon);
    if (activePlayers.length <= 1) {
        let loser = activePlayers[0];
        showEndGame(loser);
        return;
    }
    
    // Advance to next active players
    do { currentDrawerIndex = (currentDrawerIndex + 1) % players.length; } while (players[currentDrawerIndex].hasWon);
    
    currentTargetIndex = currentDrawerIndex;
    do { currentTargetIndex = (currentTargetIndex - 1 + players.length) % players.length; } while (players[currentTargetIndex].hasWon);
    
    currentState = "START_TURN";
    renderGame();
}

// ==========================================
// 4. UTILITIES & UI RENDERING
// ==========================================
function removeInitialPairs(player) {
    let count = 0;
    let paired = true;
    while (paired) {
        paired = false;
        let ranks = {};
        player.hand.forEach(c => ranks[c.rank] = (ranks[c.rank] || 0) + 1);
        
        for (let r in ranks) {
            if (ranks[r] >= 2) {
                let removed = 0;
                player.hand = player.hand.filter(c => {
                    if (c.rank === r && removed < 2) { removed++; return false; }
                    return true;
                });
                count++;
                paired = true;
                break;
            }
        }
    }
    return count;
}

function getPairRank(player) {
    let ranks = {};
    for (let c of player.hand) {
        ranks[c.rank] = (ranks[c.rank] || 0) + 1;
        if (ranks[c.rank] >= 2) return c.rank;
    }
    return null;
}

function removeSpecificPair(player, rank) {
    let removed = 0;
    player.hand = player.hand.filter(c => {
        if (c.rank === rank && removed < 2) { removed++; return false; }
        return true;
    });
}

function addLog(msg) {
    actionLog.innerHTML += `<div>${msg}</div>`;
    actionLog.scrollTop = actionLog.scrollHeight;
}

function renderUserHand() {
    let user = players[0];
    userHandCount.innerText = user.hand.length;
    userHandContainer.innerHTML = "";
    
    if (user.hasWon) {
        userHandContainer.innerHTML = "<div style='color:#9ece6a;'>You have won! You are out of the game.</div>";
        return;
    }
    
    user.hand.forEach(c => {
        let div = document.createElement("div");
        div.className = "om-card" + (c.isMaid ? " is-maid" : "");
        div.innerText = c.name;
        userHandContainer.appendChild(div);
    });
}

function renderFaceDownCards(target) {
    targetCardsContainer.innerHTML = "";
    target.hand.forEach((c, index) => {
        let cardBack = document.createElement("div");
        cardBack.className = "om-card-back";
        cardBack.title = `Draw Card ${index + 1}`;
        cardBack.onclick = () => performDraw(players[currentDrawerIndex], target, index);
        targetCardsContainer.appendChild(cardBack);
    });
}

function renderPlayerCounts() {
    playerCountsContainer.innerHTML = "";
    players.forEach(p => {
        let badge = document.createElement("div");
        badge.className = "count-badge";
        if (p.isUser) badge.classList.add("is-user");
        
        if (p.hasWon) {
            badge.classList.add("has-won");
            badge.innerHTML = `<b>${p.name}</b>: Out (Won)`;
        } else {
            badge.innerHTML = `<b>${p.name}</b>: ${p.hand.length} cards`;
        }
        
        playerCountsContainer.appendChild(badge);
    });
}

// ==========================================
// 5. ST PUSH MECHANICS (MIDGAME & ENDGAME)
// ==========================================
btnPushMidgame.addEventListener("click", () => {
    let handStrings = players.filter(p => !p.hasWon).map(p => `${p.name} (${p.hand.length})`).join(", ");
    let winnersList = players.filter(p => p.hasWon).map(p => p.name).join(", ") || "None";
    
    let maidHolder = players.find(p => !p.hasWon && p.hand.some(c => c.isMaid))?.name || "Unknown";
    let drawer = players[currentDrawerIndex].name;
    let target = players[currentTargetIndex].name;
    
    let pushStr = `<Old Maid Game State: Hand sizes: ${handStrings}. Winners so far: ${winnersList}. ${maidHolder} currently holds the Old Maid. It is ${drawer}'s turn to draw from ${target}.>\n<Do not proceed with game in roleplay, game is taking place on separate device. Only roleplay current game state>`;
    
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

function showEndGame(loser) {
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
    endStats.innerHTML = `<span style="color: #f7768e; font-size: 1.3em;"><b>${loser.name}</b> is left holding the Old Maid!</span>`;
    
    btnConfirmEnd.onclick = () => {
        let pushStr = `<Old Maid Game Over. ${loser.name} was left holding the Old Maid and lost the game!>`;
        const rpText = endRpText.value.trim();
        if (rpText) pushStr += `\n${rpText}`;
        
        STBridge.sendMessage(pushStr);
        
        endRpText.value = "";
        endGamePanel.style.display = "none";
        setupPanel.style.display = "block";
    };
}

btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});