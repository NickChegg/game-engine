let isEnabled = false;
let latestChat = [];
let isSimulatedSwipe = false;
const stWindow = window.opener;

// --- CSS INJECTION (Hides the tag in ST) ---
if (stWindow && stWindow.document) {
    const style = stWindow.document.createElement('style');
    style.innerHTML = '.director-tag { display: none !important; }';
    stWindow.document.head.appendChild(style);
}

// --- DOM ELEMENTS ---
const masterToggle = document.getElementById('master-toggle');
// Time
const timeModeSelect = document.getElementById('time-mode-select');
const uiReal = document.getElementById('ui-real');
const uiCustom = document.getElementById('ui-custom');
const uiGeneral = document.getElementById('ui-general');
const customTimeInput = document.getElementById('custom-time-input');
const generalTimeSelect = document.getElementById('general-time-select');
// Location & Lighting
const locationToggle = document.getElementById('location-toggle');
const locationInput = document.getElementById('location-input');
const lightToggle = document.getElementById('light-toggle');
const lightSelect = document.getElementById('light-select');
// Climate
const seasonToggle = document.getElementById('season-toggle');
const seasonSelect = document.getElementById('season-select');
const tempToggle = document.getElementById('temp-toggle');
const tempSelect = document.getElementById('temp-select');
const weatherToggle = document.getElementById('weather-toggle');
const weatherSelect = document.getElementById('weather-select');

// --- UI TOGGLES ---
masterToggle.addEventListener('click', () => {
    isEnabled = !isEnabled;
    masterToggle.textContent = isEnabled ? "Director ON" : "Director OFF";
    masterToggle.className = isEnabled ? "master-btn on" : "master-btn";
});

timeModeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    uiReal.classList.toggle('hidden', mode !== 'real');
    uiCustom.classList.toggle('hidden', mode !== 'custom');
    uiGeneral.classList.toggle('hidden', mode !== 'general');
});

// Helper for checkboxes to disable/enable inputs
function linkToggle(toggleEl, inputEl) {
    toggleEl.addEventListener('change', (e) => { inputEl.disabled = !e.target.checked; });
}
linkToggle(locationToggle, locationInput);
linkToggle(lightToggle, lightSelect);
linkToggle(seasonToggle, seasonSelect);
linkToggle(tempToggle, tempSelect);
linkToggle(weatherToggle, weatherSelect);

// --- TRACKING ST'S MEMORY ---
window.addEventListener("message", (event) => {
    if (event.data.type === "ST_EVENT" && event.data.chat) {
        latestChat = event.data.chat;
    }
});

// --- INJECTION LOGIC ---
function buildContextTag() {
    let innerText = [];

    // 1. Time
    const timeMode = timeModeSelect.value;
    if (timeMode === 'real') {
        const now = new Date();
        innerText.push(`[Time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${now.toLocaleDateString()}]`);
    } else if (timeMode === 'custom' && customTimeInput.value.trim()) {
        innerText.push(`[Time: ${customTimeInput.value.trim()}]`);
    } else if (timeMode === 'general') {
        innerText.push(`[Time: ${generalTimeSelect.value}]`);
    }

    // 2. Location & Lighting
    if (locationToggle.checked && locationInput.value.trim()) {
        innerText.push(`[Location: ${locationInput.value.trim()}]`);
    }
    if (lightToggle.checked) innerText.push(`[Lighting: ${lightSelect.value}]`);

    // 3. Climate
    if (seasonToggle.checked) innerText.push(`[Season: ${seasonSelect.value}]`);
    if (tempToggle.checked) innerText.push(`[Temperature: ${tempSelect.value}]`);
    if (weatherToggle.checked) innerText.push(`[Weather: ${weatherSelect.value}]`);

    // Return null if nothing is active
    if (innerText.length === 0) return null;

    return `<scene-context class="director-tag">${innerText.join(' ')}</scene-context>`;
}

// --- THE INTERCEPTOR & HIJACKER ---
function interceptMainwindowInput(e) {
    if (!isEnabled || !stWindow) return;

    const isSendClick = e.type === 'click' && (e.target.id === 'send_but' || e.target.closest('#send_but'));
    const isEnterPress = e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey && e.target.id === 'send_textarea';
    const swipeBtn = e.type === 'click' ? e.target.closest('.swipe_left, .swipe_right') : null;

    if (isSendClick || isEnterPress) {
        const textarea = stWindow.document.getElementById('send_textarea');
        if (textarea && textarea.value.trim().length > 0) {
            const stripRegex = /<scene-context class="director-tag">.*?<\/scene-context>\n?/gs;
            let rawText = textarea.value.replace(stripRegex, "").trim();
            const contextTag = buildContextTag();
            
            if (contextTag) {
                textarea.value = `${contextTag}\n${rawText}`;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        return;
    }

    if (swipeBtn) {
        if (isSimulatedSwipe) {
            isSimulatedSwipe = false;
            return; 
        }

        if (latestChat.length > 0) {
            let userMsgIndex = -1;
            for (let i = latestChat.length - 1; i >= 0; i--) {
                if (latestChat[i].is_user) {
                    userMsgIndex = i;
                    break;
                }
            }

            if (userMsgIndex !== -1) {
                const originalText = latestChat[userMsgIndex].mes;
                const stripRegex = /<scene-context class="director-tag">.*?<\/scene-context>\n?/gs;
                let rawText = originalText.replace(stripRegex, "").trim();
                const contextTag = buildContextTag();

                let newText = rawText;
                if (contextTag) newText = `${contextTag}\n${rawText}`;

                if (newText !== originalText) {
                    e.preventDefault();
                    e.stopPropagation();

                    stWindow.postMessage({
                        type: "REWRITE_MESSAGE",
                        messageId: userMsgIndex,
                        text: newText
                    }, "*");

                    latestChat[userMsgIndex].mes = newText;

                    setTimeout(() => {
                        isSimulatedSwipe = true;
                        swipeBtn.click();
                    }, 50);
                }
            }
        }
    }
}

if (stWindow && stWindow.document) {
    stWindow.document.addEventListener('click', interceptMainwindowInput, true);
    stWindow.document.addEventListener('keydown', interceptMainwindowInput, true);
    stWindow.postMessage({ type: "GAME_READY" }, "*");
}