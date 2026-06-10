import { GoogleGenerativeAI } from '@google/generative-ai';

interface TriageResult {
  category: string;
  priority: string;
  suggestedResponse: string;
}

export async function triageTicket(title: string, description: string): Promise<TriageResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
You are an AI assistant for a support ticket system. Analyze the following support ticket and classify it.
Title: ${title}
Description: ${description}

Classify it into one of these categories:
- Billing
- Technical Issue
- Account Access
- Feature Request
- General Inquiry

Classify it into one of these priorities:
- Low
- Medium
- High
- Critical

Also, draft a professional and helpful suggested response that a support agent could send to the customer. Maintain a friendly and empathetic tone.

Return the response ONLY as a valid JSON object with the following fields:
{
  "category": "One of the categories above",
  "priority": "One of the priorities above",
  "suggestedResponse": "The drafted response"
}
Do not write anything else. Do not include markdown code block formatting like \`\`\`json. Just return the JSON object.
`;

      const response = await model.generateContent(prompt);
      let text = response.response.text().trim();
      
      // Clean markdown code blocks if the model includes them
      if (text.startsWith("```")) {
        text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(text);
      
      // Validate categories and priorities
      const validCategories = ['Billing', 'Technical Issue', 'Account Access', 'Feature Request', 'General Inquiry'];
      const validPriorities = ['Low', 'Medium', 'High', 'Critical'];

      const category = validCategories.includes(parsed.category) ? parsed.category : 'General Inquiry';
      const priority = validPriorities.includes(parsed.priority) ? parsed.priority : 'Low';
      const suggestedResponse = parsed.suggestedResponse || 'Thank you for your message. A support agent will review it shortly.';

      return { category, priority, suggestedResponse };
    } catch (error) {
      console.warn('Gemini API call failed, falling back to local classifier:', error);
    }
  }

  // Fallback Rule-Based Classifier
  return getFallbackTriage(title, description);
}

function getFallbackTriage(title: string, description: string): TriageResult {
  const content = (title + ' ' + description).toLowerCase();
  
  let category = 'General Inquiry';
  let priority = 'Low';
  let suggestedResponse = '';

  if (
    content.includes('bill') || 
    content.includes('invoice') || 
    content.includes('charge') || 
    content.includes('payment') || 
    content.includes('refund') || 
    content.includes('price') || 
    content.includes('subscription') ||
    content.includes('credit card') ||
    content.includes('transaction')
  ) {
    category = 'Billing';
    priority = (content.includes('double') || content.includes('unauthorized') || content.includes('fail')) ? 'High' : 'Medium';
    suggestedResponse = `Hi there,

Thank you for reaching out regarding your billing concern. I see you have an inquiry about payments/charges on your account. We take billing issues very seriously. A support agent has been notified and will review your transaction details shortly. Please have your invoice number or receipt ready if possible.

Best regards,
Support Team`;
  } else if (
    content.includes('login') || 
    content.includes('password') || 
    content.includes('reset') || 
    content.includes('auth') || 
    content.includes('account') || 
    content.includes('lock') || 
    content.includes('sign in') || 
    content.includes('sign out') || 
    content.includes('credentials')
  ) {
    category = 'Account Access';
    priority = 'High';
    suggestedResponse = `Hi there,

Thank you for reaching out. I understand you are having difficulty accessing your account. For security reasons, we will need to verify your identity before resetting access. One of our support agents will contact you shortly to guide you through the secure verification and account recovery process.

Best regards,
Support Team`;
  } else if (
    content.includes('error') || 
    content.includes('bug') || 
    content.includes('crash') || 
    content.includes('broken') || 
    content.includes('fail') || 
    content.includes('not working') || 
    content.includes('slow') || 
    content.includes('down') || 
    content.includes('freeze') || 
    content.includes('issue') || 
    content.includes('problem') ||
    content.includes('glitch')
  ) {
    category = 'Technical Issue';
    priority = (content.includes('down') || content.includes('prod') || content.includes('critical') || content.includes('urgent') || content.includes('broken')) ? 'Critical' : 'High';
    suggestedResponse = `Hi there,

Thank you for reporting this technical issue. We apologize for any inconvenience caused. Our engineering team has been alerted. An agent will contact you shortly to gather more details (such as device type, browser, or any error messages you observed) so we can troubleshoot and resolve this as quickly as possible.

Best regards,
Support Team`;
  } else if (
    content.includes('suggest') || 
    content.includes('feature') || 
    content.includes('request') || 
    content.includes('improve') || 
    content.includes('want') || 
    content.includes('hope to see') || 
    content.includes('add option') ||
    content.includes('idea')
  ) {
    category = 'Feature Request';
    priority = 'Low';
    suggestedResponse = `Hi there,

Thank you for sharing your suggestion with us! We are always looking for ways to improve our product. I have logged this request for our product team to evaluate. While we cannot guarantee immediate implementation, your feedback is invaluable in shaping our product roadmap.

Best regards,
Support Team`;
  } else {
    category = 'General Inquiry';
    priority = 'Low';
    suggestedResponse = `Hi there,

Thank you for contacting support. I have received your request regarding "${title}". One of our support agents will review your message and get back to you shortly with more details.

Best regards,
Support Team`;
  }

  return { category, priority, suggestedResponse };
}
