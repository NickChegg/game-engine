// DOM Elements - Left Panel
const presetDropdown = document.getElementById("preset-dropdown");
const btnLoadPreset = document.getElementById("btn-load-preset");
const btnDelPreset = document.getElementById("btn-del-preset");
const wheelMode = document.getElementById("wheel-mode");
const segmentsContainer = document.getElementById("segments-container");
const btnAddSegment = document.getElementById("btn-add-segment");
const namesContainer = document.getElementById("names-container");
const btnAddName = document.getElementById("btn-add-name");
const btnRandomizeNames = document.getElementById("btn-randomize-names");
const btnPushOrder = document.getElementById("btn-push-order");
const rpTextOrder = document.getElementById("rp-text-order");
const saveNameInput = document.getElementById("save-name-input");
const btnSavePreset = document.getElementById("btn-save-preset");

// DOM Elements - Colors Modal
const colorModal = document.getElementById("color-modal");
const btnEditColors = document.getElementById("btn-edit-colors");
const colorsListContainer = document.getElementById("colors-list-container");
const btnAddColor = document.getElementById("btn-add-color");
const btnSaveColors = document.getElementById("btn-save-colors");
const btnCloseColors = document.getElementById("btn-close-colors");

// DOM Elements - Right Panel
const currentSpinnerUi = document.getElementById("current-spinner-ui");
const canvas = document.getElementById("wheel-canvas");
const ctx = canvas.getContext("2d");
const btnSpin = document.getElementById("btn-spin");
const resultBox = document.getElementById("result-box");
const resultText = document.getElementById("result-text");
const rpText = document.getElementById("rp-text");
const btnPushResult = document.getElementById("btn-push-result");

// State Variables
let segments = ["Gold", "Silver", "Mimic", "Healing Potion", "Trap"];
let names = [];
let nameIndex = 0;
let defaultColors = ["#ffb3ba", "#ffdfba", "#ffffba", "#baffc9", "#bae1ff", "#e0b0ff"];
let savedData = { presets: [], colors: defaultColors };

let currentRotation = 0;
let isSpinning = false;
let lastLandedIndex = -1;

// ==========================================
// 1. INITIALIZATION & STORAGE
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    let rawData = localStorage.getItem("partygames_spinwheel_data");
    if (rawData) {
        let parsed = JSON.parse(rawData);
        savedData.presets = parsed.presets || [];
        savedData.colors = parsed.colors || defaultColors;
    }
    
    refreshDropdown();
    renderSegments();
    renderNames();
    drawWheel();
    updateSpinnerUI();
});

function saveToLocalStorage() {
    localStorage.setItem("partygames_spinwheel_data", JSON.stringify(savedData));
    refreshDropdown();
}

function refreshDropdown() {
    presetDropdown.innerHTML = "";
    if (savedData.presets.length === 0) {
        presetDropdown.innerHTML = `<option value="">-- No Saved Wheels --</option>`;
        return;
    }
    savedData.presets.forEach((p, idx) => {
        let opt = document.createElement("option");
        opt.value = idx;
        opt.innerText = p.name;
        presetDropdown.appendChild(opt);
    });
}

// ==========================================
// 2. SETUP UI RENDERING (Segments & Names)
// ==========================================
function renderSegments() {
    segmentsContainer.innerHTML = "";
    segments.forEach((seg, idx) => {
        let row = document.createElement("div");
        row.className = "flex-row";
        row.style.marginBottom = "5px";
        row.innerHTML = `
            <input type="text" class="text-input seg-input" value="${seg}">
            <button class="btn-small" style="background:#f7768e;" onclick="removeSegment(${idx})">X</button>
        `;
        segmentsContainer.appendChild(row);
    });
    
    // Add listeners to auto-update the wheel when typing
    document.querySelectorAll(".seg-input").forEach((inp, idx) => {
        inp.addEventListener("input", (e) => {
            segments[idx] = e.target.value;
            drawWheel();
        });
    });
}

window.removeSegment = (idx) => {
    segments.splice(idx, 1);
    renderSegments();
    drawWheel();
};

btnAddSegment.addEventListener("click", () => {
    segments.push("New Option");
    renderSegments();
    drawWheel();
});

function renderNames() {
    namesContainer.innerHTML = "";
    names.forEach((name, idx) => {
        let row = document.createElement("div");
        row.className = "flex-row";
        row.style.marginBottom = "5px";
        row.innerHTML = `
            <input type="text" class="text-input name-input" value="${name}" placeholder="Spinner Name">
            <button class="btn-small" style="background:#f7768e;" onclick="removeName(${idx})">X</button>
        `;
        namesContainer.appendChild(row);
    });
    
    document.querySelectorAll(".name-input").forEach((inp, idx) => {
        inp.addEventListener("input", (e) => {
            names[idx] = e.target.value;
            updateSpinnerUI();
        });
    });
}

