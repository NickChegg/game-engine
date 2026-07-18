// DOM Elements - Setup
const variantSelect = document.getElementById("game-variant");
const startingChipsInput = document.getElementById("starting-chips");
const numPlayersInput = document.getElementById("num-players");
const playersContainer = document.getElementById("players-container");
const btnStart = document.getElementById("btn-start");
const setupPanel = document.getElementById("setup-panel");
const stripToggle = document.getElementById("strip-toggle");
const stripRuleSelect = document.getElementById("strip-rule");

// DOM Elements - Game Board
const gamePanel = document.getElementById("game-panel");
const gameTitle = document.getElementById("game-title");
const stripAlert = document.getElementById("strip-alert");
const gameLog = document.getElementById("game-log");
const turnStatus = document.getElementById("turn-status");
const userControls = document.getElementById("user-controls");
const btnNext = document.getElementById("btn-next");
const btnCall = document.getElementById("btn-call");
const btnRaise = document.getElementById("btn-raise");
const btnFold = document.getElementById("btn-fold");
const betSlider = document.getElementById("bet-slider");
const betValDisplay = document.getElementById("bet-val-display");
const btnPushMidgame = document.getElementById("btn-push-midgame");
const midgameRpText = document.getElementById("midgame-rp-text");

const opponentsList = document.getElementById("opponents-list");
const potAmount = document.getElementById("pot-amount");
const communityCardsContainer = document.getElementById("community-cards-container");
const phaseTitle = document.getElementById("phase-title");
const userHandContainer = document.getElementById("user-hand-container");
const userChips = document.getElementById("user-chips");
const userHandEval = document.getElementById("user-hand-eval");

// DOM Elements - End Screen
const endPanel = document.getElementById("end-panel");
const endTitle = document.getElementById("end-title");
const endStats = document.getElementById("end-stats");
const endRpText = document.getElementById("end-rp-text");
const btnConfirmEnd = document.getElementById("btn-confirm-end");
const btnCancelEnd = document.getElementById("btn-cancel-end");

// Game State
let players = [];
let deck = [];
let communityCards = [];
let pot = 0;
let currentBet = 0;
let variant = "texas"; // 'texas' or 'draw'
let isStripEnabled = false;
let stripRule = "round"; // 'round' or 'bust'

// Round State
let activePlayers = []; // Indices of players still in the hand
let turnIndex = 0; 
let dealerIndex = 0;
let phase = ""; 
let minRaise = 20; // Big blind size
let lastBettorIndex = -1; // To know when betting round is complete

const suits = ['♥', '♦', '♠', '♣'];
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const rankValues = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

// ==========================================
// 1. SETUP UI
// ==========================================
stripToggle.addEventListener("change", (e) => {
    stripRuleSelect.style.display = e.target.checked ? "block" : "none";
});

function updateSetupUI() {
    let count = parseInt(numPlayersInput.value) || 2;
    if (count > 6) count = 6;
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
            let intInp = `<select class="select-input p-intel" ${isUserSlot ? 'style="display:none;"' : ''}>
                            <option value="0.5">Simple AI</option>
                            <option value="0.7" selected>Average AI</option>
                            <option value="0.9">Pro AI</option>
                          </select>`;
                          
            row.innerHTML = `<div style="flex:2;">${nameInp}</div><div style="flex:1;">${intInp}</div>`;
            playersContainer.appendChild(row);
        }
    } else if (currentCount > count) {
        for (let i = currentCount; i > count; i--) playersContainer.removeChild(playersContainer.lastChild);
    }
}
numPlayersInput.addEventListener("input", updateSetupUI);
window.addEventListener("DOMContentLoaded", updateSetupUI);

