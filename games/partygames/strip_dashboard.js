const dashboardContainer = document.getElementById("dashboard-container");
const notifArea = document.getElementById("notifications-area");
const rpText = document.getElementById("rp-text");
const btnPush = document.getElementById("btn-push");
const btnFullReset = document.getElementById("btn-full-reset");
const btnClose = document.getElementById("btn-close");
const statusMsg = document.getElementById("status-msg");

let currentState = { active: false, characters: {} };
let pendingNotifications = []; // Stores manual removals waiting to be pushed

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

// Triggers whenever STBridge or a Game modifies localStorage!
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

window.addEventListener("DOMContentLoaded", loadState);

// ==========================================
// 2. RENDER UI & NOTIFICATIONS
// ==========================================
function renderNotifications() {
    notifArea.innerHTML = "";
    pendingNotifications.forEach(n => {
        let div = document.createElement("div");
        div.className = "notif-banner";
        div.innerHTML = `
            <span><b>${n.charName}:</b> ${n.item} Removed</span>
            <span class="notif-del" data-id="${n.id}" title="Dismiss without pushing">X</span>
        `;
        
        // Remove Notification (Silent discard)
        div.querySelector(".notif-del").addEventListener("click", function() {
            let idToRemove = parseFloat(this.getAttribute("data-id"));
            pendingNotifications = pendingNotifications.filter(pn => pn.id !== idToRemove);
            renderNotifications();
        });
        
        notifArea.appendChild(div);
    });
}

function renderDashboard() {
    dashboardContainer.innerHTML = "";
    
    Object.keys(currentState.characters).forEach(charName => {
        let items = currentState.characters[charName];
        let block = document.createElement("div");
        block.className = "char-block";
        
        let pillsHTML = "";
        if (items.length === 0) {
            pillsHTML = `<div style="color: #f7768e; font-style: italic; margin-bottom: 10px;">Fully stripped!</div>`;
        } else {
            items.forEach((item, index) => {
                pillsHTML += `
                    <div class="item-pill">
                        ${item} 
                        <span class="pill-remove" data-char="${charName}" data-index="${index}" title="Remove item">X</span>
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
    // Manual Remove (X button on clothing pill)
    document.querySelectorAll(".pill-remove").forEach(btn => {
        btn.addEventListener("click", function() {
            let charName = this.getAttribute("data-char");
            let index = parseInt(this.getAttribute("data-index"));
            
            // Remove the item mathematically
            let removedItem = currentState.characters[charName].splice(index, 1)[0];
            let isNaked = currentState.characters[charName].length === 0;
            
            // Add to the notification queue!
            pendingNotifications.push({
                id: Date.now() + Math.random(),
                charName: charName,
                item: removedItem,
                isNaked: isNaked
            });
            
            saveState(); // Save to memory and re-render the list
            renderNotifications(); // Render the new banner
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
                saveState();
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
// 3. PUSHING & GLOBAL CONTROLS
// ==========================================

btnPush.addEventListener("click", () => {
    let outputTags = [];
    
    // Convert notifications into ST system tags
    pendingNotifications.forEach(n => {
        outputTags.push(`<${n.charName} removes ${n.item}>`);
        if (n.isNaked) {
            outputTags.push(`<${n.charName} is now completely naked>`);
        }
    });
    
    let finalOutput = outputTags.join("\n");
    
    // Grab the user roleplay response
    const userRp = rpText.value.trim();
    if (userRp) {
        finalOutput += (finalOutput ? "\n" : "") + userRp;
    }
    
    if (finalOutput) {
        // Send to SillyTavern using the bridge!
        STBridge.sendMessage(finalOutput);
        
        // Clear everything out now that it's sent
        pendingNotifications = [];
        rpText.value = "";
        renderNotifications();
    } else {
        alert("Nothing to push! Remove an item or write a roleplay response first.");
    }
});

btnFullReset.addEventListener("click", () => {
    if(confirm("Are you sure you want to reset everyone's clothing back to the beginning?")) {
        let initialState = localStorage.getItem('partygames_strip_initial');
        if (initialState) {
            localStorage.setItem('partygames_strip_state', initialState);
            pendingNotifications = []; // Clear notifications on reset
            renderNotifications();
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
        window.close();
    }
});