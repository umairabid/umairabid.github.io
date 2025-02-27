import MessageHandler from "./messageHandler.js";
import ChatHandler from "./chatHandler.js";
import QuestionsManager from "./questionsManager.js";

export default class ChatManager {
  constructor(userInput, chatWindow) {
    this.userInput = userInput;
    this.chatWindow = chatWindow;
    this.initHandlers();
  }

  initHandlers() {
    this.messageHandler = new MessageHandler(this.userInput, this.findResponse.bind(this));
    this.chatHandler = new ChatHandler(this.chatWindow);
    this.questionsManager = new QuestionsManager();
  }

  findResponse(message) {
    this.chatHandler.addUserMessage(message); 
    const response = this.questionsManager.respondToQuestion(message);
    response.then((text) => this.chatHandler.addBotMessage(text));
  }
}
