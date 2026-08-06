// --- START OF FILE script.js ---
import { getRandomListEntry, getExclusionaryName } from './data.js';

let activeChatId = "default";
let editingCodexIndex = -1; 

let gameState = {
    timestamp: 0,
    fuel: 100,
    hull: 100,
    locationState: "Deep Space", 
    currentSystemId: null,
    currentPlanet: null,
    sectors: {}, 
    systems: {},
    codex: [],
    availableNames: null
};

document.querySelectorAll(".in-window").forEach(w => w.style.display = "none");

// --- ST BRIDGE INITIALIZATION ---
window.addEventListener("message", (event) => {
    if (event.data.type === "ST_EVENT") {
        
        if (event.data.event === "CHAT_OPENED") {
            activeChatId = event.data.chatId || "default";
            let stSave = event.data.gameState;
            let localSaveStr = localStorage.getItem(`voyager_save_${activeChatId}`);
            let localSave = localSaveStr ? JSON.parse(localSaveStr) : null;
            
            if (stSave && localSave) {
                gameState = (stSave.timestamp >= localSave.timestamp) ? stSave : localSave;
            } else if (stSave) { gameState = stSave; } 
            else if (localSave) { gameState = localSave; } 
            else { saveGame(); }
            
            if (!gameState.sectors) gameState.sectors = {};
            
            updateUI(); drawMacroMap();
        }

        if (event.data.chat) {
            renderChatLog(event.data.chat);
        }

        // --- BACKGROUND AI PARSER ---
        if (event.data.event === "BACKGROUND_RESPONSE") {
            
            if (event.data.taskId === "excursion_summary") {
                const suggDiv = document.getElementById("modal-suggestions");
                suggDiv.innerHTML = "";
                
                try {
                    let match = event.data.result.match(/\[ENTITIES\]([\s\S]*?)\[\/ENTITIES\]/i);
                    
                    if (match && match[1].trim()) {
                        let names = match[1].split(',')
                            .map(n => n.trim())
                            .filter(n => n.length > 0 && n.toLowerCase() !== 'none');
                            
                        if (names.length > 0) {
                            suggDiv.innerHTML = "<p style='margin-bottom:10px;'>Select an entity to log:</p>";
                            names.forEach(name => {
                                let b = document.createElement("button");
                                b.className = "hud-btn"; b.style.width = "100%"; b.innerText = `+ LOG: ${name}`;
                                b.onclick = () => {
                                    editingCodexIndex = -1;
                                    document.getElementById("log-window-title").innerText = "CAPTAIN'S LOG (NEW ENTRY)";
                                    document.getElementById("codex-name").value = name;
                                    document.getElementById("codex-tags").value = "";
                                    document.getElementById("codex-desc").value = "";
                                    document.getElementById("modal-return").style.display = "none";
                                    openWindow("window-log");
                                };
                                suggDiv.appendChild(b);
                            });
                        } else {
                            suggDiv.innerHTML = "<p>No new major entities detected.</p>";
                        }
                    } else {
                        throw new Error("No markers found");
                    }
                } catch(e) { 
                    console.error("Excursion Summary Error:", e);
                    suggDiv.innerHTML = "<p>Analysis incomplete. Manual entry required.</p>"; 
                }
            }
            
            if (event.data.taskId === "codex_autogen") {
                try {
                    let tagsMatch = event.data.result.match(/\[TAGS\]([\s\S]*?)\[\/TAGS\]/i);
                    let descMatch = event.data.result.match(/\[DESC\]([\s\S]*?)\[\/DESC\]/i);
                    
                    if (tagsMatch) {
                        document.getElementById("codex-tags").value = tagsMatch[1].trim();
                    } else {
                        document.getElementById("codex-tags").value = "Tags generation failed.";
                    }
                    
                    if (descMatch) {
                        document.getElementById("codex-desc").value = descMatch[1].trim();
                    } else {
                        document.getElementById("codex-desc").value = "Description generation failed. Raw output:\n" + event.data.result;
                    }
                } catch (e) {
                    console.error("Codex Autogen Error:", e);
                }
            }
        }
    }
});

window.opener.postMessage({ type: "GAME_READY" }, "*");

function saveGame() {
    gameState.timestamp = Date.now();
    localStorage.setItem(`voyager_save_${activeChatId}`, JSON.stringify(gameState));
    window.opener.postMessage({ type: "SAVE_GAME_STATE", state: gameState }, "*");
}

