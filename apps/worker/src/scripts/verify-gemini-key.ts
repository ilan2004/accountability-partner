import { config } from 'dotenv';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from root
config({ path: join(__dirname, '../../../../.env') });

async function verifyGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    return;
  }
  
  console.log('🔑 API Key found:', apiKey.substring(0, 20) + '...');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try different model names
  const modelsToTry = [
    'gemini-2.0-flash-exp',
    'gemini-pro',
    'gemini-1.5-flash', 
    'gemini-1.5-pro',
    'models/gemini-2.0-flash-exp',
    'models/gemini-pro',
    'models/gemini-1.5-flash'
  ];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`\n🧪 Testing model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const prompt = "Say 'Hello, this is a test' in exactly those words.";
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('✅ Success! Response:', text);
      console.log('🎉 Working model found:', modelName);
      break;
      
    } catch (error: any) {
      console.log(`❌ Failed with ${modelName}:`, error.status || error.message);
    }
  }
}

verifyGeminiKey().catch(console.error);
