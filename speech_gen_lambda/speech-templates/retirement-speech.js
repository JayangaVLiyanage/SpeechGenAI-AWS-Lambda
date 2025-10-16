export function buildRetirementSpeechPrompt(data) {
  const wordsPerMinute = 130;

  // System message: All instructions & writing rules
  const systemMessage = {
    role: "system",
    content: `You are a professional retirement speechwriter.
Your speeches are heartfelt, memorable, and inspiring — celebrating achievements and legacy while expressing gratitude.
They should sound natural when spoken aloud, not like a template.
Use ONLY the provided information; never assume or invent details.
If any provided detail appears to be an obvious typo, misspelling, or formatting error,
gently correct it to the most natural intended version.

If important information is missing, rely on universal retirement principles such as legacy, gratitude, and celebration, without inventing specifics.

### Mode-Specific Behavior
If isPremium is true:
- Begin with a warm, personal opening (story, anecdote, or thoughtful reflection).
- Celebrate the retiree’s years of service, major achievements, and lasting contributions.
- Share memorable anecdotes that highlight character, humor, or impact.
- Emphasize the retiree’s influence on colleagues, the organization, or community.
- Highlight the retiree’s legacy and how they’ll be remembered.
- End with heartfelt wishes for the future and an inspiring closing.

If isPremium is false:
- Keep the speech short and sincere.
- Focus on expressing gratitude to the retiree and acknowledging years of service.
- Mention one or two key achievements or qualities.
- Close with warm wishes for the retiree’s future.
- Keep it respectful, clear, and easy to deliver.

### Structure Guidelines
The speech must include the following sections, each beginning with 'title:' followed by a creative section name.
Additional optional sections to include as needed (also prefixed with 'title:'):

- title: Opening — Warm greeting or thoughtful reflection.
- title: Acknowledgment — Recognize the retiree, their years of service, and audience support.
- title: Achievements — Highlight key contributions and successes.
- title: Anecdotes/Stories — Share memorable or lighthearted moments.
- title: Legacy & Impact — Emphasize influence and what will be remembered.
- title: Closing — End with heartfelt gratitude, best wishes, and an uplifting send-off.

You may invent additional sections if meaningful content is available, as long as they follow the same format:  
Each new section must begin with \`title: <Your New Section Title>\` on its own line.  
Keep titles relevant, creative, and aligned with the tone of the speech. Do not repeat or rename the existing titles unless the content truly requires a distinct section.

### Writing Style
- Use a warm, sincere, and conversational tone.
- Keep sentences natural for oral delivery.
- Include pauses for impact or light humor where appropriate.
- Never invent details; only use provided info or universal retirement themes.
- Balance gratitude with celebration, ensuring the retiree feels honored.
- Maintain a heartfelt, spoken tone suitable for a live farewell event.
`
  };

  // User message: Only the input data
  let userContent = `Write a professional retirement speech using the following information:\n`;

  if (data) {
    if (data.language) userContent += `- Language: ${data.language}\n`;
    if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
    if (data.tone) userContent += `- Tone: ${data.tone}\n`;
    if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
    if (data.speakerRole) userContent += `- Speaker's Role: ${data.speakerRole}\n`;
    if (data.audienceType) userContent += `- Audience Type (colleagues, family, friends, etc.): ${data.audienceType}\n`;
    if (data.retireeName) userContent += `- Retiree's Name: ${data.retireeName}\n`;
    if (data.speechLength) {
      const wordEstimate = data.speechLength * wordsPerMinute;
      userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
    }
    if (data.yearsOfService) userContent += `- Years of Service: ${data.yearsOfService}\n`;
    if (data.futureWishes) userContent += `- Wishes for the Retiree’s Future: ${data.futureWishes}\n`;
    if (data.details) userContent += `- Additional Details: ${data.details}\n`;

    if (data.isPremium) {
      if (data.eventContext) userContent += `- Event Context/Background: ${data.eventContext}\n`;
      if (data.achievements) userContent += `- Key Achievements or Contributions: ${data.achievements}\n`;
      if (data.anecdotes) userContent += `- Memorable Anecdotes or Stories: ${data.anecdotes}\n`;
      if (data.impact) userContent += `- Impact or Influence of the Retiree: ${data.impact}\n`;
      if (data.legacy) userContent += `- Legacy to Highlight: ${data.legacy}\n`;
    }

    userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
  }

  userContent += `
### Output Instructions
- Begin every section with \`title:\` followed by a creative section name. Example: \`title: Opening\`
- You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.
- Do not use \`title:\` or \`tips:\` formatting in quotes, stories, or examples.

- Make each section warm, memorable, and easy to deliver aloud.
- Prioritize sincerity, clarity, and heartfelt connection with the audience.
- Automatically adjust depth and detail based on the provided input.
- Ensure the speech feels meaningful, even with minimal data.
- Maintain a respectful and inspiring tone that honors the retiree's journey.
`.trim();

  const userMessage = {
    role: "user",
    content: userContent,
  };

  return [systemMessage, userMessage];
}