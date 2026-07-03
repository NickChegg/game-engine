// DOM - Setup
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");

// DOM - Game Board
const gamePanel = document.getElementById("game-panel");
const opponentsList = document.getElementById("opponents-list");
const drawPile = document.getElementById("draw-pile");
const deckCountDisplay = document.getElementById("deck-count");
const discardTopCard = document.getElementById("discard-top-card");
const userHandContainer = document.getElementById("user-hand-container");
const currentSuitDisplay = document.getElementById("current-suit-display");
const activeSuitIcon = document.getElementById("active-suit-icon");
const turnIndicator = document.getElementById("turn-indicator");
const suitSelectorOverlay = document.getElementById("suit-selector");
const btnNextTurn = document.getElementById("btn-next-turn");
const gameLog = document.getElementById("game-log");

const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");

// DOM - End Screen
const endGamePanel = document.getElementById("end-game-panel");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");

// Game State
let deck = [];
let discardPile = [];
let players = [];
let turnIndex = 0; 
let activeSuit = '';
let activeRank = '';
let gameActive = false;

// Card Utilities
const suits = ['♥', '♦', '♠', '♣'];
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createCardHTML(card, isInvalid = false) {
    if (!card) return "";
    let classes = `playing-card ${card.color}`;
    if (isInvalid) classes += " invalid";
    return `<div class="${classes}" style="width: 50px; height: 70px;">${card.rank}${card.suit}</div>`;
}

function addToLog(msg) {
    const p = document.createElement("p");
    p.innerHTML = msg;
    gameLog.appendChild(p);
    gameLog.scrollTop = gameLog.scrollHeight;
}

// ==========================================
// 1. SETUP UI
// ==========================================
function updateSetupUI() {
    let count = parseInt(numPlayersInput.value) || 2;
    if (count > 7) count = 7;
    if (count < 2) count = 2;
    numPlayersInput.value = count;
    
    let currentCount = playersContainer.children.length;
    
    // Add new rows without touching existing ones
    if (currentCount < count) {
        for (let i = currentCount + 1; i <= count; i++) {
            let row = document.createElement("div");
            row.className = "flex-row";
            row.style.marginBottom = "10px";
            
            let isUserSlot = (i === 1);
            let nameInp = `<input type="text" class="text-input p-name" ${isUserSlot ? 'value="{{user}}" readonly' : `placeholder="Player ${i}"`}>`;
            
            row.innerHTML = `<div style="flex:1;">${nameInp}</div>`;
            playersContainer.appendChild(row);
        }
    } 
    // Remove excess rows from the bottom
    else if (currentCount > count) {
        for (let i = currentCount; i > count; i--) {
            playersContainer.removeChild(playersContainer.lastChild);
        }
    }
}

numPlayersInput.addEventListener("input", updateSetupUI);
window.addEventListener("DOMContentLoaded", updateSetupUI);

