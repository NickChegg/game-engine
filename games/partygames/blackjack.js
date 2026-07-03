// DOM - Setup
const dealerModeSelect = document.getElementById("dealer-mode");
const dealerNameGroup = document.getElementById("dealer-name-group");
const dealerNameInput = document.getElementById("dealer-name");
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const btnStart = document.getElementById("btn-start");

// DOM - Game Board
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const dealerUiName = document.getElementById("dealer-ui-name");
const dealerCardsDiv = document.getElementById("dealer-cards");
const dealerValSpan = document.getElementById("dealer-val");
const tableList = document.getElementById("table-list");

const actionControls = document.getElementById("action-controls");
const btnHit = document.getElementById("btn-hit");
const btnStand = document.getElementById("btn-stand");
const btnNextTurn = document.getElementById("btn-next-turn");

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
let dealer = { name: "The Dealer", hand: [], isUser: false, status: "Playing" };
let players = [];
let turnIndex = 0; // 0 to players.length - 1. Then dealer's turn.
let gameStage = "playing"; // playing, dealerTurn, ended

// ==========================================
// 1. SETUP UI
// ==========================================
function updateSetupUI() {
    let mode = dealerModeSelect.value;
    dealerNameGroup.style.display = (mode === "character") ? "block" : "none";
    
    let count = parseInt(numPlayersInput.value) || 1;
    let currentCount = playersContainer.children.length;
    let userAssigned = (mode === "user");
    
    // Add new rows without touching existing ones
    if (currentCount < count) {
        for (let i = currentCount + 1; i <= count; i++) {
            let row = document.createElement("div");
            row.className = "flex-row";
            row.style.marginBottom = "10px";
            
            let isUserSlot = (!userAssigned && i === 1);
            let nameInp = `<input type="text" class="text-input p-name" ${isUserSlot ? 'value="{{user}}"' : `placeholder="Player ${i}"`}>`;
            let intInp = `<select class="select-input p-intel" ${isUserSlot ? 'style="display:none;"' : ''}>
                            <option value="0.5">Simple (50%)</option>
                            <option value="0.7" selected>Average (70%)</option>
                            <option value="0.9">Intelligent (90%)</option>
                          </select>`;
                          
            row.innerHTML = `<div style="flex:2;">${nameInp}</div><div style="flex:1;">${intInp}</div>`;
            playersContainer.appendChild(row);
        }
    } 
    // Remove excess rows from the bottom
    else if (currentCount > count) {
        for (let i = currentCount; i > count; i--) {
            playersContainer.removeChild(playersContainer.lastChild);
        }
    }

    // Dynamically update Player 1's UI if Dealer Mode is toggled
    if (playersContainer.children.length > 0) {
        let firstRow = playersContainer.children[0];
        let nameInput = firstRow.querySelector(".p-name");
        let intelSelect = firstRow.querySelector(".p-intel");
        
        if (userAssigned) {
            // User is the dealer, meaning Player 1 is an NPC
            if (nameInput.value === "{{user}}") nameInput.value = "";
            nameInput.placeholder = "Player 1";
            intelSelect.style.display = "inline-block";
        } else {
            // User is Player 1
            if (nameInput.value === "") nameInput.value = "{{user}}";
            intelSelect.style.display = "none";
        }
    }
}

dealerModeSelect.addEventListener("change", updateSetupUI);
numPlayersInput.addEventListener("input", updateSetupUI);
window.addEventListener("DOMContentLoaded", updateSetupUI);


