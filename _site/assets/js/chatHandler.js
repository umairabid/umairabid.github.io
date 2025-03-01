export default class ChatHandler {
  constructor(cWindow, cHistory) {
    this.cWindow = cWindow;
    this.cHistory = cHistory;
  }

  addUserMessage(message) {
    this.addMessage(`<div class="chat-message user-message"><p>${message}<p></div>`);
  }

  addBotMessage(message) {
    this.addMessage(`<div class="chat-message bot-message">${message}</div>`);
  }

  addMessage(message) {
    this.cHistory.innerHTML += message;
    setTimeout(() => {
      this.cWindow.scrollTop = this.cWindow.scrollHeight;
    })
  }
}