// --- WINDOW MANAGEMENT ---
function openWindow(windowId) {
    document.querySelectorAll(".in-window").forEach(w => w.style.display = "none");
    document.getElementById(windowId).style.display = "flex";
    if (windowId === "window-index") renderCodex();
    if (windowId === "window-rp") {
        const logContainer = document.getElementById("chat-log");
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}
function closeAllWindows() {
    document.querySelectorAll(".in-window").forEach(w => w.style.display = "none");
}
document.querySelectorAll(".btn-close").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.getElementById(e.target.dataset.target).style.display = "none";
    });
});

document.getElementById("mini-map").addEventListener("click", () => {
    document.getElementById("map-search").value = "";
    document.getElementById("map-search-results").style.display = "none";
    openWindow("window-map");
});

document.getElementById("btn-open-log").addEventListener("click", () => {
    editingCodexIndex = -1;
    document.getElementById("log-window-title").innerText = "CAPTAIN'S LOG (NEW ENTRY)";
    document.getElementById("codex-name").value = "";
    document.getElementById("codex-tags").value = "";
    document.getElementById("codex-desc").value = "";
    openWindow("window-log");
});

document.getElementById("btn-open-index").addEventListener("click", () => openWindow("window-index"));


// --- HUD & MECHANICS ---

// Refuel / Repair Buttons
document.getElementById("btn-refuel").addEventListener("click", () => {
    gameState.fuel = 100; saveGame(); updateUI();
});
document.getElementById("btn-repair").addEventListener("click", () => {
    gameState.hull = 100; saveGame(); updateUI();
});

function jumpSystem() {
    let cost = 3 + Math.floor(Math.random() * 3);
    if (gameState.fuel < cost) {
        return false; // Prevent jump
    }
    gameState.fuel -= cost;
    
    // Clear stale planet data since we left the system
    gameState.currentPlanet = null; 
    
    saveGame();
    return true; // Jump successful
}

function updateUI() {
    document.getElementById("ui-fuel").innerText = gameState.fuel > 25 ? "NOMINAL" : "LOW";
    document.getElementById("ui-fuel").style.color = gameState.fuel > 25 ? "var(--neon-green)" : "#ff3333";
    document.getElementById("ui-hull").innerText = gameState.hull > 40 ? "NOMINAL" : "DAMAGED";
    document.getElementById("ui-location").innerText = gameState.locationState.toUpperCase();

    const btnGoOutside = document.getElementById("btn-go-outside");
    const rpReturnBtn = document.getElementById("btn-return-ship");

    if (gameState.locationState.startsWith("Excursion")) {
        btnGoOutside.style.display = "none";
        rpReturnBtn.innerText = "RETURN TO SHIP";
        let outName = gameState.locationState === "Excursion: Spacewalk" ? "SPACEWALK" : (gameState.currentPlanet ? gameState.currentPlanet.name : "UNKNOWN");
        document.getElementById("rp-window-title").innerText = `ROLEPLAYING [OUTSIDE: ${outName.toUpperCase()}]`;
    } else {
        btnGoOutside.style.display = "block";
        rpReturnBtn.innerText = "CLOSE TERMINAL";
        document.getElementById("rp-window-title").innerText = "SHIP COMMS [STAYING ON BOARD]";
    }
}

// FORMAT CHAT LOG TEXT
function formatChatText(text) {
    let cleanText = text.replace(/\[Loc:[^\]]+\]\s*/gi, ''); // Condensed regex
    cleanText = cleanText.replace(/\[System Note[^\]]+\]\s*/gi, '');
    cleanText = cleanText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    cleanText = cleanText.replace(/(["“”])([\s\S]*?)(["“”])/g, '<span class="rp-quote">$1$2$3</span>');
    cleanText = cleanText.replace(/\*([^*]+)\*/g, '<span class="rp-asterisk">*$1*</span>');
    
    cleanText = cleanText.replace(/\n/g, '<br>');
    return cleanText;
}

