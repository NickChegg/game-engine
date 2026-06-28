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

    sendMessage: function(text) {
        if (this.isConnected && window.opener) {
            window.opener.postMessage({ type: "USER_MESSAGE", text: text }, "*");
        } else {
            console.warn("Not connected to SillyTavern. Message not sent:", text);
        }
    }
};

// Automatically attempt handshake when any page loads
window.addEventListener("DOMContentLoaded", () => {
    STBridge.init();
});