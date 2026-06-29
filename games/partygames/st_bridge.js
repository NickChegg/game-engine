const STBridge = {
    isConnected: false,

    init: function() {
        if (window.opener) {
            window.opener.postMessage({ type: "GAME_READY" }, "*");
            this.isConnected = true;
            return true;
        }
        return false;
    },

    // gameResult format: { winners: ["Alice"], losers: ["Bob"] }
    sendMessage: function(text, gameResult = null) {
        let finalOutput = text;

        // --- STRIP PUNISHMENT INTERCEPTOR ---
        const stripStateRaw = localStorage.getItem('partygames_strip_state');
        if (stripStateRaw && gameResult) {
            let stripState = JSON.parse(stripStateRaw);
            
            if (stripState.active) {
                let strippedMessages = [];
                let losersToStrip = [];

                // RULE 1: If a single/specific character lost
                if (gameResult.losers && gameResult.losers.length > 0) {
                    losersToStrip = gameResult.losers;
                } 
                // RULE 2: If a character won, everyone else loses
                else if (gameResult.winners && gameResult.winners.length > 0) {
                    Object.keys(stripState.characters).forEach(charName => {
                        let isWinner = gameResult.winners.some(w => w.toLowerCase() === charName.toLowerCase());
                        if (!isWinner) losersToStrip.push(charName);
                    });
                }

                // Process the losers
                losersToStrip.forEach(loserName => {
                    // Find matching key case-insensitively
                    let charKey = Object.keys(stripState.characters).find(k => k.toLowerCase() === loserName.toLowerCase());
                    if (charKey) {
                        let clothingArr = stripState.characters[charKey];
                        
                        if (clothingArr.length > 0) {
                            let randIdx = Math.floor(Math.random() * clothingArr.length);
                            let removedItem = clothingArr.splice(randIdx, 1)[0];
                            strippedMessages.push(`<${charKey} lost and removes ${removedItem}>`);
                            
                            // NEW: Check if they just lost their very last item!
                            if (clothingArr.length === 0) {
                                strippedMessages.push(`<${charKey} is now completely naked>`);
                            }
                            
                        } else {
                            strippedMessages.push(`<${charKey} lost but has no clothes left to remove!>`);
                        }
                    }
                });

                if (strippedMessages.length > 0) {
                    finalOutput += "\n" + strippedMessages.join("\n");
                    // Save the updated clothing lists back to memory
                    localStorage.setItem('partygames_strip_state', JSON.stringify(stripState));
                }
            }
        }
        // ------------------------------------

        if (this.isConnected && window.opener) {
            window.opener.postMessage({ type: "USER_MESSAGE", text: finalOutput }, "*");
        } else {
            console.warn("Not connected to ST. Message:", finalOutput);
        }
    }
};

window.addEventListener("DOMContentLoaded", () => {
    STBridge.init();
});