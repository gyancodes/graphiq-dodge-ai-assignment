import OpenAI from 'openai';

export function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing API key. Set GROQ_API_KEY in server/.env before starting the server.');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}
