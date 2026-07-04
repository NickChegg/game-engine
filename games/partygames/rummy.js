// DOM Elements
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const gameModeSelect = document.getElementById("game-mode");
const btnStart = document.getElementById("btn-start");

const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const arenaPanel = document.getElementById("arena-panel");
const endPanel = document.getElementById("end-panel");

const opponentsList = document.getElementById("opponents-list");
const drawPile = document.getElementById("draw-pile");
const discardPileDiv = document.getElementById("discard-pile");
const discardTopCard = document.getElementById("discard-top-card");
const deckCountDisplay = document.getElementById("deck-count");
const meldsContainer = document.getElementById("melds-container");
const userHandContainer = document.getElementById("user-hand-container");

const userActionsDiv = document.getElementById("user-actions");
const phaseBanner = document.getElementById("phase-banner");
const btnMeld = document.getElementById("btn-meld");
const btnDiscard = document.getElementById("btn-discard");
const btnClearSel = document.getElementById("btn-clear-sel");
const layoffHint = document.getElementById("layoff-hint");
const btnNpcTurn = document.getElementById("btn-npc-turn");
const actionLog = document.getElementById("action-log");
const runningScoreDisplay = document.getElementById("running-score-display");
const roundNumDisplay = document.getElementById("round-num");

const midgameRpText = document.getElementById("midgame-rp-text");
const btnPushMidgame = document.getElementById("btn-push-midgame");

const endTitle = document.getElementById("end-title");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnNextRound = document.getElementById("btn-next-round");
const btnCancelEnd = document.getElementById("btn-cancel-end");

// Game State
let deck = [];
let discardPile = [];
let tableMelds = [];
let players = [];
let turnIndex = 0; 
let gameMode = "single";
let roundNumber = 1;
let gameActive = false;
let userSelectedCards = [];
let currentPhase = "DRAW"; // DRAW, PLAY, DISCARD

// Card Utilities
const suits = ['♥', '♦', '♠', '♣'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function getCardValue(rank) {
    if (rank === 'A') return 1; // Ace is low in standard basic rummy for runs
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
    return parseInt(rank);
}

function getCardPoints(rank) {
    if (rank === 'A') return 1;
    if (['J','Q','K'].includes(rank)) return 10;
    return parseInt(rank);
}

function createCardHTML(card) {
    if (!card) return "";
    return `<div class="playing-card ${card.color}" style="width: 45px; height: 60px; font-size: 1em;">${card.rank}${card.suit}</div>`;
}

function logToConsole(msg) {
    const p = document.createElement("p");
    p.innerHTML = msg;
    p.style.margin = "0";
    actionLog.appendChild(p);
    actionLog.scrollTop = actionLog.scrollHeight;
}

// ==========================================
// 1. SETUP UI
// ==========================================
function updateSetupUI() {
    let count = parseInt(numPlayersInput.value) || 2;
    if (count > 4) count = 4;
    if (count < 2) count = 2;
    numPlayersInput.value = count;
    
    let currentCount = playersContainer.children.length;
    
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
    } else if (currentCount > count) {
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
            deck.push({ rank: r, suit: s, color: color, val: getCardValue(r), pts: getCardPoints(r) });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

btnStart.addEventListener("click", () => {
    gameMode = gameModeSelect.value;
    roundNumber = 1;
    
    players = [];
    let rows = playersContainer.querySelectorAll(".flex-row");
    rows.forEach((row, idx) => {
        let n = row.querySelector(".p-name").value.trim() || `Player ${idx+1}`;
        players.push({ name: n, hand: [], score: 0, isUser: (idx === 0), hasMelded: false });
    });
    
    if (gameMode === "running") {
        runningScoreDisplay.style.display = "block";
    } else {
        runningScoreDisplay.style.display = "none";
    }
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    
    startRound();
});

function startRound() {
    buildDeck();
    discardPile = [];
    tableMelds = [];
    actionLog.innerHTML = "";
    userSelectedCards = [];
    
    roundNumDisplay.innerText = roundNumber;
    
    // Reset hands and meld flags
    players.forEach(p => { p.hand = []; p.hasMelded = false; });
    
    let cardsToDeal = players.length === 2 ? 10 : 7;
    for (let i = 0; i < cardsToDeal; i++) {
        players.forEach(p => p.hand.push(deck.pop()));
    }
    
    discardPile.push(deck.pop());
    
    turnIndex = 0;
    gameActive = true;
    currentPhase = "DRAW";
    
    logToConsole(`<span style="color:#9ece6a;">Round ${roundNumber} started. ${cardsToDeal} cards dealt.</span>`);
    renderBoard();
}

// ==========================================
// 3. RUMMY LOGIC & VALIDATION
// ==========================================
function checkDeck() {
    if (deck.length === 0) {
        let top = discardPile.pop();
        deck = discardPile;
        discardPile = [top];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        logToConsole(`<em>Discard pile shuffled into new stock.</em>`);
    }
}

function sortHand(hand) {
    hand.sort((a, b) => a.val - b.val);
}

function isValidMeld(cards) {
    if (cards.length < 3) return false;
    
    // Check Set
    let isSet = cards.every(c => c.rank === cards[0].rank);
    if (isSet) return { type: 'set', cards: cards };
    
    // Check Run
    let isRun = cards.every(c => c.suit === cards[0].suit);
    if (isRun) {
        let sorted = [...cards].sort((a, b) => a.val - b.val);
        let consecutive = true;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].val !== sorted[i-1].val + 1) consecutive = false;
        }
        if (consecutive) return { type: 'run', cards: sorted };
    }
    return false;
}