// ==========================================
// 2. CORE GAME MECHANICS
// ==========================================
function buildDeck() {
    deck = [];
    const suits = ['♥', '♦', '♠', '♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    for (let s of suits) {
        for (let r of ranks) {
            let val = parseInt(r);
            if (['J','Q','K'].includes(r)) val = 10;
            if (r === 'A') val = 11;
            let color = (s === '♥' || s === '♦') ? 'card-red' : 'card-black';
            deck.push({ rank: r, suit: s, val: val, color: color });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function calculateHand(hand) {
    let sum = 0;
    let aces = 0;
    hand.forEach(c => {
        sum += c.val;
        if (c.val === 11) aces++;
    });
    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
    }
    return sum;
}

btnStart.addEventListener("click", () => {
    let mode = dealerModeSelect.value;
    
    // Assign Dealer
    if (mode === "user") dealer = { name: "{{user}}", hand: [], isUser: true, status: "Waiting" };
    else if (mode === "character") dealer = { name: dealerNameInput.value.trim() || "The Dealer", hand: [], isUser: false, status: "Waiting" };
    else dealer = { name: "The Dealer", hand: [], isUser: false, status: "Waiting" };
    
    // Assign Players
    players = [];
    let rows = playersContainer.querySelectorAll(".flex-row");
    rows.forEach(row => {
        let n = row.querySelector(".p-name").value.trim() || "NPC";
        let isU = (n === "{{user}}");
        let intel = parseFloat(row.querySelector(".p-intel").value);
        players.push({ name: n, hand: [], isUser: isU, intel: intel, status: "Playing" });
    });
    
    buildDeck();
    
    // Initial Deal (2 cards each)
    for (let i = 0; i < 2; i++) {
        players.forEach(p => p.hand.push(deck.pop()));
        dealer.hand.push(deck.pop());
    }
    
    // Check initial Blackjacks
    players.forEach(p => { if (calculateHand(p.hand) === 21) p.status = "Blackjack!"; });
    
    turnIndex = 0;
    gameStage = "playing";
    advanceToNextValidPlayer();
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    renderBoard();
});

function renderCard(card, hidden = false) {
    if (hidden) return `<div class="playing-card card-hidden">?</div>`;
    return `<div class="playing-card ${card.color}">${card.rank}${card.suit}</div>`;
}

function renderBoard() {
    dealerUiName.innerText = dealer.name;
    dealerCardsDiv.innerHTML = "";
    
    if (gameStage === "playing") {
        dealerCardsDiv.innerHTML += renderCard(dealer.hand[0], false);
        dealerCardsDiv.innerHTML += renderCard(dealer.hand[1], true);
        dealerValSpan.innerText = dealer.hand[0].val; // Only show upcard val
    } else {
        dealer.hand.forEach(c => dealerCardsDiv.innerHTML += renderCard(c, false));
        dealerValSpan.innerText = calculateHand(dealer.hand);
    }
    
    tableList.innerHTML = "";
    players.forEach((p, idx) => {
        let row = document.createElement("div");
        row.className = "player-row" + (idx === turnIndex && gameStage === "playing" ? " active-turn" : "");
        
        let cardsHtml = p.hand.map(c => renderCard(c, false)).join("");
        let badgeClass = "status-badge";
        if (p.status === "Bust!") badgeClass += " status-bust";
        if (p.status === "Stand") badgeClass += " status-stand";
        if (p.status === "Blackjack!") badgeClass += " status-blackjack";
        
        row.innerHTML = `
            <div style="flex:1;">
                <strong>${p.name}</strong> <span class="${badgeClass}">${p.status}</span><br>
                <small style="color:#787c99;">Value: ${calculateHand(p.hand)}</small>
            </div>
            <div>${cardsHtml}</div>
        `;
        tableList.appendChild(row);
    });
    
    updateControls();
}

// ==========================================
// 3. TURN LOGIC
// ==========================================
function advanceToNextValidPlayer() {
    while (turnIndex < players.length && (players[turnIndex].status === "Bust!" || players[turnIndex].status === "Blackjack!")) {
        players[turnIndex].status = players[turnIndex].status === "Bust!" ? "Bust!" : "Stand"; // Lock in
        turnIndex++;
    }
    
    if (turnIndex >= players.length) {
        startDealerTurn();
    }
}

function updateControls() {
    actionControls.style.display = "none";
    btnNextTurn.style.display = "none";
    
    if (gameStage === "ended") return;
    
    if (gameStage === "dealerTurn") {
        if (dealer.isUser) {
            actionControls.style.display = "flex"; // User acts as dealer
        } else {
            btnNextTurn.style.display = "block";
            btnNextTurn.innerText = "Execute Dealer Turn";
            btnNextTurn.onclick = executeNPCDealer;
        }
        return;
    }
    
    let activePlayer = players[turnIndex];
    if (activePlayer.isUser) {
        actionControls.style.display = "flex";
    } else {
        btnNextTurn.style.display = "block";
        btnNextTurn.innerText = `Execute ${activePlayer.name}'s Turn`;
        btnNextTurn.onclick = executeNPCTurn;
    }
}

// User Actions
btnHit.addEventListener("click", () => {
    let target = (gameStage === "dealerTurn") ? dealer : players[turnIndex];
    target.hand.push(deck.pop());
    
    if (calculateHand(target.hand) > 21) {
        target.status = "Bust!";
        if (gameStage === "playing") advanceToNextValidPlayer();
        else endRound();
    }
    renderBoard();
});

btnStand.addEventListener("click", () => {
    let target = (gameStage === "dealerTurn") ? dealer : players[turnIndex];
    target.status = "Stand";
    if (gameStage === "playing") {
        turnIndex++;
        advanceToNextValidPlayer();
    } else {
        endRound();
    }
    renderBoard();
});

// NPC AI Logic
function executeNPCTurn() {
    let p = players[turnIndex];
    let sum = calculateHand(p.hand);
    let dealerUp = dealer.hand[0].val;
    
    let optimalMove = "stand";
    if (sum < 12) optimalMove = "hit";
    else if (sum >= 12 && sum <= 16 && dealerUp >= 7) optimalMove = "hit";
    
    let rng = Math.random();
    let move = (rng <= p.intel) ? optimalMove : (optimalMove === "hit" ? "stand" : "hit");
    
    if (move === "hit") {
        p.hand.push(deck.pop());
        if (calculateHand(p.hand) > 21) {
            p.status = "Bust!";
            advanceToNextValidPlayer();
        }
    } else {
        p.status = "Stand";
        turnIndex++;
        advanceToNextValidPlayer();
    }
    renderBoard();
}

function startDealerTurn() {
    gameStage = "dealerTurn";
    dealer.status = "Playing";
    renderBoard();
    
    // If all players busted, dealer doesn't even need to draw.
    let allBusted = players.every(p => calculateHand(p.hand) > 21);
    if (allBusted) endRound();
}

function executeNPCDealer() {
    // Casino Rules: Hit until 17
    let sum = calculateHand(dealer.hand);
    if (sum < 17) {
        dealer.hand.push(deck.pop());
        if (calculateHand(dealer.hand) > 21) dealer.status = "Bust!";
        renderBoard();
    } else {
        dealer.status = "Stand";
        endRound();
    }
}

// ==========================================
// 4. RESOLUTION & PUSHING
// ==========================================
let finalLosers = [];

function endRound() {
    gameStage = "ended";
    let dealerSum = calculateHand(dealer.hand);
    let dealerBust = dealerSum > 21;
    
    finalLosers = [];
    let resultHTML = `<div style="color:white; margin-bottom:10px;">Dealer (${dealer.name}) got <b>${dealerBust ? "BUST" : dealerSum}</b>.</div><hr style="border-color:#24283b;">`;
    
    let anyoneBeatDealer = false;

    players.forEach(p => {
        let pSum = calculateHand(p.hand);
        let pBust = pSum > 21;
        let resColor = "white";
        let resText = "";
        
        if (pBust) {
            resText = "Busted & Lost"; resColor = "#f7768e";
            finalLosers.push(p.name);
        } else if (dealerBust) {
            resText = "Won!"; resColor = "#9ece6a";
            anyoneBeatDealer = true;
        } else if (pSum > dealerSum) {
            resText = "Won!"; resColor = "#9ece6a";
            anyoneBeatDealer = true;
        } else if (pSum < dealerSum) {
            resText = "Lost"; resColor = "#f7768e";
            finalLosers.push(p.name);
        } else {
            resText = "Push (Tie)"; resColor = "#a9b1d6";
        }
        
        resultHTML += `<div style="display:flex; justify-content:space-between; margin-top:5px;">
                        <span>${p.name} (${pSum})</span>
                        <span style="color:${resColor}; font-weight:bold;">${resText}</span>
                       </div>`;
    });
    
    // Check if the Dealer loses (Dealer strips if they bust OR if anyone beats them).
    // (Only add them if they aren't "The Dealer" invisible entity)
    if (dealer.name !== "The Dealer" && (dealerBust || anyoneBeatDealer)) {
        finalLosers.push(dealer.name);
    }
    
    // Remove duplicates from losers array just in case
    finalLosers = [...new Set(finalLosers)];

    endStats.innerHTML = resultHTML;
    renderBoard();
    
    setTimeout(() => {
        gamePanel.style.display = "none";
        endGamePanel.style.display = "block";
    }, 1500);
}

// Mid-Game Push
btnPushMidgame.addEventListener("click", () => {
    let activePlayer = (gameStage === "dealerTurn") ? dealer.name : players[turnIndex].name;
    let upcard = dealer.hand[0];
    
    let pushStr = `<Blackjack Mid-Game State: Dealer (${dealer.name}) shows ${upcard.rank}${upcard.suit}. It is currently ${activePlayer}'s turn to act.>\n<Do not proceed with game in roleplay, game is taking place on separate device. Only roleplay current game state>`;
    
    const userRp = midgameRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
});

// End Game Push
btnCancelEnd.addEventListener("click", () => {
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});

btnConfirmEnd.addEventListener("click", () => {
    let dealerSum = calculateHand(dealer.hand);
    
    // Create text summary of the board
    let summaryStr = `\`Blackjack Round Over! Dealer (${dealer.name}) got ${dealerSum > 21 ? "a BUST" : dealerSum}. `;
    
    let pStrings = players.map(p => {
        let pSum = calculateHand(p.hand);
        return `${p.name} got ${pSum > 21 ? "a BUST" : pSum}`;
    });
    
    summaryStr += pStrings.join(", ") + ".\`";

    const userRp = endRpText.value.trim();
    if (userRp) summaryStr += `\n${userRp}`;

    // FIRE TO BRIDGE WITH LOSERS LIST!
    STBridge.sendMessage(summaryStr, { losers: finalLosers });

    endRpText.value = "";
    endGamePanel.style.display = "none";
    setupPanel.style.display = "block";
});