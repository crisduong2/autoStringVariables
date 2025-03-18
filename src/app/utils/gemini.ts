import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../config';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function analyzeImage(imageBase64: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/png"
        }
      },
      `You are an expert in creating i18n (internationalization) JSON files for mobile app localization.  Given the following screenshot and its text elements, generate a JSON object that maps each text element to its corresponding English ('en') and Vietnamese ('vn') translations. 

 Follow these rules: 



 Key Format: Use the format [actualKey]::[uiTypes].Use camelCase

the actualKey is the role of the text element in the screenshot. no longer than 2 words
 JSON Structure: The JSON object should have each key mapping to another object containing the 'en' and 'vn' translations. uiTypes could be header/description/button/body/option/label

 Accuracy: Provide accurate and natural-sounding translations for value. 

 Literal Values: If a text element is a number or a card number, keep the value the same in both languages. 

 Omit ellipses: Represent ellipses with three periods (...) 

 Screenshot Text Elements: You are an expert in creating i18n (internationalization) JSON files for mobile app localization.  Given the following screenshot and its text elements, generate a JSON object that maps each text element to its corresponding English ('en') and Vietnamese ('vn') translations. 

 `
      
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
} 