function renderChatLog(chatArray) {
    const logContainer = document.getElementById("chat-log");
    const isScrolledToBottom = logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 10;
    logContainer.innerHTML = "";
    
    chatArray.forEach(msg => {
        if(!msg.mes) return; 
        
        let visualText = formatChatText(msg.mes);
        let div = document.createElement("div");
        
        if(!visualText.trim()) {
            div.className = "chat-msg chat-msg-sys";
            div.innerText = "(Location Anchoring Active)";
        } else {
            div.className = "chat-msg " + (msg.is_user ? "chat-msg-user" : "chat-msg-ai");
            let nameSpan = document.createElement("div");
            nameSpan.className = "chat-name";
            nameSpan.innerText = msg.name || (msg.is_user ? "You" : "System / AI");
            
            let textSpan = document.createElement("div");
            textSpan.innerHTML = visualText; 
            
            div.appendChild(nameSpan); 
            div.appendChild(textSpan);
        }
        logContainer.appendChild(div);
    });
    if (isScrolledToBottom) logContainer.scrollTop = logContainer.scrollHeight;
}

function sendLLMMessage(actionText) {
    // Condensed Location Injector to save ST Context Memory
    let finalMessage = `[Loc: ${gameState.locationState}]\n\n` + actionText;
    
    let injectedLore = [];
    let injectedNames = new Set();
    
    gameState.codex.forEach(entry => {
        let triggers = entry.name.split(',').map(t => t.trim()).filter(t => t.length > 0);
        let isTriggered = triggers.some(trigger => {
            let safeTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let regex = new RegExp(`\\b${safeTrigger}\\b`, 'i');
            return regex.test(actionText);
        });

        if (isTriggered) {
            let primaryName = triggers[0];
            injectedLore.push(`${primaryName} (${entry.tags}): ${entry.desc}`);
            injectedNames.add(primaryName);
        }
    });

    if (gameState.currentPlanet && (gameState.locationState.startsWith("Orbit:") || (gameState.locationState.startsWith("Excursion:") && gameState.locationState !== "Excursion: Spacewalk"))) {
        let currentPlanetName = gameState.currentPlanet.name;
        
        let planetEntry = gameState.codex.find(e => e.name.split(',')[0].trim() === currentPlanetName);
        if (planetEntry && !injectedNames.has(currentPlanetName)) {
            injectedLore.push(`${currentPlanetName} (${planetEntry.tags}): ${planetEntry.desc}`);
            injectedNames.add(currentPlanetName);
        }
    }

    if (injectedLore.length > 0) finalMessage += `\n\n[System Note - Memory Recall:\n${injectedLore.join('\n')}]`;

    window.opener.postMessage({ type: "USER_MESSAGE", text: finalMessage }, "*");
}


// --- ACTIONS ---
document.getElementById("btn-go-outside").addEventListener("click", () => {
    if (gameState.locationState === "Deep Space" || gameState.locationState.startsWith("System:")) {
        gameState.locationState = "Excursion: Spacewalk";
        gameState.currentPlanet = null; // Ensure stale planet data doesn't bleed in
        saveGame(); updateUI();
        sendLLMMessage(`*I put on my EVA suit, leave the airlock, and step out into the vacuum of space.*`);
        openWindow("window-rp");
    } else if (gameState.locationState.startsWith("Orbit:") && gameState.currentPlanet) {
        gameState.locationState = `Excursion: ${gameState.currentPlanet.name}`;
        saveGame(); updateUI();
        sendLLMMessage(`*I initiate the landing sequence, leave the ship, and step out onto ${gameState.currentPlanet.name} (Biome: ${gameState.currentPlanet.biome}).*`);
        openWindow("window-rp");
    }
});

document.getElementById("btn-roleplay").addEventListener("click", () => { updateUI(); openWindow("window-rp"); });

document.getElementById("btn-return-ship").addEventListener("click", () => {
    if (gameState.locationState.startsWith("Excursion")) {
        
        if (gameState.locationState === "Excursion: Spacewalk") {
            gameState.locationState = gameState.currentSystemId ? `System: ${gameState.systems[gameState.currentSystemId].name}` : "Deep Space";
        } else {
            gameState.locationState = `Orbit: ${gameState.currentPlanet ? gameState.currentPlanet.name : 'Unknown'}`;
        }
        
        saveGame(); updateUI();
        sendLLMMessage(`*I return to the safety of the ship and close the airlock.*`);
        
        document.getElementById("modal-suggestions").innerText = "[ COMMUNICATING WITH AI ]";
        
        const prompt = `The player just ended an excursion. Based on the recent roleplay, list any newly met characters, new locations, or major factions. 
Output ONLY a comma-separated list of names enclosed in markers like this:
[ENTITIES] Name 1, Name 2, Name 3 [/ENTITIES]
If nothing new was met, output: [ENTITIES] None [/ENTITIES]`;
        
        window.opener.postMessage({ type: "BACKGROUND_PROMPT", prompt: prompt, useContext: true, taskId: "excursion_summary" }, "*");
        
        openWindow("modal-return");
    } else { closeAllWindows(); }
});

