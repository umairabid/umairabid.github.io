import ChatManager from "./chatManager.js";

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App()
  });
  
  class App {
    constructor() {
      this.init()
    }
    
    init() {
      this.chatManager = this.initChatManager();
    }

    initChatManager() {
      const userInput = document.getElementById('user-input');
      const chatWindow = document.getElementById('chat-history');
      return new ChatManager(userInput, chatWindow);
    }
  }
})();