function canLayoff(card, meld) {
    if (meld.type === 'set') {
        return card.rank === meld.cards[0].rank;
    } else if (meld.type === 'run') {
        if (card.suit !== meld.cards[0].suit) return false;
        let sorted = [...meld.cards].sort((a, b) => a.val - b.val);
        let min = sorted[0].val;
        let max = sorted[sorted.length - 1].val;
        if (card.val === min - 1 || card.val === max + 1) return true;
    }
    return false;
}

// ==========================================
// 4. RENDERING
// ==========================================
function renderBoard() {
    if (!gameActive) return;
    
    // Top Card
    if (discardPile.length > 0) {
        discardTopCard.innerHTML = createCardHTML(discardPile[discardPile.length - 1]);
        discardPileDiv.classList.remove("disabled");
    } else {
        discardTopCard.innerHTML = `<div style="width:45px;height:60px;border:1px dashed #565f89;border-radius:5px;"></div>`;
        discardPileDiv.classList.add("disabled");
    }
    deckCountDisplay.innerText = deck.length;
    
    // Opponents
    opponentsList.innerHTML = "";
    players.forEach((p, idx) => {
        if (p.isUser) return;
        let activeClass = (idx === turnIndex) ? "active-turn" : "";
        let scoreHTML = gameMode === "running" ? `<div class="opp-score">Score: ${p.score}</div>` : "";
        opponentsList.innerHTML += `
            <div class="opp-badge ${activeClass}">
                <div class="opp-name">${p.name}</div>
                <div style="color: #a9b1d6; font-size: 0.85em;">🂠 ${p.hand.length} Cards</div>
                ${scoreHTML}
            </div>
        `;
    });
    
    // Melds
    meldsContainer.innerHTML = "";
    if (tableMelds.length === 0) {
        meldsContainer.innerHTML = `<span style="color: #565f89; font-style: italic; line-height: 50px;">No melds on table</span>`;
    } else {
        tableMelds.forEach((meld, mIdx) => {
            let mDiv = document.createElement("div");
            mDiv.className = "meld-group";
            mDiv.innerHTML = meld.cards.map(c => createCardHTML(c)).join("");
            mDiv.onclick = () => handleLayoffClick(mIdx);
            meldsContainer.appendChild(mDiv);
        });
    }

    // User Hand
    const user = players[0];
    const isUserTurn = (turnIndex === 0);
    document.getElementById("turn-indicator").style.display = isUserTurn ? "none" : "inline";
    
    sortHand(user.hand);
    userHandContainer.innerHTML = "";
    
    user.hand.forEach((card, cIdx) => {
        let wrapper = document.createElement("div");
        wrapper.className = "user-card" + (userSelectedCards.includes(cIdx) ? " selected" : "");
        wrapper.innerHTML = createCardHTML(card);
        if (isUserTurn && currentPhase !== "DRAW") {
            wrapper.onclick = () => toggleUserCardSelect(cIdx);
        }
        userHandContainer.appendChild(wrapper);
    });

    updateUserControls(isUserTurn);
}

