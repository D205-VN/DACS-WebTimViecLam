require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const mimeType = 'image/png';

  try {
    const result = await model.generateContent([
      { text: "Describe this image" },
      { inlineData: { data: base64, mimeType } }
    ]);
    console.log(result.response.text());
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