document.getElementById("btn-send-rp").addEventListener("click", () => {
    let text = document.getElementById("rp-input").value;
    if (!text.trim()) return;
    sendLLMMessage(text);
    document.getElementById("rp-input").value = "";
});

document.getElementById("rp-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.getElementById("btn-send-rp").click();
    }
});


// --- CODEX SYSTEM (Edit & Auto-Gen) ---
document.getElementById("btn-autogen-codex").addEventListener("click", () => {
    let name = document.getElementById("codex-name").value;
    if(!name) return alert("You must enter an Entity Name first.");
    
    document.getElementById("codex-tags").value = "Generating tags...";
    document.getElementById("codex-desc").value = "Generating description... Please wait.";
    
    let primaryName = name.split(',')[0].trim(); 
    
    const prompt = `Analyze the recent roleplay and write a strictly factual, highly condensed database entry for the entity named '${primaryName}'.
CRITICAL INSTRUCTIONS: Keep the description bare-bones. State ONLY their core identity, primary function, appearance, personality and permanent attributes. DO NOT include lists of transient ideas or past conversational topics.
For TAGS, focus exclusively on personality, disposition, and relationship to the player. Do NOT use tags for objective nouns (like "Android", "AI", "Ship")—put those facts in the description instead.
Output EXACTLY using these markers:
[TAGS] Short comma-separated relationship/personality tags (e.g., Friendly, Sarcastic, Merchant, Hostile, Lover) [/TAGS]
[DESC] The highly condensed, purely factual description. [/DESC]`;

    window.opener.postMessage({ type: "BACKGROUND_PROMPT", prompt: prompt, useContext: true, taskId: "codex_autogen" }, "*");
});

function renderCodex() {
    const list = document.getElementById("codex-list");
    list.innerHTML = "";
    gameState.codex.forEach((entry, index) => {
        let div = document.createElement("div");
        div.style.padding = "10px"; div.style.margin = "10px 0";
        div.style.borderLeft = "2px solid var(--neon-green)";
        div.style.background = "rgba(0,30,0,0.5)";
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <div>
                    <span class="codex-entry-name">${entry.name}</span>
                    <span class="codex-entry-tags">${entry.tags}</span>
                </div>
                <button class="hud-btn" style="padding: 2px 10px; margin:0;" id="edit-codex-${index}">EDIT</button>
            </div>
            <div class="codex-entry-desc">${entry.desc}</div>
        `;
        list.appendChild(div);
        
        document.getElementById(`edit-codex-${index}`).addEventListener("click", () => {
            editingCodexIndex = index;
            document.getElementById("log-window-title").innerText = `CAPTAIN'S LOG (EDITING)`;
            document.getElementById("codex-name").value = entry.name;
            document.getElementById("codex-tags").value = entry.tags;
            document.getElementById("codex-desc").value = entry.desc;
            openWindow("window-log");
        });
    });
}

document.getElementById("btn-save-codex").addEventListener("click", () => {
    let name = document.getElementById("codex-name").value;
    let tags = document.getElementById("codex-tags").value;
    let desc = document.getElementById("codex-desc").value;
    if(name) {
        if(editingCodexIndex >= 0) {
            gameState.codex[editingCodexIndex] = {name, tags, desc};
        } else {
            gameState.codex.push({name, tags, desc});
        }
        saveGame();
        alert("Codex Saved.");
        openWindow("window-index");
    }
});


// --- MAP & SYSTEM NAVIGATION ---
const mapContainer = document.getElementById("map-container");
let currentMapLevel = 'macro';
let viewingSystemId = null; 

document.getElementById("map-search").addEventListener("input", (e) => {
    let q = e.target.value.toLowerCase();
    let resDiv = document.getElementById("map-search-results");
    resDiv.innerHTML = "";
    if (q.length < 2) { resDiv.style.display = "none"; return; }
    
    let matches = [];
    Object.values(gameState.systems).forEach(sys => {
        if (sys.name.toLowerCase().includes(q)) matches.push({ type: 'System', name: sys.name, id: sys.id });
        sys.planets.forEach(p => {
            if (p.scanned && p.name.toLowerCase().includes(q)) {
                matches.push({ type: 'Planet', name: p.name, id: sys.id, pObj: p });
            }
        });
    });

    if (matches.length > 0) {
        resDiv.style.display = "block";
        matches.forEach(m => {
            let d = document.createElement("div");
            d.className = "search-res";
            d.innerText = `[${m.type}] ${m.name}`;
            d.onclick = () => {
                resDiv.style.display = "none";
                document.getElementById("map-search").value = "";
                drawSystemMap(m.id);
                if (m.pObj) selectPlanet(m.pObj, gameState.systems[m.id].name);
            };
            resDiv.appendChild(d);
        });
    } else { resDiv.style.display = "none"; }
});

