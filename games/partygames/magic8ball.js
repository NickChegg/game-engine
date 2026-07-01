// DOM Elements
const btnShake = document.getElementById("btn-shake");
const eightball = document.getElementById("eightball");
const triangle = document.getElementById("triangle");
const answerText = document.getElementById("answer-text");

const rpText = document.getElementById("rp-text");
const btnPush = document.getElementById("btn-push");

// The 20 Classic Responses
const responses = [
    // Positive
    "It is certain", "It is decidedly so", "Without a doubt", "Yes definitely", "You may rely on it",
    "As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes",
    // Neutral
    "Reply hazy, try again", "Ask again later", "Better not tell you now", "Cannot predict now", "Concentrate and ask again",
    // Negative
    "Don't count on it", "My reply is no", "My sources say no", "Outlook not so good", "Very doubtful"
];

let lastResponse = "";

// ==========================================
// 1. SHAKE LOGIC & ANIMATION
// ==========================================
btnShake.addEventListener("click", () => {
    // Disable buttons during animation
    btnShake.disabled = true;
    btnPush.disabled = true;

    // Fade out old text instantly
    triangle.style.opacity = "0";

    // Trigger shake animation
    eightball.classList.remove("shaking");
    void eightball.offsetWidth; // Force CSS reflow to restart animation
    eightball.classList.add("shaking");

    // Wait for the shake to finish (0.5s), then pick answer and fade in
    setTimeout(() => {
        // Pick a random response
        lastResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // Update the text
        answerText.innerText = lastResponse;

        // Fade it back in slowly (1.5s transition handled by CSS)
        triangle.style.opacity = "1";

        // Re-enable push button
        btnPush.disabled = false;
        btnShake.disabled = false;

    }, 600); // 600ms delay to ensure shake finishes before text appears
});

// ==========================================
// 2. PUSH TO SILLYTAVERN
// ==========================================
btnPush.addEventListener("click", () => {
    if (!lastResponse) return;

    // Strict formatting as requested: `The Magic 8-Ball reads: x`
    let pushStr = `\`The Magic 8-Ball reads: ${lastResponse}\``;

    // Append optional user roleplay
    const userRp = rpText.value.trim();
    if (userRp) {
        pushStr += `\n${userRp}`;
    }

    // Send via STBridge
    STBridge.sendMessage(pushStr);

    // Clear RP box after pushing
    rpText.value = "";
});