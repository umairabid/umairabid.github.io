export default class ChatHandler {
  constructor(cWindow) {
    this.cWindow = cWindow;
  }

  addUserMessage(message) {
    this.addMessage(`<div class="chat-message user-message"><p>${message}<p></div>`);
  }

  addBotMessage(message) {
    this.addMessage(`<div class="chat-message bot-message">${message}</div>`);
  }

  addMessage(message) {
    this.cWindow.innerHTML += message;
  }
}
