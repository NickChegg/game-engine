const dashboardContainer = document.getElementById("dashboard-container");
const btnFullReset = document.getElementById("btn-full-reset");
const btnClose = document.getElementById("btn-close");
const statusMsg = document.getElementById("status-msg");

let currentState = { active: false, characters: {} };

// ==========================================
// 1. LOAD & SYNC STATE
// ==========================================
function loadState() {
    let stateRaw = localStorage.getItem('partygames_strip_state');
    if (stateRaw) {
        currentState = JSON.parse(stateRaw);
        if (currentState.active) {
            renderDashboard();
        } else {
            showDisabled();
        }
    } else {
        showDisabled();
    }
}

// THE MAGIC LISTENER: Triggers whenever STBridge or a Game modifies localStorage!
window.addEventListener("storage", (e) => {
    if (e.key === 'partygames_strip_state') {
        statusMsg.innerText = "Game results received! State updated.";
        statusMsg.style.color = "#bb9af7";
        setTimeout(() => { 
            statusMsg.innerText = "Monitoring game results..."; 
            statusMsg.style.color = "#9ece6a";
        }, 3000);
        
        loadState();
    }
});

// Initial load
window.addEventListener("DOMContentLoaded", loadState);

// ==========================================
// 2. RENDER UI
// ==========================================
function renderDashboard() {
    dashboardContainer.innerHTML = "";
    
    Object.keys(currentState.characters).forEach(charName => {
        let items = currentState.characters[charName];
        
        let block = document.createElement("div");
        block.className = "char-block";
        
        // Build the pills
        let pillsHTML = "";
        if (items.length === 0) {
            pillsHTML = `<div style="color: #f7768e; font-style: italic; margin-bottom: 10px;">Fully stripped!</div>`;
        } else {
            items.forEach((item, index) => {
                pillsHTML += `
                    <div class="item-pill">
                        ${item} 
                        <span class="pill-remove" data-char="${charName}" data-index="${index}">X</span>
                    </div>
                `;
            });
        }
        
        block.innerHTML = `
            <div class="char-title">
                <span>${charName}</span>
                <span class="char-count">${items.length} items left</span>
            </div>
            <div class="pill-container">
                ${pillsHTML}
            </div>
            <div class="add-row">
                <input type="text" class="add-input" id="add-input-${charName}" placeholder="Manual add/rollback item...">
                <button class="add-btn" data-char="${charName}">+</button>
            </div>
        `;
        
        dashboardContainer.appendChild(block);
    });
    
    attachListeners();
}

function attachListeners() {
    // Manual Remove (X button on pill)
    document.querySelectorAll(".pill-remove").forEach(btn => {
        btn.addEventListener("click", function() {
            let charName = this.getAttribute("data-char");
            let index = parseInt(this.getAttribute("data-index"));
            
            currentState.characters[charName].splice(index, 1);
            saveState(); // Save and re-render
        });
    });
    
    // Manual Add / Rollback (+ button)
    document.querySelectorAll(".add-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            let charName = this.getAttribute("data-char");
            let inputField = document.getElementById(`add-input-${charName}`);
            let newItem = inputField.value.trim();
            
            if (newItem) {
                currentState.characters[charName].push(newItem);
                saveState(); // Save and re-render
            }
        });
    });
}

function saveState() {
    localStorage.setItem('partygames_strip_state', JSON.stringify(currentState));
    renderDashboard();
}

function showDisabled() {
    document.getElementById("app").innerHTML = `
        <div class="panel text-center">
            <h2 style="color: #f7768e; margin-bottom: 15px;">Strip Mode is Off</h2>
            <p style="color: #787c99;">You can safely close this window.</p>
        </div>
    `;
}

// ==========================================
// 3. GLOBAL CONTROLS
// ==========================================
btnFullReset.addEventListener("click", () => {
    if(confirm("Are you sure you want to reset everyone's clothing back to the beginning?")) {
        let initialState = localStorage.getItem('partygames_strip_initial');
        if (initialState) {
            localStorage.setItem('partygames_strip_state', initialState);
            loadState();
            
            statusMsg.innerText = "Restored to original state!";
            statusMsg.style.color = "#e0af68";
        } else {
            alert("Could not find the initial backup state!");
        }
    }
});

btnClose.addEventListener("click", () => {
    if(confirm("Are you sure you want to completely end and disable Strip Mode?")) {
        localStorage.setItem('partygames_strip_state', JSON.stringify({ active: false, characters: {} }));
        window.close(); // Automatically close the popout window!
    }
});