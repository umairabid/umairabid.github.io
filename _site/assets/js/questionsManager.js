import questions from "./questionRepository.js";

export default class QuestionsManager {

  static TARGET_SIMILARITY = 0.6;

  constructor() {

  }

  async respondToQuestion(question) {
    const predefinedQuestion = this.findPreDefinedQuestion(question);
    if (predefinedQuestion) {
      const qConfig = questions.find((q) => q.question === predefinedQuestion);
      if (qConfig.type === 'url') {
        const answer = qConfig.answer;
        const response = await fetch(answer);
        return await response.text();
      } else {
        const answer = qConfig.answer;
        return Promise.resolve(answer);
      }
    } else {
      return Promise.resolve("I'm sorry, I don't have an answer for that.");
    }
  }

  findPreDefinedQuestion(query) {
    let closestQuestion = "";
    let highestSimilarity = 0;
    questions.forEach(q => {
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
    if (highestSimilarity >= QuestionsManager.TARGET_SIMILARITY) {
      return closestQuestion
    }
  }
}
