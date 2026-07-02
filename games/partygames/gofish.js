// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const infoPhase = document.getElementById("info-phase");
const gamePanel = document.getElementById("game-panel");
const endPhase = document.getElementById("end-phase");

const numPlayersInput = document.getElementById("num-players");
const playerListContainer = document.getElementById("player-list-container");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const opponentsUI = document.getElementById("opponents-ui");
const pondDeckUI = document.getElementById("pond-deck-ui");
const pondCount = document.getElementById("pond-count");
const userBooks = document.getElementById("user-books");
const userHand = document.getElementById("user-hand");

// Phases
const phaseRequest = document.getElementById("phase-request");
const phaseFish = document.getElementById("phase-fish");
const phaseBook = document.getElementById("phase-book");

// Action Elements
const reqTarget = document.getElementById("req-target");
const reqRank = document.getElementById("req-rank");
const btnMakeRequest = document.getElementById("btn-make-request");
const requestTitle = document.getElementById("request-title");

const fishDesc = document.getElementById("fish-desc");
const fishRpText = document.getElementById("fish-rp-text");
const btnPushFish = document.getElementById("btn-push-fish");
const btnResolveFish = document.getElementById("btn-resolve-fish");

const bookDesc = document.getElementById("book-desc");
const bookRpText = document.getElementById("book-rp-text");
const btnPushBook = document.getElementById("btn-push-book");
const btnNextTurn = document.getElementById("btn-next-turn");

const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnPushEnd = document.getElementById("btn-push-end");
const btnBackMenu = document.getElementById("btn-back-menu");

// Game State
let players = [];
let deck = [];
let activePlayerIdx = 0;
let pendingAction = null; // { asker, target, rank }
let outcomeResult = ""; // Stores text of what happened for Phase 3
let gameOverTriggered = false;

// ==========================================
// 1. SETUP
// ==========================================
function renderPlayerSlots() {
    let targetCount = parseInt(numPlayersInput.value) || 2;
    let currentCount = playerListContainer.children.length;
    
    if (currentCount < targetCount) {
        for (let i = currentCount; i < targetCount; i++) {
            let input = document.createElement("input");
            input.type = "text";
            input.className = "text-input p-name";
            if (i === 0) input.value = "{{user}}";
            else input.placeholder = `Player ${i+1}`;
            playerListContainer.appendChild(input);
        }
    } else if (currentCount > targetCount) {
        for (let i = currentCount; i > targetCount; i--) {
            playerListContainer.removeChild(playerListContainer.lastChild);
        }
    }
}
numPlayersInput.addEventListener("input", renderPlayerSlots);
window.addEventListener("DOMContentLoaded", renderPlayerSlots);

btnStart.addEventListener("click", () => {
    let names = Array.from(document.querySelectorAll(".p-name")).map(i => i.value.trim() || "NPC");
    let startingCards = (names.length <= 3) ? 7 : 5;
    
    players = names.map((n, i) => ({
        name: n,
        isUser: (i === 0),
        hand: [],
        books: 0
    }));
    
    buildDeck();
    
    // Deal
    for (let i = 0; i < startingCards; i++) {
        players.forEach(p => p.hand.push(deck.pop()));
    }
    
    // Check initial books silently
    players.forEach(p => checkBooks(p, true));
    
    activePlayerIdx = 0;
    gameOverTriggered = false;
    
    setupPhase.style.display = "none";
    infoPhase.style.display = "block";
    gamePanel.style.display = "block";
    
    startTurn();
});

btnRestart.addEventListener("click", () => {
    infoPhase.style.display = "none";
    gamePanel.style.display = "none";
    setupPhase.style.display = "block";
});

