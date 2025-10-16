export function buildSalesPitchPrompt(data) {
  const wordsPerMinute = 130;

  // System message: All instructions & writing rules
  const systemMessage = {
    role: "system",
    content: `You are an expert sales pitch writer.
Your pitches are persuasive, engaging, and audience-focused.
They should sound natural when spoken aloud, not like a template.
Use ONLY the provided information; never assume or invent details.
If any provided detail appears to be an obvious typo, misspelling, or formatting error,
gently correct it to the most natural intended version.

If important information is missing, rely on universal sales principles such as value, trust, and simplicity, without inventing specifics.

### Mode-Specific Behavior
If isPremium is true:
- Emphasize unique selling points with clarity.
- Frame the pitch around solving the customer’s problems.
- Anticipate and address likely objections directly.
- Adapt to cultural or regional preferences if given.
- Make the pitch layered, persuasive, and designed to inspire confidence.

If isPremium is false:
- Keep the pitch short, direct, and persuasive.
- Focus on the product/service and the core benefit.
- Clearly state the pitch goal without overcomplication.
- Use universal sales principles if details are limited.

### Structure Guidelines
The speech must include the following sections, each beginning with 'title:' followed by a creative section name.

- title: Hook/Opening  — Start with a bold statement, question, or fact to capture attention.
- title: Identify the Problem — Highlight the customer’s pain point or need.
- title: Present the Solution — Position the product/service as the answer.
- title: Unique Selling Points — Emphasize what makes this different or better.
- title: Handle Objections — If objections are given, address them naturally.
- title: Call-to-Action — End with a clear step (buy, schedule, partner, sign up).

Additional optional sections to include as needed (also prefixed with 'title:'):
You may invent additional sections if meaningful content is available, as long as they follow the same format:  
Each new section must begin with \`title: <Your New Section Title>\` on its own line.  
Keep titles relevant, creative, and aligned with the tone of the speech. Do not repeat or rename the existing titles unless the content truly requires a distinct section.

### Writing Style
- Use a conversational, persuasive, and confident tone.
- Keep sentences varied and natural — avoid sounding like a script.
- Make it audience-focused: speak to customer needs and benefits.
- Never invent details; only use provided info or universal sales techniques.
- Maintain a natural, spoken tone suitable for live delivery.
`
  };

  // User message: Only the input data
  let userContent = `Write a professional sales pitch using the following information:\n`;

  if (data) {
    if (data.language) userContent += `- Language: ${data.language}\n`;
    if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
    if (data.tone) userContent += `- Tone: ${data.tone}\n`;
    if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
    if (data.speakerRole) userContent += `- Speaker's Role: ${data.speakerRole}\n`;
    if (data.customerType) userContent += `- Customer Type: ${data.customerType}\n`;
    if (data.productService) userContent += `- Product/Service: ${data.productService}\n`;
    if (data.speechLength) {
      const wordEstimate = data.speechLength * wordsPerMinute;
      userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
    }
    if (data.details) userContent += `- Additional Details: ${data.details}\n`;
    if (data.industry) userContent += `- Industry/Market Context: ${data.industry}\n`;
    if (data.urgency) userContent += `- How urgently customer need to act: ${data.urgency}\n`;

    if (data.isPremium) {
      if (data.pitchGoal) userContent += `- Pitch Goal: ${data.pitchGoal}\n`;
      if (data.relationshipState) userContent += `- Relationship stage with customer: ${data.relationshipState}\n`;
      if (data.uniqueSellingPoint) userContent += `- Unique Selling Points: ${data.uniqueSellingPoint}\n`;
      if (data.proofPoints) userContent += `- Proof or Evidence of Credibility: ${data.proofPoints}\n`;
      if (data.customerProblem) userContent += `- Customer Problem or Pain Points: ${data.customerProblem}\n`;
      if (data.objections) userContent += `- Objections to Address: ${data.objections}\n`;
      if (data.culturalStyle) userContent += `- Cultural/Regional Style: ${data.culturalStyle}\n`;
      if (data.pricingContext) userContent += `- Price of the sale (benifits customer gain): ${data.pricingContext}\n`;
    }

    userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
  }

  userContent += `
### Output Instructions
- Begin every section with \`title:\` followed by a creative section name. Example: \`title: Hook/Opening\`
- You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.
- Do not use \`title:\` or \`tips:\` formatting in quotes, stories, or examples.

- Make each section clear, persuasive, and easy to deliver aloud.
- Prioritize clarity, confidence, and strong audience connection.
- Automatically adjust depth and detail based on the provided input.
- Ensure the pitch feels premium, even with minimal data.
- Maintain a natural, spoken tone that builds trust and motivates action.
`.trim();

  const userMessage = {
    role: "user",
    content: userContent,
  };

  return [systemMessage, userMessage];
}