window.removeName = (idx) => {
    names.splice(idx, 1);
    if (nameIndex >= names.length) nameIndex = 0;
    renderNames();
    updateSpinnerUI();
};

btnAddName.addEventListener("click", () => {
    names.push(names.length === 0 ? "{{user}}" : "");
    renderNames();
    updateSpinnerUI();
});

btnRandomizeNames.addEventListener("click", () => {
    for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
    }
    renderNames();
    updateSpinnerUI();
});

function updateSpinnerUI() {
    if (names.length === 0) {
        currentSpinnerUi.innerText = "";
    } else {
        let activeName = names[nameIndex] || "Unnamed";
        currentSpinnerUi.innerText = `Up to spin: ${activeName}`;
    }
}

// ==========================================
// 3. PRESETS SAVING / LOADING
// ==========================================
btnSavePreset.addEventListener("click", () => {
    let pName = saveNameInput.value.trim();
    if (!pName) return alert("Please enter a name for the wheel.");
    
    // Clean segments array
    let cleanSegs = Array.from(document.querySelectorAll(".seg-input"))
                         .map(i => i.value.trim())
                         .filter(v => v !== "");
    
    if (cleanSegs.length === 0) return alert("Wheel cannot be empty.");
    
    savedData.presets.push({
        name: pName,
        segments: cleanSegs,
        mode: wheelMode.value
    });
    
    saveToLocalStorage();
    saveNameInput.value = "";
    alert(`Wheel '${pName}' saved!`);
});

btnLoadPreset.addEventListener("click", () => {
    let val = presetDropdown.value;
    if (val === "") return;
    
    let preset = savedData.presets[val];
    segments = [...preset.segments];
    wheelMode.value = preset.mode || "keep";
    
    renderSegments();
    drawWheel();
});

btnDelPreset.addEventListener("click", () => {
    let val = presetDropdown.value;
    if (val === "") return;
    if (confirm("Delete this saved wheel?")) {
        savedData.presets.splice(val, 1);
        saveToLocalStorage();
    }
});

// ==========================================
// 4. COLOR CUSTOMIZER MODAL
// ==========================================
btnEditColors.addEventListener("click", () => {
    renderColorModal();
    colorModal.style.display = "flex";
});

btnCloseColors.addEventListener("click", () => {
    colorModal.style.display = "none";
});

function renderColorModal() {
    colorsListContainer.innerHTML = "";
    savedData.colors.forEach((col, idx) => {
        let row = document.createElement("div");
        row.className = "color-swatch-row";
        row.innerHTML = `
            <input type="color" class="color-picker c-input" value="${col}" style="width:40px; height:40px;">
            <input type="text" class="text-input c-hex" value="${col}" style="flex:1;">
            <button class="btn-small" style="background:#f7768e;" onclick="this.parentElement.remove()">X</button>
        `;
        // Sync color picker and text box
        row.querySelector('.c-input').addEventListener('input', (e) => row.querySelector('.c-hex').value = e.target.value);
        row.querySelector('.c-hex').addEventListener('input', (e) => row.querySelector('.c-input').value = e.target.value);
        
        colorsListContainer.appendChild(row);
    });
}

btnAddColor.addEventListener("click", () => {
    let row = document.createElement("div");
    row.className = "color-swatch-row";
    row.innerHTML = `
        <input type="color" class="color-picker c-input" value="#ffffff" style="width:40px; height:40px;">
        <input type="text" class="text-input c-hex" value="#ffffff" style="flex:1;">
        <button class="btn-small" style="background:#f7768e;" onclick="this.parentElement.remove()">X</button>
    `;
    row.querySelector('.c-input').addEventListener('input', (e) => row.querySelector('.c-hex').value = e.target.value);
    row.querySelector('.c-hex').addEventListener('input', (e) => row.querySelector('.c-input').value = e.target.value);
    colorsListContainer.appendChild(row);
});

btnSaveColors.addEventListener("click", () => {
    let newColors = Array.from(colorsListContainer.querySelectorAll('.c-hex'))
                         .map(inp => inp.value.trim());
    if (newColors.length === 0) newColors = defaultColors;
    
    savedData.colors = newColors;
    saveToLocalStorage();
    colorModal.style.display = "none";
    drawWheel();
});

