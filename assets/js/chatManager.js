import MessageHandler from "./messageHandler.js";
import ChatHandler from "./chatHandler.js";
import QuestionsManager from "./questionsManager.js";

export default class ChatManager {
  constructor(userInput, chatWindow, chatHistory, chatSpinner) {
    this.userInput = userInput;
    this.chatWindow = chatWindow;
    this.chatHistory = chatHistory;
    this.chatSpinner = chatSpinner;
    this.initHandlers();
  }

  initHandlers() {
    this.messageHandler = new MessageHandler(this.userInput, this.findResponse.bind(this));
    this.chatHandler = new ChatHandler(this.chatWindow, this.chatHistory);
    this.questionsManager = new QuestionsManager();
  }

  findResponse(message) {
    if (message.trim() === '') return;
    this.chatHandler.addUserMessage(message);
    this.userInput.disabled = true;
    this.chatSpinner.classList.toggle('hide');
    setTimeout(() => {
      const response = this.questionsManager.respondToQuestion(message);
      response.then((text) => this.chatHandler.addBotMessage(text));
      this.chatSpinner.classList.toggle('hide');
      this.userInput.disabled = false;
    }, 3000 )
    
  }
}
