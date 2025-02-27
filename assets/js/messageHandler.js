export default class MessageHandler {
  constructor(field, enterCallback) {
    this.field = field;
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.field.addEventListener('keypress', this.handleKeyPress);
    this.enterCallback = enterCallback;
  }

  handleKeyPress(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.sendUserInput();
    }   
  }

  sendUserInput() {
    const userInput = this.field.value;
    this.field.value = '';
    this.enterCallback(userInput);
  }
}
