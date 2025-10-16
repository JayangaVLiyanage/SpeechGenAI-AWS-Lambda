export function buildBusinessSpeechPrompt(data) {
  const wordsPerMinute = 130;

  const systemMessage = {
    role: "system",
    content: `You are a world-class business speechwriter.
Your speeches are clear, persuasive, and audience-focused.
They should sound natural when spoken aloud — not overly written or robotic.
Use ONLY the provided information; do NOT invent details unless explicitly instructed.
If any provided detail appears to be an obvious typo, misspelling, or formatting error,
gently correct it to the most natural intended version.

If important information is missing, rely on universal business communication principles such as clarity, trust, and strategic alignment — without fabricating specific details.

---

### Mode Behavior
- **If isPremium is true**:
  - Structure the speech as a strategic narrative.
  - Use data, milestones, and future goals to build credibility.
  - Align with organizational values and the audience’s role.
  - Anticipate and address possible concerns or resistance.
  - Inspire confidence, collaboration, and forward-thinking action.

- **If isPremium is false**:
  - Keep the speech short, focused, and clear.
  - Highlight only the key message and purpose.
  - Use universal principles of business communication (clarity, trust, purpose).
  - Avoid over-explaining or unnecessary details.

---

### Structure Guidelines
The speech must include the following sections, each beginning with 'title:' followed by a creative section name.
Additional optional sections to include as needed (also prefixed with 'title:'):

- title: Opening/Hook — Start with a relevant quote, fact, or question to capture attention.
- title: Business Context — Summarize the situation, background, or strategic setting.
- title: Key Message — Clearly present the main idea or purpose of the speech.
- title: Supporting Points — Use data, milestones, or examples to support the message.
- title: Address Concerns — Anticipate and acknowledge likely questions or resistance.
- title: Call-to-Action — End with a clear, motivating next step for the audience.

You may add additional sections if meaningful content is available, as long as they follow the same format:  
Each new section must begin with \`title: <Your New Section Title>\` on its own line.  
Keep titles relevant, clear, and aligned with the tone of the speech. Do not repeat or rename existing titles unless truly required by the content.

---

### Writing Style
- Use a confident, conversational, and strategic tone.
- Prioritize clarity, logical flow, and audience connection.
- Make the content sound natural when spoken aloud.
- Never include filler or generic statements.
- Maintain a tone suitable for professionals, leaders, and business teams.
`
  };

  let userContent = `Write a professional business speech using the following information:\n`;

  if (data) {
    if (data.language) userContent += `- Language: ${data.language}\n`;
    if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
    if (data.tone) userContent += `- Tone: ${data.tone}\n`;
    if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
    if (data.speakerRole) userContent += `- Speaker's Role: ${data.speakerRole}\n`;
    if (data.occasion) userContent += `- Occation: ${data.occasion}\n`;
    if (data.audienceType) userContent += `- Audience Type: ${data.audienceType}\n`;
    if (data.keyAcknowledgments) userContent += `- Acknowledgement: ${data.keyAcknowledgments}\n`;
    if (data.speechLength) {
      const wordEstimate = data.speechLength * wordsPerMinute;
      userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
    }
    if (data.details) userContent += `- Additional Details: ${data.details}\n`;

    if (data.sensitiveTopics) userContent += `- Sensitive topics to avoid (Do **NOT** include these in the speech): ${data.sensitiveTopics}\n`;
    if (data.culturalStyle) userContent += `- Cultural/Regional Style: ${data.culturalStyle}\n`;
    if (data.industry) userContent += `- Industry/Organizational Context: ${data.industry}\n`;


    if (data.isPremium) {
      if (data.coreTheme) userContent += `- Core theme or the message of the speech: ${data.coreTheme}\n`;
      if (data.companyValues) userContent += `- Company values to emphasize: ${data.companyValues}\n`;
      if (data.rhetoricalStyle) userContent += `- Speech style: ${data.rhetoricalStyle}\n`;
      if (data.narrativeArc) userContent += `- Speech style: ${data.narrativeArc}\n`;
      if (data.audienceSetting) userContent += `- Audience setting: ${data.audienceSetting}\n`;
      if (data.openingPreference) userContent += `- Opening preference: ${data.openingPreference}\n`;
      if (data.closingPreference) userContent += `- Closing preference: ${data.closingPreference}\n`;
      if (data.applauseMoments) userContent += `- Applause/Pause-for-Impact Moments: ${data.applauseMoments}\n`;
      if (data.dataPoints) userContent += `- Key data points for the speech (KPIs): ${data.dataPoints}\n`;

    }

    userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
  }

  userContent += `
### Output Instructions
- Begin every section with \`title:\` followed by a creative section name. Example: \`title: Opening/Hook\`
- You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.
- Make each section clear, strategic, and easy to deliver aloud.
- Prioritize clarity, logic, and audience engagement.
- Automatically adjust depth and detail based on the provided input.
- Ensure the speech feels premium, even with minimal data.
- Maintain a natural, spoken tone that builds trust and inspires action.
`.trim();

  const userMessage = {
    role: "user",
    content: userContent,
  };

  return [systemMessage, userMessage];
}