// ==========================================
// 2. INITIALIZATION
// ==========================================
btnStart.addEventListener("click", () => {
    variant = variantSelect.value;
    isStripEnabled = stripToggle.checked;
    stripRule = stripRuleSelect.value;
    let sChips = parseInt(startingChipsInput.value) || 1000;
    
    players = [];
    let rows = playersContainer.querySelectorAll(".flex-row");
    rows.forEach((row, idx) => {
        let n = row.querySelector(".p-name").value.trim() || `Player ${idx+1}`;
        let intel = parseFloat(row.querySelector(".p-intel").value) || 0.7;
        players.push({ id: idx, name: n, chips: sChips, hand: [], currentBet: 0, isUser: (idx === 0), intel: intel, status: "Active" });
    });
    
    gameTitle.innerText = variant === "texas" ? "Texas Hold'em" : "5-Card Draw";
    stripAlert.style.display = isStripEnabled ? "block" : "none";
    dealerIndex = Math.floor(Math.random() * players.length); // Random dealer
    
    setupPanel.style.display = "none";
    gamePanel.style.display = "block";
    
    startRound();
});

// ==========================================
// 3. CORE LOGIC
// ==========================================
function buildDeck() {
    deck = [];
    for (let s of suits) {
        for (let r of ranks) {
            let color = (s === '♥' || s === '♦') ? 'card-red' : 'card-black';
            deck.push({ rank: r, suit: s, color: color, val: rankValues[r] });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function renderCard(card, hidden = false) {
    if (hidden) return `<div class="playing-card card-hidden">?</div>`;
    return `<div class="playing-card ${card.color}">${card.rank}${card.suit}</div>`;
}

function addToLog(msg) {
    const p = document.createElement("p");
    p.innerHTML = msg;
    gameLog.appendChild(p);
    gameLog.scrollTop = gameLog.scrollHeight;
}

function startRound() {
    // Remove busted players
    players = players.filter(p => p.chips > 0);
    if (players.length < 2) { endGame(true); return; }
    
    dealerIndex = (dealerIndex + 1) % players.length;
    buildDeck();
    communityCards = [];
    pot = 0;
    currentBet = minRaise; // Big blind size
    gameLog.innerHTML = "";
    
    players.forEach(p => { p.hand = []; p.currentBet = 0; p.status = "Active"; });
    activePlayers = players.map(p => p.id);
    
    // Blinds setup
    let sbIndex = (dealerIndex + 1) % players.length;
    let bbIndex = (dealerIndex + 2) % players.length;
    if (players.length === 2) { sbIndex = dealerIndex; bbIndex = (dealerIndex + 1) % players.length; } // Heads up exception
    
    forceBet(sbIndex, minRaise / 2);
    forceBet(bbIndex, minRaise);
    
    addToLog(`<b>--- New Round ---</b>`);
    
    // Deal Hole Cards
    let numCards = variant === "texas" ? 2 : 5;
    for (let i = 0; i < numCards; i++) {
        activePlayers.forEach(pid => {
            let p = players.find(pl => pl.id === pid);
            p.hand.push(deck.pop());
        });
    }
    
    phase = variant === "texas" ? "Pre-Flop" : "Pre-Draw";
    startBettingRound((bbIndex + 1) % players.length);
}

function forceBet(pIndex, amount) {
    let p = players[pIndex];
    let actualBet = Math.min(amount, p.chips);
    p.chips -= actualBet;
    p.currentBet += actualBet;
    pot += actualBet;
}

function updateBoard() {
    potAmount.innerText = pot;
    phaseTitle.innerText = phase;
    
    communityCardsContainer.innerHTML = "";
    if (variant === "texas") {
        communityCards.forEach(c => communityCardsContainer.innerHTML += renderCard(c));
    }
    
    opponentsList.innerHTML = "";
    players.forEach(p => {
        if (p.isUser) return;
        
        let cardCount = p.hand.length;
        let html = `<div class="opp-card ${activePlayers.includes(p.id) ? '' : 'folded'} ${turnIndex === players.indexOf(p) && activePlayers.includes(p.id) ? 'active-turn' : ''}">
            <div class="opp-name">${p.name} ${players.indexOf(p) === dealerIndex ? '🅓' : ''}</div>
            <div class="opp-chips">🪙 ${p.chips}</div>`;
        if (p.currentBet > 0) html += `<div style="font-size:0.8em; color:#a9b1d6;">Bet: ${p.currentBet}</div>`;
        html += `<div style="display:flex; justify-content:center; margin-top:5px; gap:2px;">`;
        for(let i=0; i<cardCount; i++) html += `<div class="playing-card card-hidden" style="width:15px; height:25px; min-width:15px;"></div>`;
        html += `</div></div>`;
        opponentsList.innerHTML += html;
    });
    
    let user = players[0];
    userChips.innerText = user.chips;
    userHandContainer.innerHTML = "";
    user.hand.forEach((c, idx) => {
        let el = document.createElement('div');
        el.innerHTML = renderCard(c);
        if (phase === "Draw Phase") {
            el.firstChild.classList.add("card-selectable");
            if (c.discard) el.firstChild.classList.add("card-discarded");
            el.onclick = () => { c.discard = !c.discard; updateBoard(); };
        }
        userHandContainer.appendChild(el.firstChild);
    });
    
    if (variant === "texas" || (variant === "draw" && activePlayers.length > 1)) {
        let eval = evaluateHand(user.hand, communityCards);
        userHandEval.innerText = eval.name;
    } else {
        userHandEval.innerText = "";
    }
}

// ==========================================
// 4. BETTING SYSTEM
// ==========================================
function startBettingRound(startIndex) {
    turnIndex = startIndex;
    lastBettorIndex = startIndex; // Everyone must act at least once
    players.forEach(p => p.status = (activePlayers.includes(p.id) ? "Active" : "Folded"));
    
    // Check if only 1 person has chips left to bet (All In situation)
    let playersWithChips = activePlayers.filter(pid => players.find(pl => pl.id === pid).chips > 0);
    if (playersWithChips.length <= 1) {
        addToLog(`<i>Players are All-In. Moving to showdown.</i>`);
        rapidDealToRiver();
        return;
    }
    
    processTurn();
}

function nextTurn() {
    turnIndex = (turnIndex + 1) % players.length;
    let p = players[turnIndex];
    
    // Check if betting round is over
    if (turnIndex === lastBettorIndex) {
        // Did everyone match the current bet, or are they all-in?
        let allMatched = true;
        for (let pid of activePlayers) {
            let pl = players.find(x => x.id === pid);
            if (pl.chips > 0 && pl.currentBet < currentBet) allMatched = false;
        }
        if (allMatched) {
            advancePhase();
            return;
        }
    }
    
    if (!activePlayers.includes(p.id) || p.chips === 0) {
        nextTurn(); // Skip folded or all-in players
        return;
    }
    processTurn();
}

function processTurn() {
    updateBoard();
    let p = players[turnIndex];
    let callAmount = currentBet - p.currentBet;
    callAmount = Math.min(callAmount, p.chips); // Can't bet more than they have
    
    if (p.isUser) {
        turnStatus.innerText = "Your Turn";
        userControls.style.display = "block";
        btnNext.style.display = "none";
        
        btnCall.innerText = callAmount > 0 ? `Call (${callAmount})` : "Check";
        
        betSlider.max = p.chips;
        betSlider.min = callAmount > 0 ? callAmount + minRaise : minRaise;
        betSlider.value = betSlider.min;
        betValDisplay.innerText = betSlider.value;
        betSlider.oninput = () => betValDisplay.innerText = betSlider.value;
        
        // Disable raise if they can't afford min raise above call
        btnRaise.disabled = (p.chips <= callAmount);
    } else {
        turnStatus.innerText = `${p.name}'s Turn`;
        userControls.style.display = "none";
        btnNext.style.display = "block";
        btnNext.innerText = "Execute NPC Action";
        btnNext.onclick = executeNPCAction;
    }
}

// User Actions
btnFold.onclick = () => {
    let p = players[0];
    addToLog(`<b>You</b> folded.`);
    activePlayers = activePlayers.filter(id => id !== p.id);
    userControls.style.display = "none";
    checkWinByFold();
};

btnCall.onclick = () => {
    let p = players[0];
    let callAmount = currentBet - p.currentBet;
    callAmount = Math.min(callAmount, p.chips);
    
    p.chips -= callAmount;
    p.currentBet += callAmount;
    pot += callAmount;
    
    if (callAmount > 0) addToLog(`<b>You</b> called ${callAmount}.`);
    else addToLog(`<b>You</b> checked.`);
    
    userControls.style.display = "none";
    nextTurn();
};

btnRaise.onclick = () => {
    let p = players[0];
    let raiseTotal = parseInt(betSlider.value);
    let amountToAdd = raiseTotal - p.currentBet; // E.g., currentBet is 40. I have 20 in. I raise to 60. I add 40.
    
    p.chips -= amountToAdd;
    p.currentBet = raiseTotal;
    pot += amountToAdd;
    currentBet = raiseTotal;
    lastBettorIndex = turnIndex; // Reset betting loop
    
    addToLog(`<b>You</b> raised to ${currentBet}.`);
    userControls.style.display = "none";
    nextTurn();
};

// NPC Actions
function executeNPCAction() {
    let p = players[turnIndex];
    let callAmount = currentBet - p.currentBet;
    let handStrength = calculateAIStrength(p);
    
    let action = "call";
    
    // Logic: if call > 0 and weak hand -> fold. If strong hand -> raise.
    if (callAmount > 0 && handStrength < 0.35 && Math.random() < p.intel) {
        action = "fold";
    } else if (handStrength > 0.75 && p.chips > callAmount + minRaise && Math.random() < p.intel) {
        action = "raise";
    }
    
    // Bluffs
    if (action === "fold" && Math.random() < 0.1) action = "raise"; // Rare bluff
    
    if (action === "fold") {
        addToLog(`<b>${p.name}</b> folded.`);
        activePlayers = activePlayers.filter(id => id !== p.id);
        checkWinByFold();
    } else if (action === "raise") {
        let raiseTotal = currentBet + minRaise;
        let amountToAdd = raiseTotal - p.currentBet;
        amountToAdd = Math.min(amountToAdd, p.chips);
        raiseTotal = p.currentBet + amountToAdd;
        
        p.chips -= amountToAdd;
        p.currentBet = raiseTotal;
        pot += amountToAdd;
        currentBet = raiseTotal;
        lastBettorIndex = turnIndex;
        
        addToLog(`<b>${p.name}</b> raised to ${currentBet}.`);
        nextTurn();
    } else { // Call / Check
        callAmount = Math.min(callAmount, p.chips);
        p.chips -= callAmount;
        p.currentBet += callAmount;
        pot += callAmount;
        
        if (callAmount > 0) addToLog(`<b>${p.name}</b> called ${callAmount}.`);
        else addToLog(`<b>${p.name}</b> checked.`);
        nextTurn();
    }
}

function checkWinByFold() {
    if (activePlayers.length === 1) {
        let winner = players.find(p => p.id === activePlayers[0]);
        addToLog(`<span style="color:#9ece6a;">Everyone else folded. ${winner.name} wins the pot of ${pot}!</span>`);
        winner.chips += pot;
        setTimeout(endRoundByFold, 1500);
    } else {
        nextTurn();
    }
}

// ==========================================
// 5. PHASE ADVANCEMENT
// ==========================================
function advancePhase() {
    // Reset bets for new phase
    players.forEach(p => p.currentBet = 0);
    currentBet = 0;
    
    if (variant === "texas") {
        if (phase === "Pre-Flop") {
            phase = "The Flop";
            communityCards.push(deck.pop(), deck.pop(), deck.pop());
            addToLog(`<b>--- The Flop ---</b>`);
            startBettingRound((dealerIndex + 1) % players.length);
        } else if (phase === "The Flop") {
            phase = "The Turn";
            communityCards.push(deck.pop());
            addToLog(`<b>--- The Turn ---</b>`);
            startBettingRound((dealerIndex + 1) % players.length);
        } else if (phase === "The Turn") {
            phase = "The River";
            communityCards.push(deck.pop());
            addToLog(`<b>--- The River ---</b>`);
            startBettingRound((dealerIndex + 1) % players.length);
        } else {
            resolveShowdown();
        }
    } else {
        // 5 Card Draw
        if (phase === "Pre-Draw") {
            phase = "Draw Phase";
            addToLog(`<b>--- Draw Phase ---</b>`);
            executeDrawPhase();
        } else if (phase === "Post-Draw") {
            resolveShowdown();
        }
    }
}

function rapidDealToRiver() {
    if (variant === "texas") {
        while (communityCards.length < 5) communityCards.push(deck.pop());
    } else {
        if (phase === "Pre-Draw") processNPCDraws();
    }
    resolveShowdown();
}

// --- 5 Card Draw Specifics ---
function executeDrawPhase() {
    updateBoard();
    turnStatus.innerText = "Select cards to discard, then confirm.";
    btnNext.style.display = "block";
    btnNext.innerText = "Confirm Discards";
    userControls.style.display = "none";
    
    btnNext.onclick = () => {
        let u = players[0];
        let keeps = [];
        let countReplaced = 0;
        u.hand.forEach(c => {
            if (c.discard) countReplaced++;
            else keeps.push(c);
        });
        u.hand = keeps;
        for(let i=0;i<countReplaced;i++) u.hand.push(deck.pop());
        addToLog(`<b>You</b> discarded ${countReplaced} cards.`);
        
        processNPCDraws();
        
        phase = "Post-Draw";
        addToLog(`<b>--- Final Betting ---</b>`);
        startBettingRound((dealerIndex + 1) % players.length);
    };
}

function processNPCDraws() {
    activePlayers.forEach(pid => {
        if (pid === 0) return; // User done
        let p = players.find(x => x.id === pid);
        let ev = evaluateHand(p.hand, []);
        let toKeep = [];
        
        // Very basic AI draw logic: keep pairs/high cards
        let ranksSeen = {}; p.hand.forEach(c => ranksSeen[c.val] = (ranksSeen[c.val]||0)+1);
        p.hand.forEach(c => {
            if (ranksSeen[c.val] > 1 || c.val > 10) toKeep.push(c);
        });
        
        // If keeping all, maybe discard lowest to pretend to draw
        if (toKeep.length === 5) toKeep.pop();
        
        let discarded = 5 - toKeep.length;
        p.hand = toKeep;
        for(let i=0;i<discarded;i++) p.hand.push(deck.pop());
        addToLog(`<b>${p.name}</b> discarded ${discarded} cards.`);
    });
}

// ==========================================
// 6. HAND EVALUATION & SHOWDOWN
// ==========================================
function resolveShowdown() {
    phase = "Showdown";
    updateBoard();
    
    let bestScore = -1;
    let winners = [];
    let resultsLog = `<b>--- SHOWDOWN ---</b><br>`;
    
    let evals = {};
    
    activePlayers.forEach(pid => {
        let p = players.find(x => x.id === pid);
        let ev = evaluateHand(p.hand, communityCards);
        evals[p.id] = ev;
        
        let handHtml = p.hand.map(c => `<span class="${c.color}">${c.rank}${c.suit}</span>`).join(" ");
        resultsLog += `${p.name}: ${ev.name} [${handHtml}]<br>`;
        
        if (ev.score > bestScore) { bestScore = ev.score; winners = [p]; }
        else if (ev.score === bestScore) {
            // Tie-breaker based on high card value logic returned in ev.tiebreaker
            if (ev.tiebreaker > evals[winners[0].id].tiebreaker) { winners = [p]; }
            else if (ev.tiebreaker === evals[winners[0].id].tiebreaker) { winners.push(p); }
        }
    });
    
    addToLog(resultsLog);
    
    let winAmount = Math.floor(pot / winners.length);
    let winNames = winners.map(w => w.name).join(" and ");
    addToLog(`<span style="color:#9ece6a; font-weight:bold;">${winNames} wins ${winAmount} with ${evals[winners[0].id].name}!</span>`);
    
    winners.forEach(w => w.chips += winAmount);
    
    setTimeout(() => { triggerRoundEndUI(winners.map(w => w.name), false); }, 2500);
}

function endRoundByFold() {
    let winner = players.find(p => p.id === activePlayers[0]);
    triggerRoundEndUI([winner.name], true);
}

function calculateAIStrength(player) {
    let ev = evaluateHand(player.hand, communityCards);
    // Base score 0 (High Card) to 8 (Str Flush)
    let strength = ev.score / 8;
    if (variant === "texas" && communityCards.length === 0) {
        // Pre-flop strength logic (pairs are good, high cards are good)
        let v1 = player.hand[0].val; let v2 = player.hand[1].val;
        if (v1 === v2) strength = 0.6 + (v1/14)*0.4;
        else strength = ((v1+v2) / 28) * 0.5;
    }
    return strength;
}

// Compact Hand Evaluator
function evaluateHand(hole, comm) {
    let all = hole.concat(comm);
    if (all.length === 0) return { score: 0, name: "Nothing", tiebreaker: 0 };
    
    let counts = {}; let suitsObj = {};
    all.forEach(c => {
        counts[c.val] = (counts[c.val] || 0) + 1;
        suitsObj[c.suit] = (suitsObj[c.suit] || 0) + 1;
    });
    
    let isFlush = Object.values(suitsObj).some(v => v >= 5);
    let vals = Object.keys(counts).map(Number).sort((a,b)=>b-a);
    
    let isStraight = false; let straightHigh = 0;
    for (let i=0; i<=vals.length-5; i++) {
        if (vals[i] - vals[i+4] === 4) { isStraight = true; straightHigh = vals[i]; break; }
    }
    // Low Ace straight check (14, 5, 4, 3, 2)
    if (!isStraight && vals.includes(14) && vals.includes(5) && vals.includes(4) && vals.includes(3) && vals.includes(2)) {
        isStraight = true; straightHigh = 5;
    }

    let pairs = []; let threes = []; let fours = [];
    for (let v in counts) {
        if (counts[v] === 2) pairs.push(Number(v));
        if (counts[v] === 3) threes.push(Number(v));
        if (counts[v] === 4) fours.push(Number(v));
    }
    pairs.sort((a,b)=>b-a); threes.sort((a,b)=>b-a);
    
    let high = vals[0] || 0;
    
    if (isFlush && isStraight) return { score: 8, name: "Straight Flush", tiebreaker: straightHigh };
    if (fours.length > 0) return { score: 7, name: "Four of a Kind", tiebreaker: fours[0]*100 + high };
    if (threes.length > 0 && pairs.length > 0) return { score: 6, name: "Full House", tiebreaker: threes[0]*100 + pairs[0] };
    if (isFlush) return { score: 5, name: "Flush", tiebreaker: high };
    if (isStraight) return { score: 4, name: "Straight", tiebreaker: straightHigh };
    if (threes.length > 0) return { score: 3, name: "Three of a Kind", tiebreaker: threes[0]*100 + high };
    if (pairs.length > 1) return { score: 2, name: "Two Pair", tiebreaker: pairs[0]*100 + pairs[1]*10 + high };
    if (pairs.length === 1) return { score: 1, name: "Pair", tiebreaker: pairs[0]*100 + high };
    return { score: 0, name: "High Card", tiebreaker: high };
}

// ==========================================
// 7. ENDING & DATA PUSHING
// ==========================================
let roundLosers = [];
let gameLosers = [];

function triggerRoundEndUI(winnerNamesList, byFold) {
    gamePanel.style.display = "none";
    endPanel.style.display = "block";
    endTitle.innerText = "Round Complete";
    
    roundLosers = [];
    gameLosers = [];
    
    // Identify who lost the round
    players.forEach(p => {
        if (!winnerNamesList.includes(p.name)) {
            if (activePlayers.includes(p.id) || p.chips === 0) roundLosers.push(p.name);
            if (p.chips <= 0) gameLosers.push(p.name);
        }
    });
    
    let summ = `<div style="color:#e0af68; font-size:1.2em; font-weight:bold; margin-bottom:15px;">${winnerNamesList.join(" & ")} won the pot of ${pot}!</div>`;
    
    // Output current chip standings
    players.sort((a,b) => b.chips - a.chips).forEach(p => {
        let color = p.chips <= 0 ? "#f7768e" : "white";
        let bustStr = p.chips <= 0 ? " (Busted)" : "";
        summ += `<div style="display:flex; justify-content:space-between; color:${color}; padding: 5px; border-bottom:1px solid #24283b;">
                    <span>${p.name} ${bustStr}</span>
                    <span style="font-weight:bold;">${p.chips}</span>
                 </div>`;
    });
    endStats.innerHTML = summ;
    
    // Context formatting for STBridge
    btnConfirmEnd.onclick = () => {
        let gameResult = null;
        let pushMsg = `\`Poker Round Over. ${winnerNamesList.join(" & ")} won a pot of ${pot} chips.\`\n`;
        
        // Apply Strip logic if checked
        if (isStripEnabled) {
            if (stripRule === "round" && roundLosers.length > 0) {
                gameResult = { losers: roundLosers };
                pushMsg += `\`[Strip Rule Active: Losers of the round remove an item!]\`\n`;
            } else if (stripRule === "bust" && gameLosers.length > 0) {
                gameResult = { losers: gameLosers };
                pushMsg += `\`[Strip Rule Active: Busted players remove an item!]\`\n`;
            }
        }
        
        let alive = players.filter(p => p.chips > 0);
        pushMsg += `<Chip Standings: ${alive.map(p => `${p.name} (${p.chips})`).join(", ")}>`;
        
        let rp = endRpText.value.trim();
        if (rp) pushMsg += `\n${rp}`;
        
        STBridge.sendMessage(pushMsg, gameResult);
        
        endRpText.value = "";
        endPanel.style.display = "none";
        
        if (alive.length === 1) endGame(false);
        else {
            gamePanel.style.display = "block";
            startRound();
        }
    };
}

function endGame(forced) {
    endPanel.style.display = "block";
    gamePanel.style.display = "none";
    
    let alive = players.filter(p => p.chips > 0);
    if (alive.length === 1 && !forced) {
        endTitle.innerText = "Game Over!";
        endStats.innerHTML = `<h2 style="color:#9ece6a; margin-bottom:10px;">🏆 ${alive[0].name} Wins the Game!</h2>`;
    } else {
        endTitle.innerText = "Game Terminated";
    }
    
    btnConfirmEnd.style.display = "none";
    btnCancelEnd.innerText = "Return to Menu";
}

btnCancelEnd.onclick = () => {
    endPanel.style.display = "none";
    setupPanel.style.display = "block";
    btnConfirmEnd.style.display = "block";
};

// Mid-Game Push
btnPushMidgame.onclick = () => {
    let p = players[turnIndex];
    let potStr = `Pot is ${pot}. `;
    let commStr = communityCards.length > 0 ? `Community cards: ${communityCards.map(c=>c.rank+c.suit).join(', ')}. ` : "";
    let pushStr = `<Poker Mid-Game: ${variant === "texas" ? "Texas Hold'em" : "5-Card Draw"}. Phase: ${phase}. ${potStr}${commStr}It is currently ${p.name}'s turn.>\n<Do not proceed with game mechanics in roleplay, only roleplay current game state>`;
    
    let rp = midgameRpText.value.trim();
    if (rp) pushStr += `\n${rp}`;
    
    STBridge.sendMessage(pushStr);
    midgameRpText.value = "";
};