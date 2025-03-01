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
      const chatHistory = document.getElementById('chat-history');
      const chatWindow = document.getElementById('chat-window');
      const chatSpinner = document.getElementById('typing-indicator');
      return new ChatManager(userInput, chatWindow, chatHistory, chatSpinner);
    }
  }
})();