function drawMacroMap() {
    currentMapLevel = 'macro';
    document.getElementById("map-breadcrumbs").innerText = "> MACRO GALAXY";
    document.getElementById("scan-panel").style.display = "none";
    document.getElementById("sys-warp-overlay").style.display = "none";
    mapContainer.innerHTML = "";
    
    for(let x=0; x<10; x++) {
        for(let y=0; y<10; y++) {
            let cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.style.width = "10%"; cell.style.height = "10%";
            cell.style.left = `${x*10}%`; cell.style.top = `${y*10}%`;
            cell.style.backgroundColor = "rgba(51,255,51,0.05)";
            cell.onclick = () => drawSectorMap(x, y);
            mapContainer.appendChild(cell);
        }
    }
}

function drawSectorMap(x, y) {
    currentMapLevel = 'sector';
    document.getElementById("map-breadcrumbs").innerText = `> SECTOR [${x},${y}]`;
    document.getElementById("sys-warp-overlay").style.display = "none";
    mapContainer.innerHTML = "";

    let secId = `${x}-${y}`;
    
    if (!gameState.sectors[secId]) {
        let numStars = 1 + Math.floor(Math.random() * 4);
        let stars = [];
        for(let i=0; i<numStars; i++) {
            stars.push({
                id: `sys_${x}_${y}_${i}`,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`
            });
        }
        gameState.sectors[secId] = stars;
        saveGame();
    }

    gameState.sectors[secId].forEach(starData => {
        let star = document.createElement("div");
        star.className = "star-icon";
        star.style.left = starData.left;
        star.style.top = starData.top;
        star.onclick = () => drawSystemMap(starData.id);
        mapContainer.appendChild(star);
    });
    
    let back = document.createElement("button");
    back.className = "hud-btn"; back.innerText = "< BACK";
    back.style.position = "absolute"; back.style.bottom = "5px"; back.style.left = "5px";
    back.onclick = drawMacroMap;
    mapContainer.appendChild(back);
}

function drawSystemMap(sysId) {
    currentMapLevel = 'system';
    viewingSystemId = sysId;
    mapContainer.innerHTML = "";
    document.getElementById("scan-panel").style.display = "none";
    activePlanetObj = null;
    
    if (!gameState.systems[sysId]) {
        let numPlanets = 1 + Math.floor(Math.random() * 7);
        let planets = [];
        let hasOccupied = false;
        for(let p=0; p<numPlanets; p++) {
            let type = "Uninhabited";
            if (!hasOccupied) { type = "Occupied"; hasOccupied = true; } 
            else { type = Math.random() > 0.5 ? "Occupied" : "Uninhabited"; }
            planets.push({
                id: `${sysId}_p${p}`, scanned: false, type: type,
                color: `hsl(${Math.random()*360}, 100%, 50%)`, 
                sizePx: 15 + Math.random() * 30, distPx: 50 + (p * 50)
            });
        }
        gameState.systems[sysId] = { id: sysId, name: getExclusionaryName(gameState), planets };
        saveGame();
    }
    
    let sys = gameState.systems[sysId];
    document.getElementById("map-breadcrumbs").innerText = `> SYSTEM: ${sys.name.toUpperCase()}`;

    if (gameState.currentSystemId !== sysId) {
        document.getElementById("sys-warp-overlay").style.display = "block";
    } else {
        document.getElementById("sys-warp-overlay").style.display = "none";
    }

    let sun = document.createElement("div");
    sun.style.position = "absolute"; sun.style.left = "-20px"; sun.style.top = "50%";
    sun.style.width = "60px"; sun.style.height = "120px"; sun.style.background = "#fff";
    sun.style.borderRadius = "0 100px 100px 0"; sun.style.transform = "translateY(-50%)";
    sun.style.boxShadow = "0 0 30px #fff";
    mapContainer.appendChild(sun);

    sys.planets.forEach(pl => {
        let pDiv = document.createElement("div");
        pDiv.className = "planet-icon";
        pDiv.style.width = `${pl.sizePx}px`; pDiv.style.height = `${pl.sizePx}px`;
        pDiv.style.background = pl.scanned ? pl.color : "#555"; 
        pDiv.style.left = `${pl.distPx}px`; pDiv.style.top = `50%`;
        
        pDiv.onclick = () => {
            if(gameState.currentSystemId === sysId) selectPlanet(pl, sys.name);
        };
        mapContainer.appendChild(pDiv);
    });

    let back = document.createElement("button");
    back.className = "hud-btn"; back.innerText = "< BACK";
    back.style.position = "absolute"; back.style.bottom = "5px"; back.style.left = "5px";
    
    let coords = sysId.split('_');
    back.onclick = () => {
        document.getElementById("sys-warp-overlay").style.display = "none";
        drawSectorMap(coords[1], coords[2]);
    };
    mapContainer.appendChild(back);
}

document.getElementById("btn-warp-system").addEventListener("click", () => {
    let success = jumpSystem();
    if (!success) {
        alert("CRITICAL WARNING: Insufficient Quantum Fuel for Warp Jump. Must Refuel.");
        return;
    }
    gameState.currentSystemId = viewingSystemId;
    gameState.locationState = `System: ${gameState.systems[viewingSystemId].name}`;
    saveGame();
    updateUI();
    drawSystemMap(viewingSystemId); 
});

let activePlanetObj = null;

function selectPlanet(planet, systemName) {
    activePlanetObj = planet;
    document.getElementById("scan-panel").style.display = "block";
    document.getElementById("scan-title").innerText = planet.scanned ? `TARGET: ${planet.name.toUpperCase()}` : "TARGET: UNKNOWN";
    
    if (planet.scanned) {
        document.getElementById("btn-scan").style.display = "none";
        document.getElementById("btn-orbit").style.display = "block";
        document.getElementById("scan-data").innerHTML = `<p>BIOME: ${planet.biome}<br>POPULATION: ${planet.type}<br>${planet.biology ? 'BIO: '+planet.biology : ''}</p>`;
    } else {
        document.getElementById("btn-scan").style.display = "block";
        document.getElementById("btn-orbit").style.display = "none";
        document.getElementById("scan-data").innerHTML = "<p>DATA CORRUPT. SCAN REQUIRED.</p>";
    }
}

document.getElementById("btn-scan").addEventListener("click", () => {
    if(!activePlanetObj) return;
    activePlanetObj.scanned = true;
    activePlanetObj.name = getExclusionaryName(gameState);
    
    let rare = Math.random() < 0.2 ? `| Rare: ${getRandomListEntry('rareProperties')}` : "";
    activePlanetObj.biome = `${getRandomListEntry('size')} / ${getRandomListEntry('gravity')} / ${getRandomListEntry('humidity')} / ${getRandomListEntry('weather')} / ${getRandomListEntry('lifeDensity')} ${rare}`;
    
    if (activePlanetObj.type === "Occupied") {
        let optBio = Math.random() < 0.2 ? ` (${getRandomListEntry('biologyDetail2IF')})` : "";
        let optFlaw = Math.random() < 0.2 ? ` Flaw: ${getRandomListEntry('flawIF')}` : "";
        activePlanetObj.biology = `Tech Level: ${getRandomListEntry('technology')} | Bio: ${getRandomListEntry('baseBiology')} [${getRandomListEntry('biologyDetail1')}]${optBio} | Gov: ${getRandomListEntry('government')} (${getRandomListEntry('coreValue')})${optFlaw}`;
    }

    let autoDesc = `Biome: ${activePlanetObj.biome}\nPopulation: ${activePlanetObj.type}`;
    if (activePlanetObj.biology) autoDesc += `\nCulture: ${activePlanetObj.biology}`;
    
    gameState.codex.push({
        name: activePlanetObj.name,
        tags: `Planet, ${gameState.systems[gameState.currentSystemId].name} System`,
        desc: autoDesc
    });

    saveGame();
    selectPlanet(activePlanetObj, null);
    drawSystemMap(viewingSystemId); 
    alert(`Scanned successfully. '${activePlanetObj.name}' added to Codex.`);
});

document.getElementById("btn-orbit").addEventListener("click", () => {
    gameState.locationState = `Orbit: ${activePlanetObj.name}`;
    gameState.currentPlanet = activePlanetObj;
    saveGame();
    updateUI();
    closeAllWindows();
});