function updateUserControls(isUserTurn) {
    if (!isUserTurn) {
        // Disable User Options
        btnMeld.disabled = true;
        btnDiscard.disabled = true;
        btnClearSel.disabled = true;
        layoffHint.style.visibility = "hidden";
        
        // Enable NPC Option
        btnNpcTurn.disabled = false;
        btnNpcTurn.innerText = `Execute ${players[turnIndex].name}'s Turn`;
        btnNpcTurn.onclick = executeNPCTurn;
        
        // Disable Desk interactions
        drawPile.onclick = null;
        discardPileDiv.onclick = null;
        drawPile.classList.add("disabled");
        discardPileDiv.classList.add("disabled");

        // Swap phase banner to neutral
        phaseBanner.className = "phase-banner";
        phaseBanner.innerText = "Waiting for Opponent...";
        phaseBanner.style.background = "#24283b";
        phaseBanner.style.color = "#a9b1d6";

        return;
    }

    // Reset neutral colors
    phaseBanner.style.background = "";
    phaseBanner.style.color = "";
    
    // Disable NPC option
    btnNpcTurn.disabled = true;
    btnNpcTurn.onclick = null;
    btnNpcTurn.innerText = `Execute NPC Turn ➡`;
    
    // Always calculate clear selection toggle
    btnClearSel.disabled = (userSelectedCards.length === 0);
    
    if (currentPhase === "DRAW") {
        phaseBanner.className = "phase-banner phase-draw";
        phaseBanner.innerText = "Draw Phase (Click Stock or Discard)";
        
        btnMeld.disabled = true;
        btnDiscard.disabled = true;
        layoffHint.style.visibility = "hidden";
        
        drawPile.classList.remove("disabled");
        drawPile.onclick = () => userDraw(false);
        discardPileDiv.onclick = () => userDraw(true);
    } 
    else if (currentPhase === "PLAY") {
        phaseBanner.className = "phase-banner phase-play";
        phaseBanner.innerText = "Play Phase (Meld or Discard)";
        
        drawPile.classList.add("disabled");
        discardPileDiv.classList.add("disabled");
        drawPile.onclick = null;
        discardPileDiv.onclick = null;
        
        btnMeld.disabled = (userSelectedCards.length < 3);
        btnDiscard.disabled = (userSelectedCards.length !== 1);
        
        if (userSelectedCards.length === 1 && tableMelds.length > 0) {
            layoffHint.style.visibility = "visible";
        } else {
            layoffHint.style.visibility = "hidden";
        }
    }
}

// ==========================================
// 5. USER ACTIONS
// ==========================================
function userDraw(fromDiscard) {
    if (turnIndex !== 0 || currentPhase !== "DRAW") return;
    
    let u = players[0];
    if (fromDiscard && discardPile.length > 0) {
        u.hand.push(discardPile.pop());
        logToConsole(`You drew from the discard pile.`);
    } else {
        checkDeck();
        u.hand.push(deck.pop());
        logToConsole(`You drew from the stock.`);
    }
    
    currentPhase = "PLAY";
    renderBoard();
}

function toggleUserCardSelect(idx) {
    if (userSelectedCards.includes(idx)) {
        userSelectedCards = userSelectedCards.filter(i => i !== idx);
    } else {
        userSelectedCards.push(idx);
    }
    renderBoard();
}

btnClearSel.onclick = () => {
    userSelectedCards = [];
    renderBoard();
};

btnMeld.onclick = () => {
    let u = players[0];
    let selected = userSelectedCards.map(i => u.hand[i]);
    
    let meldObj = isValidMeld(selected);
    if (meldObj) {
        tableMelds.push(meldObj);
        u.hasMelded = true;
        // Remove from hand (sort descending to not mess up indices)
        userSelectedCards.sort((a,b)=>b-a).forEach(idx => u.hand.splice(idx, 1));
        userSelectedCards = [];
        logToConsole(`You placed a ${meldObj.type}.`);
        
        if (!checkWin(u)) {
            renderBoard(); // FIXED: Force visual update immediately after playing meld
        }
    } else {
        logToConsole(`<span style="color:#f7768e;">Invalid Meld. Must be 3+ of same rank, or 3+ consecutive of same suit.</span>`);
    }
};

