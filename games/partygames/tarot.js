// DOM Elements
const setupPhase = document.getElementById("setup-phase");
const gameControlsPhase = document.getElementById("game-controls-phase");
const btnStart = document.getElementById("btn-start");
const btnReset = document.getElementById("btn-reset");

const targetNameInput = document.getElementById("target-name");
const spreadTypeSelect = document.getElementById("spread-type");
const drawMethodSelect = document.getElementById("draw-method");

const readingTable = document.getElementById("reading-table");
const welcomeText = document.getElementById("welcome-text");
const gameStatusText = document.getElementById("game-status-text");

const btnPushSingle = document.getElementById("btn-push-single");
const btnPushAll = document.getElementById("btn-push-all");
const rpText = document.getElementById("rp-text");

// Tarot Card Data Generation (1 to 78)
const majorArcana = [
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", 
    "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit", 
    "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", 
    "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World"
];
const minorSuits = ["Wands", "Cups", "Swords", "Pentacles"];
const minorRanks = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];

const tarotDeckMap = {}; // Maps ID 1-78 to { name: "...", img: "assets/tarot/X.jpg" }

// Populate mapping dictionary dynamically
for (let i = 1; i <= 78; i++) {
    let cardName = "";
    if (i <= 22) {
        cardName = majorArcana[i - 1]; // 1-22
    } else if (i <= 36) {
        cardName = `${minorRanks[i - 23]} of Wands`; // 23-36
    } else if (i <= 50) {
        cardName = `${minorRanks[i - 37]} of Cups`; // 37-50
    } else if (i <= 64) {
        cardName = `${minorRanks[i - 51]} of Swords`; // 51-64
    } else {
        cardName = `${minorRanks[i - 65]} of Pentacles`; // 65-78
    }
    
    // Assume .jpg based on standard asset loads
    tarotDeckMap[i] = { id: i, name: cardName, img: `assets/tarot/${i}.jpg` };
}

// Game State
let currentSpread = []; // Array of drawn cards
let cardsRevealed = 0;
let lastRevealedCard = null; // Used for single-push

// ==========================================
// 1. GAME INITIALIZATION
// ==========================================
btnStart.addEventListener("click", () => {
    let spreadCount = parseInt(spreadTypeSelect.value);
    let method = drawMethodSelect.value;
    
    // Create a fresh array of 1-78 and shuffle it
    let deck = Array.from({length: 78}, (_, i) => i + 1);
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    currentSpread = [];
    cardsRevealed = 0;
    lastRevealedCard = null;
    
    // Determine Labels based on Spread Type
    const labels3Card = ["The Past", "The Present", "The Future"];
    const labels1Card = ["The Core Issue"];
    let labels = spreadCount === 3 ? labels3Card : labels1Card;

    // Draw the required number of cards
    for (let i = 0; i < spreadCount; i++) {
        let cardId = deck.pop();
        let isReversed = Math.random() < 0.5; // 50% chance to be reversed
        
        currentSpread.push({
            id: cardId,
            name: tarotDeckMap[cardId].name,
            img: tarotDeckMap[cardId].img,
            isReversed: isReversed,
            label: labels[i],
            revealed: false
        });
    }

    renderTable(method);
    
    setupPhase.style.display = "none";
    gameControlsPhase.style.display = "block";
    welcomeText.style.display = "none";
    
    btnPushAll.disabled = true;
    btnPushSingle.style.display = "none";
    rpText.value = "";
    
    if (method === "manual") {
        gameStatusText.innerText = "Click the face-down cards to reveal them one by one.";
    } else {
        gameStatusText.innerText = "The cards have spoken.";
        revealAllCardsInstantly();
    }
});

// ==========================================
// 2. RENDERING & FLIPPING
// ==========================================
function renderTable(method) {
    readingTable.innerHTML = "";
    
    currentSpread.forEach((card, index) => {
        let slot = document.createElement("div");
        slot.className = "tarot-slot";
        
        // Setup orientation logic for the front image
        let frontClass = "tarot-card-front";
        if (card.isReversed) frontClass += " reversed-img"; // Applies CSS 180deg flip
        
        slot.innerHTML = `
            <div class="tarot-label">${card.label}</div>
            <div class="tarot-card-wrapper" id="card-wrapper-${index}">
                <div class="tarot-card-inner">
                    <div class="tarot-card-back"></div>
                    <div class="${frontClass}" style="background-image: url('${card.img}');"></div>
                </div>
            </div>
            <div class="tarot-result-name" id="card-name-${index}"></div>
        `;
        
        readingTable.appendChild(slot);
        
        // Add manual click listener
        if (method === "manual") {
            let wrapper = slot.querySelector(`#card-wrapper-${index}`);
            wrapper.addEventListener("click", () => {
                if (!card.revealed) revealCard(index);
            });
        }
    });
}

function revealCard(index) {
    let card = currentSpread[index];
    card.revealed = true;
    cardsRevealed++;
    lastRevealedCard = card;
    
    // CSS flip animation
    let wrapper = document.getElementById(`card-wrapper-${index}`);
    wrapper.classList.add("revealed");
    
    // Set text below card
    let nameDiv = document.getElementById(`card-name-${index}`);
    nameDiv.innerHTML = `${card.name}<br><span style="font-size: 0.8em; color: #787c99;">(${card.isReversed ? 'Reversed' : 'Upright'})</span>`;
    
    // UI Updates
    if (cardsRevealed < currentSpread.length) {
        btnPushSingle.style.display = "block";
        btnPushSingle.innerText = `Push newly revealed card: ${card.name}`;
    } else {
        // Last card was revealed
        btnPushSingle.style.display = "none";
        btnPushAll.disabled = false;
        gameStatusText.innerText = "The reading is complete. Push the final results!";
    }
}

function revealAllCardsInstantly() {
    currentSpread.forEach((_, index) => revealCard(index));
}

// ==========================================
// 3. PUSH MESSAGES
// ==========================================
btnPushSingle.addEventListener("click", () => {
    if (!lastRevealedCard) return;
    
    let target = targetNameInput.value.trim() || "{{user}}";
    let orientation = lastRevealedCard.isReversed ? "Reversed" : "Upright";
    
    let pushStr = `<Tarot Reading for ${target}: ${lastRevealedCard.label} - Drawn ${lastRevealedCard.name} (${orientation})>`;
    
    const userRp = rpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    
    // Hide the single push button until the next card is flipped, and clear RP text
    btnPushSingle.style.display = "none";
    rpText.value = "";
});

btnPushAll.addEventListener("click", () => {
    let target = targetNameInput.value.trim() || "{{user}}";
    let resultsArr = currentSpread.map(c => {
        let orientation = c.isReversed ? "Reversed" : "Upright";
        return `${c.label}: ${c.name} (${orientation})`;
    });
    
    let pushStr = `<Full Tarot Reading for ${target}:\n- ${resultsArr.join("\n- ")}>`;
    
    const userRp = rpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    
    // Cleanup and reset
    rpText.value = "";
    resetToSetup();
});

btnReset.addEventListener("click", resetToSetup);

function resetToSetup() {
    readingTable.innerHTML = "";
    welcomeText.style.display = "block";
    gameControlsPhase.style.display = "none";
    setupPhase.style.display = "block";
}