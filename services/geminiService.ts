
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult, TransactionType } from "../types";

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: 'ISO date format YYYY-MM-DD' },
          description: { type: Type.STRING, description: 'Summary of the item' },
          type: { type: Type.STRING, enum: [TransactionType.EARNING, TransactionType.EXPENSE] },
          category: { 
            type: Type.STRING, 
            description: 'Specific category mapping. Use platform terminology or general categories provided.' 
          },
          grossAmount: { type: Type.NUMBER },
          gstAmount: { type: Type.NUMBER },
          netAmount: { type: Type.NUMBER },
          platform: { type: Type.STRING, enum: ['Uber', 'DiDi', 'Ola', 'Other'] },
          confidence: { type: Type.NUMBER }
        },
        required: ['description', 'type', 'grossAmount', 'gstAmount', 'category', 'platform']
      }
    },
    summaryNote: { type: Type.STRING }
  },
  required: ['transactions']
};

export const parseDocument = async (base64Data: string, mimeType: string): Promise<ExtractionResult> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-pro-preview for complex reasoning and data extraction tasks.
  const model = 'gemini-3-pro-preview';
  
  const systemInstruction = `
    You are a highly accurate Rideshare Tax Assistant specializing in Australian GST.
    Your task is to parse statements (Uber, DiDi, Ola) and business receipts.
    
    Uber Earnings Categories:
    - Gross Transportation Fares, Split Fare Fee, Toll Reimbursement, City/Government Fees, Airport Fees, Booking Fees, Delivery Fee, Delivery Incentives, Delivery Tolls Reimbursement, Miscellaneous/Referrals/Incentives, Tips.

    Uber Expense/Deduction Categories:
    - Uber Service Fees, Other Charges from Uber, Charges from 3rd Parties, Split Fare Fees, Tolls (Expenses), City/Government Fees, Airport Fees, Booking Fees.

    DiDi Earnings Categories:
    - Gross Rider Fares, Booking Fee, Handling Fee, Tolls, Airport Fee, Government Levy, Cancellation Fee, CTP Fee, Split Fare Fee, Other Fare Breakdown Amounts, Rewards, Other.

    DiDi Expense/Deduction Categories:
    - DiDi Service Fee, Booking Fee, Handling Fee, Tolls (Expenses), Airport Fees, Government Levy, CTP Fee, Split Fare Fee, Other Deductions.

    General Business Expenses (Common to all platforms/receipts):
    - Car Expenses - Fuel, Car Expenses - EV Home Charging, Car Expenses - EV Public Charging, Car Expenses - Registration, Car Expenses - Insurance & CTP, Car Expenses - Servicing, Repairs & Tyres, Car Expenses - Cleaning, Car Expenses - Accessories & Other, Car Expenses - Rent, Hire & Lease Payments.
    - Accountancy, Bank Fees, Computer Expenses, Courses & Training, Equipment (dashcams, tools etc), Internet, Licences, Permits, Vehicle Checks, Medicals etc (GST), Licences, Permits, Vehicle Checks, Medicals etc (non-GST), Mobile Phone - For Both Business & Personal, Mobile Phone - 100% for Business, Music Subscriptions.
    - Parking, Rider Amenities - Water (non-GST), Rider Amenities - Mints, Tissues & Other (GST), Rideshare & Delivery Company Fees, Sanitisation & Hygiene, Stationery, Sunglasses (only enter business portion), Tolls (Expenses), Other Expenses (GST), Other Expenses (non-GST).

    General Rules:
    1. Identify Platform (Uber, DiDi, Ola, or Other).
    2. Identify Earning vs Expense.
    3. Extract date in YYYY-MM-DD.
    4. Be extremely precise with GST (usually 1/11th of total for taxable items).
    5. Ensure the category strictly matches the terminology provided above.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: "Extract tax and GST data from this document using the provided granular categories." },
          { inlineData: { data: base64Data, mimeType } }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA
      }
    });

    // Extract text directly from response.text property (not a method)
    const text = response.text || '{}';
    return JSON.parse(text) as ExtractionResult;
  } catch (error) {
    console.error("Error parsing document with Gemini:", error);
    throw error;
  }
};