function handleLayoffClick(meldIdx) {
    if (turnIndex !== 0 || currentPhase !== "PLAY" || userSelectedCards.length !== 1) return;
    
    let u = players[0];
    let cardIdx = userSelectedCards[0];
    let card = u.hand[cardIdx];
    let meld = tableMelds[meldIdx];
    
    if (canLayoff(card, meld)) {
        meld.cards.push(card);
        if (meld.type === 'run') meld.cards.sort((a, b) => a.val - b.val);
        u.hasMelded = true;
        u.hand.splice(cardIdx, 1);
        userSelectedCards = [];
        logToConsole(`You laid off ${card.rank}${card.suit}.`);
        
        if (!checkWin(u)) {
            renderBoard(); // FIXED: Force visual update immediately after playing layoff
        }
    } else {
        logToConsole(`<span style="color:#f7768e;">Card does not fit that meld.</span>`);
    }
}

btnDiscard.onclick = () => {
    let u = players[0];
    let cardIdx = userSelectedCards[0];
    discardPile.push(u.hand.splice(cardIdx, 1)[0]);
    userSelectedCards = [];
    logToConsole(`You discarded a card.`);
    
    if (!checkWin(u)) {
        advanceTurn(); // (AdvanceTurn already calls renderBoard)
    }
};

// ==========================================
// 6. NPC AI LOGIC
// ==========================================
function executeNPCTurn() {
    let p = players[turnIndex];
    let startedWithEmptyMelds = !p.hasMelded;
    
    // 1. DRAW
    let topDiscard = discardPile[discardPile.length-1];
    let wantDiscard = false;
    if (topDiscard) {
        // Super simple check: does rank match any in hand?
        if (p.hand.some(c => c.rank === topDiscard.rank)) wantDiscard = true;
    }
    
    if (wantDiscard && discardPile.length > 0) {
        p.hand.push(discardPile.pop());
        logToConsole(`${p.name} drew from the discard pile.`);
    } else {
        checkDeck();
        p.hand.push(deck.pop());
        logToConsole(`${p.name} drew from the stock.`);
    }
    renderBoard();

    // Small delay to simulate thinking for PLAY phase
    setTimeout(() => {
        
        // 2. PLAY (Layoffs)
        let madePlay = true;
        while(madePlay && p.hand.length > 0) {
            madePlay = false;
            for (let i = p.hand.length - 1; i >= 0; i--) {
                let card = p.hand[i];
                for (let m of tableMelds) {
                    if (canLayoff(card, m)) {
                        m.cards.push(card);
                        if (m.type === 'run') m.cards.sort((a,b)=>a.val-b.val);
                        p.hand.splice(i, 1);
                        p.hasMelded = true;
                        madePlay = true;
                        logToConsole(`${p.name} laid off a card.`);
                        break;
                    }
                }
                if (madePlay) break;
            }
        }
        
        // 2. PLAY (New Melds) - Simplified just checks for Sets
        let rankCounts = {};
        p.hand.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
        
        for (let rank in rankCounts) {
            if (rankCounts[rank] >= 3) {
                let setCards = p.hand.filter(c => c.rank === rank);
                p.hand = p.hand.filter(c => c.rank !== rank);
                tableMelds.push({ type: 'set', cards: setCards });
                p.hasMelded = true;
                logToConsole(`${p.name} placed a new set.`);
            }
        }

        // 3. DISCARD
        if (p.hand.length > 0) {
            // Discard random for simplicity (or highest card)
            p.hand.sort((a,b)=>b.val-a.val);
            let dCard = p.hand.splice(0, 1)[0];
            discardPile.push(dCard);
            logToConsole(`${p.name} discarded and ended turn.`);
        }

        if (!checkWin(p, startedWithEmptyMelds)) {
            advanceTurn();
        }

    }, 800);
}

