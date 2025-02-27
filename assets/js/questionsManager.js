export default class QuestionsManager {

  static TARGET_SIMILARITY = 0.6;

  constructor() {
    this.questions = [
      {
        question: 'Tell me about yourself?',
        answer: '/answers/tell-me-about-yourself'
      }
    ];
  }

  async respondToQuestion(question) {
    const predefinedQuestion = this.findPreDefinedQuestion(question);
    if (predefinedQuestion) {
      const qPair = this.questions.find((q) => q.question === predefinedQuestion);
      const answer = qPair.answer;
      const response = await fetch(answer);
      const text = await response.text();
      return text;
    } else {
      return Promise.resolve("I'm sorry, I don't have an answer for that.");
    }
  }

  findPreDefinedQuestion(query) {
    let closestQuestion = "";
    let highestSimilarity = 0;
    this.questions.forEach(q => {
      const question = q.question;
      const similarity = stringSimilarity.compareTwoStrings(
        query.toLowerCase(),
        question.toLowerCase()
      );
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        closestQuestion = question;
      }
    })
    console.log(highestSimilarity);
    if (highestSimilarity >= QuestionsManager.TARGET_SIMILARITY) {
      return closestQuestion
    }
  }
}
