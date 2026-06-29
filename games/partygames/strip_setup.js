// DOM Elements
const numCharsInput = document.getElementById("num-chars");
const nameSlots = document.getElementById("name-slots");
const btnNext = document.getElementById("btn-next");
const btnDisable = document.getElementById("btn-disable");

const phase1 = document.getElementById("phase-1");
const phase2 = document.getElementById("phase-2");
const clothingContainer = document.getElementById("clothing-cards-container");
const btnActivate = document.getElementById("btn-activate");
const btnBack = document.getElementById("btn-back");

const btnAutofill = document.getElementById("btn-autofill");
const autofillStatus = document.getElementById("autofill-status");

let characterNames = [];
let isWaitingForLLM = false;

// ==========================================
// 1. PHASE 1: CHARACTER SETUP
// ==========================================
function renderNameSlots() {
    let count = parseInt(numCharsInput.value) || 2;
    nameSlots.innerHTML = "";
    for (let i = 1; i <= count; i++) {
        let input = document.createElement("input");
        input.type = "text";
        input.className = "text-input char-name-input";
        if (i === 1) input.value = "{{user}}";
        else input.placeholder = `Character ${i}`;
        nameSlots.appendChild(input);
    }
}
numCharsInput.addEventListener("input", renderNameSlots);
window.addEventListener("DOMContentLoaded", () => {
    renderNameSlots();
    let state = localStorage.getItem('partygames_strip_state');
    if (state && JSON.parse(state).active) {
        btnDisable.innerText = "Disable Currently Active Strip Mode";
        btnDisable.style.backgroundColor = "#565f89";
    }
});

btnNext.addEventListener("click", () => {
    characterNames = Array.from(document.querySelectorAll(".char-name-input"))
                          .map(inp => inp.value.trim())
                          .filter(val => val !== "");
    
    if (characterNames.length < 1) return alert("Need at least 1 character.");
    
    renderClothingCards();
    phase1.style.display = "none";
    phase2.style.display = "block";
});

btnDisable.addEventListener("click", () => {
    localStorage.setItem('partygames_strip_state', JSON.stringify({ active: false, characters: {} }));
    alert("Strip Punishment Mode is disabled.");
    window.location.href = "index.html";
});

btnBack.addEventListener("click", () => {
    phase2.style.display = "none";
    phase1.style.display = "block";
});

// ==========================================
// 2. PHASE 2: CLOTHING LISTS
// ==========================================
function renderClothingCards() {
    clothingContainer.innerHTML = "";
    characterNames.forEach(name => {
        let card = document.createElement("div");
        card.className = "char-card";
        card.setAttribute("data-char", name);
        
        card.innerHTML = `
            <div class="char-title">${name}</div>
            <div class="clothing-list">
                <div class="clothing-row">
                    <input type="text" class="text-input" placeholder="e.g. Shirt">
                    <button class="btn-small btn-remove">X</button>
                </div>
            </div>
            <button class="btn-add">+ Add Item</button>
        `;
        
        card.querySelector(".btn-add").addEventListener("click", () => {
            let list = card.querySelector(".clothing-list");
            let row = document.createElement("div");
            row.className = "clothing-row";
            row.innerHTML = `
                <input type="text" class="text-input" placeholder="New Item">
                <button class="btn-small btn-remove">X</button>
            `;
            row.querySelector(".btn-remove").addEventListener("click", () => row.remove());
            list.appendChild(row);
        });
        
        card.querySelector(".btn-remove").addEventListener("click", function() {
            this.parentElement.remove();
        });
        
        clothingContainer.appendChild(card);
    });
}

// ==========================================
// 3. LLM AUTO-FILL SCRAPING
// ==========================================
btnAutofill.addEventListener("click", () => {
    let charString = characterNames.join(", ");
    let prompt = `For the next response do not roleplay. Instead, return a list of the included characters' clothing in the following format: [Name: Item 1, Item 2, Item 3]. Do this for characters: ${charString}. The number of clothing items do not need to be equal. Do not include insignificant items like hair ties or jewellery. Include underwear where worn. Separate underwear for women.`;
    
    STBridge.sendMessage(`<System: ${prompt}>`);
    
    isWaitingForLLM = true;
    autofillStatus.style.display = "block";
    btnAutofill.disabled = true;
});

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "ST_EVENT") return;
    if (!isWaitingForLLM || event.data.event !== "MESSAGE_RECEIVED") return;
    
    let chat = event.data.chat;
    let lastMsg = chat[chat.length - 1];
    if (lastMsg && !lastMsg.is_user) {
        
        let regex = /\[([^\]:]+):\s*([^\]]+)\]/g;
        let match;
        let foundAny = false;
        
        while ((match = regex.exec(lastMsg.mes)) !== null) {
            let foundName = match[1].trim();
            let itemsString = match[2].trim();
            let itemsArray = itemsString.split(",").map(i => i.trim());
            
            let cards = document.querySelectorAll(".char-card");
            cards.forEach(card => {
                let cardName = card.getAttribute("data-char");
                if (cardName.toLowerCase() === foundName.toLowerCase()) {
                    foundAny = true;
                    let list = card.querySelector(".clothing-list");
                    list.innerHTML = "";
                    
                    itemsArray.forEach(item => {
                        let row = document.createElement("div");
                        row.className = "clothing-row";
                        row.innerHTML = `<input type="text" class="text-input" value="${item}"><button class="btn-small btn-remove">X</button>`;
                        row.querySelector(".btn-remove").addEventListener("click", () => row.remove());
                        list.appendChild(row);
                    });
                }
            });
        }
        
        if (foundAny) {
            autofillStatus.innerText = "Successfully scraped clothing from LLM!";
            window.opener.postMessage({ type: "REWRITE_MESSAGE", messageId: chat.length - 1, text: "*The group evaluates their attire.*" }, "*");
        } else {
            autofillStatus.innerText = "Failed to detect format. You may need to input manually.";
            autofillStatus.style.color = "#f7768e";
        }
        
        isWaitingForLLM = false;
        btnAutofill.disabled = false;
    }
});

// ==========================================
// 4. ACTIVATE, SAVE & SPAWN DASHBOARD
// ==========================================
btnActivate.addEventListener("click", () => {
    let finalState = {
        active: true,
        characters: {}
    };
    
    let cards = document.querySelectorAll(".char-card");
    cards.forEach(card => {
        let name = card.getAttribute("data-char");
        let inputs = card.querySelectorAll(".clothing-row input");
        let items = Array.from(inputs).map(i => i.value.trim()).filter(v => v !== "");
        finalState.characters[name] = items;
    });
    
    // Save live state
    localStorage.setItem('partygames_strip_state', JSON.stringify(finalState));
    // Save a backup copy for the "Full Reset" feature
    localStorage.setItem('partygames_strip_initial', JSON.stringify(finalState));
    
    // Pop-out the Dashboard in a new window!
    window.open("strip_dashboard.html", "StripDashboard", "width=500,height=700");
    
    // Return this current main window to the menu
    window.location.href = "index.html";
});