function advanceTurn() {
    turnIndex = (turnIndex + 1) % players.length;
    currentPhase = "DRAW";
    renderBoard();
}

function checkWin(player, npcStartedWithoutMelds = null) {
    if (player.hand.length === 0) {
        
        let isRummy = false;
        if (player.isUser) {
            if (!player.hasMeldedBeforeThisTurnFlag) isRummy = true; // Pseudocode flag
        } else {
            if (npcStartedWithoutMelds === true) isRummy = true;
        }

        endRound(player, isRummy);
        return true;
    }
    return false;
}

// ==========================================
// 7. END ROUND / END GAME
// ==========================================
let finalLosers = [];
let roundWinner = null;

function endRound(winner, isRummy) {
    gameActive = false;
    roundWinner = winner;
    
    // Calculate Points
    let pointsGained = 0;
    players.forEach(p => {
        if (p !== winner) {
            p.hand.forEach(c => pointsGained += c.pts);
        }
    });
    
    if (isRummy) {
        pointsGained *= 2;
        logToConsole(`<span style="color:#e0af68; font-weight:bold;">RUMMY! Points Doubled!</span>`);
    }
    
    winner.score += pointsGained;
    
    // UI Update
    arenaPanel.style.display = "none";
    gameControlsPhase.style.display = "none";
    endPanel.style.display = "block";
    
    endTitle.innerText = gameMode === "single" ? "Game Over" : `Round ${roundNumber} Over`;
    
    let html = `<h3 style="color: #9ece6a; margin-bottom: 10px;">${winner.name} Went Out!</h3>`;
    html += `<p style="margin-bottom: 15px;">They scored <b>${pointsGained}</b> points from remaining hands.</p>`;
    
    html += `<div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">`;
    players.forEach(p => {
        let color = p === winner ? "#9ece6a" : "#f7768e";
        let scoreText = gameMode === "running" ? `<br>Total: ${p.score}` : "";
        html += `
            <div style="background:#24283b; padding:10px; border-radius:5px; border:1px solid ${color};">
                <b>${p.name}</b><br><small>${p.hand.length} cards left</small>${scoreText}
            </div>
        `;
    });
    html += `</div>`;
    
    endStats.innerHTML = html;
    
    if (gameMode === "running") {
        btnNextRound.style.display = "block";
        btnConfirmEnd.innerText = "Push Round Results";
    } else {
        btnNextRound.style.display = "none";
        btnConfirmEnd.innerText = "Push Final Results";
    }
}

btnNextRound.onclick = () => {
    roundNumber++;
    endPanel.style.display = "none";
    arenaPanel.style.display = "block";
    gameControlsPhase.style.display = "block";
    startRound();
};

btnCancelEnd.onclick = () => {
    endPanel.style.display = "none";
    arenaPanel.style.display = "block";
    setupPhase.style.display = "block";
};

// PUSHING
btnPushMidgame.onclick = () => {
    let pStats = players.map(p => `${p.name}: ${p.hand.length} cards`).join(", ");
    let pushStr = `<Rummy Mid-Game State: ${pStats}. Top discard is ${discardPile[discardPile.length-1]?.rank||'Empty'}.>`;
    
    const rp = midgameRpText.value.trim();
    if (rp) pushStr += `\n${rp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
};

btnConfirmEnd.onclick = () => {
    let pushStr = "";
    let gameResult = null;
    
    if (gameMode === "single") {
        pushStr = `\`${roundWinner.name} went out and won the game of Rummy!\``;
        finalLosers = players.filter(p => p !== roundWinner).map(p => p.name);
        gameResult = { losers: finalLosers };
    } else {
        let leader = [...players].sort((a,b)=>b.score - a.score)[0];
        pushStr = `\`Round ${roundNumber} of Rummy ended. ${roundWinner.name} went out. Current Leader: ${leader.name} (${leader.score} pts).\``;
    }
    
    const rp = endRpText.value.trim();
    if (rp) pushStr += `\n${rp}`;
    
    STBridge.sendMessage(pushStr, gameResult);
    endRpText.value = "";
    
    if (gameMode === "single") {
        endPanel.style.display = "none";
        arenaPanel.style.display = "block";
        setupPhase.style.display = "block";
    }
};