// ==========================================
// 5. WHEEL DRAWING (CANVAS)
// ==========================================
function drawWheel() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 2; // Leave a tiny gap for border
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (segments.length === 0) return;
    
    const arc = (2 * Math.PI) / segments.length;
    
    for (let i = 0; i < segments.length; i++) {
        // Draw Slice
        ctx.beginPath();
        ctx.fillStyle = savedData.colors[i % savedData.colors.length];
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, i * arc, (i + 1) * arc);
        ctx.lineTo(cx, cy);
        ctx.fill();
        ctx.stroke(); // Inner slice borders

        // Draw Text
        ctx.save();
        ctx.translate(cx, cy);
        // Rotate to the center of the slice
        ctx.rotate(i * arc + arc / 2);
        
        ctx.textAlign = "right";
        ctx.fillStyle = "#111"; // Black text
        ctx.font = "bold 18px sans-serif";
        
        // Truncate text visually if it's super long
        let text = segments[i];
        if (text.length > 20) text = text.substring(0, 18) + "...";
        
        // Write text near the outer edge
        ctx.fillText(text, radius - 20, 6);
        ctx.restore();
    }
}

// ==========================================
// 6. SPIN ANIMATION & MATH
// ==========================================
btnSpin.addEventListener("click", () => {
    if (isSpinning || segments.length === 0) return;
    isSpinning = true;
    resultBox.style.display = "none";
    
    // Pick winner mathematically first
    lastLandedIndex = Math.floor(Math.random() * segments.length);
    
    // Calculate angles
    const sliceAngle = 360 / segments.length;
    
    // We add a tiny random offset within the slice so the pointer doesn't land dead-center every time
    const randomOffsetInSlice = (Math.random() * (sliceAngle * 0.8)) - (sliceAngle * 0.4); 
    
    // Target calculation: 270 degrees is top (pointer). 
    const targetSliceAngle = (lastLandedIndex * sliceAngle) + (sliceAngle / 2) + randomOffsetInSlice;
    
    // Add 5 full rotations (1800 deg) + offset needed to put target at top
    let baseSpins = Math.floor(currentRotation / 360) * 360 + 1800;
    let targetRotation = baseSpins + 270 - targetSliceAngle;
    
    // Apply CSS transition
    canvas.style.transition = "transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)";
    canvas.style.transform = `rotate(${targetRotation}deg)`;
    currentRotation = targetRotation;
    
    // Wait for animation to finish
    setTimeout(() => {
        isSpinning = false;
        showResult();
    }, 4000);
});

function showResult() {
    let winner = segments[lastLandedIndex];
    resultText.innerText = winner;
    resultBox.style.display = "block";
    
    if (wheelMode.value === "remove") {
        // Remove mathematically
        segments.splice(lastLandedIndex, 1);
        renderSegments(); // Updates inputs on the left
        
        // To remove visual popping, we have to reset rotation to 0 silently
        canvas.style.transition = "none";
        canvas.style.transform = "rotate(0deg)";
        currentRotation = 0;
        void canvas.offsetHeight; // Force CSS reflow
        
        drawWheel(); // Redraw the new array mathematically aligned to 0
    }
}

// ==========================================
// 7. PUSH TO SILLYTAVERN
// ==========================================
btnPushOrder.addEventListener("click", () => {
    if (names.length < 2) return alert("Add at least 2 names to push an order.");
    
    let pushStr = `<The spinning order for the wheel is: ${names.join(", ")}>`;
    
    // Grab the new roleplay text
    const userRpOrder = rpTextOrder.value.trim();
    if (userRpOrder) pushStr += `\n${userRpOrder}`;
    
    STBridge.sendMessage(pushStr);
    
    // Clear the box after pushing
    rpTextOrder.value = ""; 
});

btnPushResult.addEventListener("click", () => {
    let result = resultText.innerText;
    let pushStr = "";
    
    if (names.length > 0) {
        let activeName = names[nameIndex] || "Unknown";
        pushStr = `\`${activeName} spun the wheel and landed on: ${result}!\``;
        // Advance Turn automatically
        nameIndex = (nameIndex + 1) % names.length;
        updateSpinnerUI();
    } else {
        pushStr = `\`The wheel was spun and landed on: ${result}!\``;
    }
    
    const userRp = rpText.value.trim();
    if (userRp) pushStr += `\n${userRp}`;
    
    STBridge.sendMessage(pushStr);
    
    rpText.value = "";
    resultBox.style.display = "none";
});