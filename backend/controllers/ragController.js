const { runRag } = require('../../python_api/rag_model'); // Assuming rag_model.py exposes a callable function

const queryRag = async (question, patientId) => {
  // Call your Python RAG service via HTTP API or subprocess
  // For sample, we can just load partial data for testing
  const answer = await runRag(question, patientId);
  return answer;
};

module.exports = { queryRag };