// ==========================================
// 2. CORE GAME MECHANICS
// ==========================================
function buildDeck() {
    deck = [];
    for (let s of suits) {
        for (let r of ranks) {
            let color = (s === '♥' || s === '♦') ? 'card-red' : 'card-black';
            deck.push({ rank: r, suit: s, color: color });
        }
    }
    shuffleArray(deck);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

btnStart.addEventListener("click", () => {
    // Collect Players
    players = [];
    let rows = playersContainer.querySelectorAll(".flex-row");
    rows.forEach((row, idx) => {
        let n = row.querySelector(".p-name").value.trim() || `Player ${idx+1}`;
        players.push({ name: n, hand: [], isUser: (idx === 0) });
    });
    
    buildDeck();
    discardPile = [];
    gameLog.innerHTML = "";
    
    // Deal Cards (8 for 2p, 5 for 3+p)
    let cardsToDeal = players.length === 2 ? 8 : 5;
    for (let i = 0; i < cardsToDeal; i++) {
        players.forEach(p => p.hand.push(deck.pop()));
    }
    
    // Initial Top Card (Ensure it's not an 8)
    let startCard = deck.pop();
    while (startCard.rank === '8') {
        deck.unshift(startCard);
        startCard = deck.pop();
    }
    
    discardPile.push(startCard);
    activeSuit = startCard.suit;
    activeRank = startCard.rank;
    
    turnIndex = 0;
    gameActive = true;
    addToLog(`Game started. Dealing ${cardsToDeal} cards each.`);
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    renderBoard();
});

// ==========================================
// 3. GAME LOOP & RENDERING
// ==========================================
function renderBoard() {
    if (!gameActive) return;
    
    // Top Card & Active Suit
    discardTopCard.innerHTML = createCardHTML(discardPile[discardPile.length - 1]);
    deckCountDisplay.innerText = deck.length;
    
    activeSuitIcon.innerText = activeSuit;
    activeSuitIcon.style.color = (activeSuit === '♥' || activeSuit === '♦') ? '#d32f2f' : 'white';
    
    // Opponents
    opponentsList.innerHTML = "";
    players.forEach((p, idx) => {
        if (p.isUser) return;
        let activeClass = (idx === turnIndex) ? "active-turn" : "";
        opponentsList.innerHTML += `
            <div class="opp-badge ${activeClass}">
                <div class="opp-name">${p.name}</div>
                <div style="color: #a9b1d6; font-size: 0.85em;">🂠 ${p.hand.length} Cards</div>
            </div>
        `;
    });
    
    // User Hand
    const user = players[0];
    const isUserTurn = (turnIndex === 0);
    turnIndicator.style.display = isUserTurn ? "none" : "inline";
    
    userHandContainer.innerHTML = "";
    user.hand.forEach((card, cIdx) => {
        let valid = isCardPlayable(card);
        let html = createCardHTML(card, !isUserTurn || !valid);
        
        let wrapper = document.createElement("div");
        wrapper.className = "user-card" + (!isUserTurn || !valid ? " invalid" : "");
        wrapper.innerHTML = html;
        
        if (isUserTurn && valid) {
            wrapper.onclick = () => handleUserPlay(cIdx);
        }
        userHandContainer.appendChild(wrapper);
    });
    
    // Deck State
    if (isUserTurn) {
        drawPile.classList.remove("disabled");
        drawPile.onclick = handleUserDraw;
    } else {
        drawPile.classList.add("disabled");
        drawPile.onclick = null;
    }
    
    // Action Controls
    btnNextTurn.style.display = isUserTurn ? "none" : "block";
    if (!isUserTurn) {
        btnNextTurn.innerText = `Execute ${players[turnIndex].name}'s Turn`;
        btnNextTurn.onclick = executeNPCTurn;
    }
}

function isCardPlayable(card) {
    return card.rank === '8' || card.suit === activeSuit || card.rank === activeRank;
}

function reshuffleDeck() {
    if (discardPile.length <= 1) return false;
    let topCard = discardPile.pop(); // Keep top card
    deck = discardPile; // Take rest
    discardPile = [topCard];
    shuffleArray(deck);
    addToLog(`<em>Discard pile reshuffled into draw pile.</em>`);
    return true;
}

function advanceTurn() {
    // Check for win condition
    let winner = players.find(p => p.hand.length === 0);
    if (winner) {
        endGame(winner);
        return;
    }
    
    turnIndex = (turnIndex + 1) % players.length;
    renderBoard();
}

// ==========================================
// 4. PLAYER TURNS
// ==========================================
let pendingWildCardIndex = -1;

function handleUserPlay(cardIndex) {
    let user = players[0];
    let card = user.hand[cardIndex];
    
    if (card.rank === '8') {
        pendingWildCardIndex = cardIndex;
        suitSelectorOverlay.style.display = "flex";
        return;
    }
    
    // Normal Play
    playCardFromHand(0, cardIndex, card.suit);
}

function setWildSuit(chosenSuit) {
    suitSelectorOverlay.style.display = "none";
    if (pendingWildCardIndex > -1) {
        playCardFromHand(0, pendingWildCardIndex, chosenSuit);
        pendingWildCardIndex = -1;
    }
}

function handleUserDraw() {
    if (turnIndex !== 0) return;
    
    if (deck.length === 0) {
        let couldShuffle = reshuffleDeck();
        if (!couldShuffle) {
            addToLog(`No cards left to draw. ${players[0].name} passes.`);
            advanceTurn();
            return;
        }
    }
    
    let drawn = deck.pop();
    players[0].hand.push(drawn);
    addToLog(`You drew a card.`);
    
    // If playable, they can immediately play it or draw again (render updates it)
    renderBoard();
}

// ==========================================
// 5. NPC AI LOGIC
// ==========================================
function executeNPCTurn() {
    let p = players[turnIndex];
    let playable = p.hand.filter(c => isCardPlayable(c));
    
    if (playable.length > 0) {
        // AI Strategy: Play non-8s first.
        let nonEights = playable.filter(c => c.rank !== '8');
        let cardToPlay = nonEights.length > 0 ? nonEights[0] : playable[0];
        let cardIdx = p.hand.indexOf(cardToPlay);
        
        let targetSuit = cardToPlay.suit;
        
        // If playing an 8, pick the suit they have most of
        if (cardToPlay.rank === '8') {
            let suitCounts = { '♥': 0, '♦': 0, '♠': 0, '♣': 0 };
            p.hand.forEach(c => suitCounts[c.suit]++);
            let bestSuit = Object.keys(suitCounts).reduce((a, b) => suitCounts[a] > suitCounts[b] ? a : b);
            targetSuit = bestSuit;
        }
        
        playCardFromHand(turnIndex, cardIdx, targetSuit);
    } else {
        // AI Must Draw
        if (deck.length === 0 && !reshuffleDeck()) {
            addToLog(`${p.name} has no plays and cannot draw. Passes.`);
            advanceTurn();
            return;
        }
        
        let drawn = deck.pop();
        p.hand.push(drawn);
        addToLog(`${p.name} drew a card.`);
        
        // Let them immediately evaluate again on next button click (simulating thought)
        renderBoard(); 
    }
}

// ==========================================
// 6. ACTION EXECUTION
// ==========================================
function playCardFromHand(playerIdx, cardIdx, chosenSuit) {
    let p = players[playerIdx];
    let card = p.hand.splice(cardIdx, 1)[0];
    
    discardPile.push(card);
    activeSuit = chosenSuit;
    activeRank = card.rank;
    
    let msg = `<strong>${p.name}</strong> played <span class="${card.color}">${card.rank}${card.suit}</span>`;
    if (card.rank === '8') {
        let suitColor = (chosenSuit === '♥' || chosenSuit === '♦') ? 'color: #d32f2f;' : 'color: white;';
        msg += ` and changed the suit to <span style="${suitColor}">${chosenSuit}</span>.`;
    } else {
        msg += ".";
    }
    addToLog(msg);
    
    if (p.hand.length === 1) addToLog(`<span style="color:#e0af68;">${p.name} has ONE card left!</span>`);
    
    advanceTurn();
}

// ==========================================
// 7. END GAME & PUSHING
// ==========================================
let finalGameResult = null;
let finalSummaryStr = "";

function endGame(winner) {
    gameActive = false;
    
    let losersList = players.filter(p => p.name !== winner.name).map(p => p.name);
    finalGameResult = { winners: [winner.name], losers: losersList };
    
    finalSummaryStr = `\`Crazy Eights Match Over! ${winner.name} emptied their hand and won the game.\``;
    
    let statsHTML = `<h3 style="color: #9ece6a; margin-bottom: 15px;">🏆 ${winner.name} Wins!</h3>`;
    statsHTML += `<div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">`;
    
    players.forEach(p => {
        let color = p.name === winner.name ? "#9ece6a" : "#f7768e";
        statsHTML += `
            <div style="background: #24283b; padding: 10px; border-radius: 8px; border: 1px solid ${color};">
                <span style="font-weight:bold; color: ${color};">${p.name}</span><br>
                <span style="color:#a9b1d6; font-size:0.9em;">${p.hand.length} cards left</span>
            </div>
        `;
    });
    statsHTML += `</div>`;
    
    endStats.innerHTML = statsHTML;
    
    gamePanel.style.display = "none";
    endGamePanel.style.display = "block";
}

// Mid-Game Push
btnPushMidgame.addEventListener("click", () => {
    let activeP = players[turnIndex];
    let top = discardPile[discardPile.length - 1];
    
    let suitStr = activeSuit === top.suit ? "" : ` (Suit changed to ${activeSuit})`;
    let pushStr = `<Crazy Eights Mid-Game State: Top card is ${top.rank}${top.suit}${suitStr}. It is currently ${activeP.name}'s turn.>\n<Do not proceed with game in roleplay, game is taking place on separate device. Only roleplay current game state>`;
    
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

// End Game Buttons
btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    const userRp = endRpText.value.trim();
    let finalStr = finalSummaryStr;
    if (userRp) finalStr += `\n${userRp}`;

    STBridge.sendMessage(finalStr, finalGameResult);

    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});