// ==========================================
// 2. CORE ENGINE & RENDERING
// ==========================================
function buildDeck() {
    deck = [];
    const suits = ['♥', '♦', '♠', '♣'];
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    for (let s of suits) {
        for (let r of ranks) {
            let color = (s === '♥' || s === '♦') ? 'card-red' : 'card-black';
            deck.push({ rank: r, suit: s, color: color, display: `${r}${s}` });
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function renderCard(c) {
    return `<div class="playing-card ${c.color}">${c.display}</div>`;
}

function sortHand(hand) {
    const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    hand.sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));
}

function renderBoard() {
    // 1. Pond
    pondCount.innerText = deck.length;
    if (deck.length === 0) {
        pondDeckUI.className = "gf-pond-empty";
        pondDeckUI.innerHTML = "Empty";
    } else {
        pondDeckUI.className = "gf-pond-deck";
        pondDeckUI.innerHTML = "";
    }
    
    // 2. Opponents
    opponentsUI.innerHTML = "";
    players.forEach((p, idx) => {
        if (p.isUser) return;
        let div = document.createElement("div");
        div.className = "gf-opp-card" + (idx === activePlayerIdx ? " active-turn" : "");
        div.innerHTML = `
            <div class="gf-opp-name">${p.name}</div>
            <div class="gf-opp-stats">Cards: ${p.hand.length} | Books: ${p.books}</div>
        `;
        opponentsUI.appendChild(div);
    });
    
    // 3. User Hand
    let user = players[0];
    userBooks.innerText = user.books;
    userHand.innerHTML = "";
    sortHand(user.hand);
    user.hand.forEach(c => userHand.innerHTML += renderCard(c));
}

// ==========================================
// 3. TURN PHASES
// ==========================================
function startTurn() {
    renderBoard();
    if (checkWinCondition()) return;
    
    let p = players[activePlayerIdx];
    
    phaseFish.style.display = "none";
    phaseBook.style.display = "none";
    phaseRequest.style.display = "block";
    
    if (p.isUser) {
        requestTitle.innerText = "Your Turn: Make a Request";
        
        // Populate Targets
        reqTarget.innerHTML = "";
        players.forEach((opp, idx) => {
            if (!opp.isUser && opp.hand.length > 0) {
                let opt = document.createElement("option");
                opt.value = idx;
                opt.innerText = opp.name;
                reqTarget.appendChild(opt);
            }
        });
        
        // Populate Ranks (Must hold at least 1)
        reqRank.innerHTML = "";
        let uniqueRanks = [...new Set(p.hand.map(c => c.rank))];
        uniqueRanks.forEach(r => {
            let opt = document.createElement("option");
            opt.value = r;
            opt.innerText = r;
            reqRank.appendChild(opt);
        });
        
        btnMakeRequest.style.display = "block";
    } else {
        requestTitle.innerText = `${p.name}'s Turn...`;
        btnMakeRequest.style.display = "none";
        
        // AI Logic
        setTimeout(() => {
            let validTargets = players.map((opp, idx) => ({opp, idx}))
                                      .filter(obj => obj.idx !== activePlayerIdx && obj.opp.hand.length > 0);
            
            let targetObj = validTargets[Math.floor(Math.random() * validTargets.length)];
            let randomCard = p.hand[Math.floor(Math.random() * p.hand.length)];
            
            pendingAction = { asker: p, target: targetObj.opp, rank: randomCard.rank };
            enterFishPhase();
        }, 800);
    }
}

btnMakeRequest.addEventListener("click", () => {
    let tIdx = parseInt(reqTarget.value);
    pendingAction = {
        asker: players[0],
        target: players[tIdx],
        rank: reqRank.value
    };
    enterFishPhase();
});

// PHASE 2: FISH
function enterFishPhase() {
    phaseRequest.style.display = "none";
    phaseFish.style.display = "block";
    
    fishDesc.innerText = `${pendingAction.asker.name} is asking ${pendingAction.target.name} for ${pendingAction.rank}s.`;
    
    // Enable push button so user can push hidden hands to ST
    btnPushFish.disabled = false;
}

btnPushFish.addEventListener("click", () => {
    let a = pendingAction.asker;
    let t = pendingAction.target;
    let r = pendingAction.rank;
    
    let aHand = a.hand.map(c => c.display).join(", ");
    let tHand = t.hand.map(c => c.display).join(", ");
    
    let pushStr = `<${a.name} asks ${t.name} if they have any ${r}s.>\n<Hidden Knowledge: ${a.name}'s hand: [${aHand}]. ${t.name}'s hand: [${tHand}]. Roleplay the response.>`;
    
    const userRp = fishRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    
    fishRpText.value = "";
    btnPushFish.disabled = true; // Prevent spamming
});

// PHASE 3: RESOLVE & BOOK
btnResolveFish.addEventListener("click", () => {
    let a = pendingAction.asker;
    let t = pendingAction.target;
    let rank = pendingAction.rank;
    
    let transferCards = t.hand.filter(c => c.rank === rank);
    outcomeResult = "";
    
    if (transferCards.length > 0) {
        // Success
        t.hand = t.hand.filter(c => c.rank !== rank);
        a.hand.push(...transferCards);
        outcomeResult = `${t.name} had ${transferCards.length} ${rank}(s) and gave them to ${a.name}.`;
    } else {
        // Go Fish
        if (deck.length > 0) {
            let drawn = deck.pop();
            a.hand.push(drawn);
            
            // Note: In standard rules, if you draw the rank you asked for, you show it and go again. 
            // For LLM simplicity and preventing infinite AI loops, we just end the turn.
            outcomeResult = `${t.name} said "Go Fish!" ${a.name} drew from the pond.`;
            if (a.isUser) outcomeResult += ` (You drew a ${drawn.display}).`;
        } else {
            outcomeResult = `${t.name} said "Go Fish!" but the pond is empty.`;
        }
    }
    
    // Check Books
    let aBooks = checkBooks(a, false);
    let tBooks = checkBooks(t, false); // Target might have gotten a book... wait, target only lost cards.
    
    if (aBooks > 0) outcomeResult += ` ${a.name} completed a book!`;
    
    phaseFish.style.display = "none";
    phaseBook.style.display = "block";
    bookDesc.innerText = outcomeResult;
    
    renderBoard();
    
    // Check win condition immediately after resolving
    if (checkWinCondition()) {
        btnNextTurn.innerText = "Game Over!";
    } else {
        btnNextTurn.innerText = "Next Turn";
    }
    
    btnPushBook.disabled = false;
});

function checkBooks(player, silent) {
    let rankCounts = {};
    player.hand.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
    
    let booksMade = 0;
    for (let r in rankCounts) {
        if (rankCounts[r] === 4) {
            player.hand = player.hand.filter(c => c.rank !== r);
            player.books++;
            booksMade++;
        }
    }
    return booksMade;
}

btnPushBook.addEventListener("click", () => {
    let stateStrs = players.map(p => `${p.name} has ${p.hand.length} cards, ${p.books} books`);
    let pushStr = `\`${outcomeResult}\`\n<Board State: ${stateStrs.join(". ")}. Pond has ${deck.length}.>`;
    
    const userRp = bookRpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    
    bookRpText.value = "";
    btnPushBook.disabled = true;
});

btnNextTurn.addEventListener("click", () => {
    if (gameOverTriggered) {
        showEndScreen();
    } else {
        // Standard progression
        activePlayerIdx = (activePlayerIdx + 1) % players.length;
        startTurn();
    }
});

// ==========================================
// 4. WIN CONDITION & STRIP HOOK
// ==========================================
function checkWinCondition() {
    let emptyPlayers = players.filter(p => p.hand.length === 0);
    
    if (emptyPlayers.length > 0) {
        gameOverTriggered = true;
        return true;
    }
    return false;
}

function showEndScreen() {
    gamePanel.style.display = "none";
    infoPhase.style.display = "none";
    
    let emptyPlayers = players.filter(p => p.hand.length === 0);
    let winner = emptyPlayers[0];
    
    // Edge Case: Simultaneous Zero Cards (Asker took Target's last card, and made a book hitting 0)
    if (emptyPlayers.length > 1) {
        emptyPlayers.sort((a, b) => b.books - a.books);
        winner = emptyPlayers[0]; // Highest books wins tie-breaker
    }
    
    // Setup End Screen
    endPhase.style.display = "block";
    endStats.innerHTML = `<span style="color: #9ece6a;">${winner.name} won by running out of cards!</span><br><span style="font-size: 0.8em; color: #a9b1d6;">They had ${winner.books} books.</span>`;
    
    // Setup the Strip Logic hook
    let losers = players.filter(p => p.name !== winner.name).map(p => p.name);
    
    btnPushEnd.onclick = () => {
        let summaryStr = `\`${winner.name} ran out of cards and won the game of Go Fish with ${winner.books} books!\``;
        
        const userRp = endRpText.value.trim();
        if (userRp) summaryStr += `\n${userRp}`;

        // Fire to Strip Bridge
        STBridge.sendMessage(summaryStr, { losers: losers });
        
        endRpText.value = "";
        endPhase.style.display = "none";
        setupPhase.style.display = "block";
    };
}

btnBackMenu.addEventListener("click", () => {
    endPhase.style.display = "none";
    setupPhase.style.display = "block";
});