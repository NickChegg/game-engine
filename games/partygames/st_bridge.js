const STBridge = {
    isConnected: false,
    stWindow: null, // We will store the exact SillyTavern root window here

    init: function() {
        if (window.opener) {
            try {
                // If this window was opened by another pop-out (like the Dashboard), 
                // we need to talk to the grandparent (SillyTavern).
                if (window.opener.opener) {
                    this.stWindow = window.opener.opener;
                } else {
                    // Otherwise, we are a direct child of SillyTavern
                    this.stWindow = window.opener;
                }
                
                this.stWindow.postMessage({ type: "GAME_READY" }, "*");
                this.isConnected = true;
                return true;
            } catch (e) {
                console.error("STBridge Init Error:", e);
            }
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
                    let charKey = Object.keys(stripState.characters).find(k => k.toLowerCase() === loserName.toLowerCase());
                    if (charKey) {
                        let clothingArr = stripState.characters[charKey];
                        if (clothingArr.length > 0) {
                            let randIdx = Math.floor(Math.random() * clothingArr.length);
                            let removedItem = clothingArr.splice(randIdx, 1)[0];
                            strippedMessages.push(`<${charKey} lost and removes ${removedItem}>`);
                            
                            // Check if they just lost their very last item!
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
                    localStorage.setItem('partygames_strip_state', JSON.stringify(stripState));
                }
            }
        }
        // ------------------------------------

        if (this.isConnected && this.stWindow) {
            // Push directly to the saved ST Root Window!
            this.stWindow.postMessage({ type: "USER_MESSAGE", text: finalOutput }, "*");
        } else {
            console.warn("Not connected to ST. Message:", finalOutput);
        }
    }
};

window.addEventListener("DOMContentLoaded", () => {
    STBridge.init();
});