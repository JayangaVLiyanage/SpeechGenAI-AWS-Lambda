export function buildAcceptanceSpeechPrompt(data) {
  const wordsPerMinute = 130;

  // System message: All instructions & writing rules
  const systemMessage = {
    role: "system",
    content: `You are a professional acceptance speechwriter.
Your speeches are sincere, gracious, and memorable.
They balance humility with inspiration and are tailored to the award, recognition, and audience.
They should sound natural when spoken aloud, not like a script.
Use ONLY the provided information; never assume or invent details.
If any provided detail appears to be an obvious typo, misspelling, or formatting error,
gently correct it to the most natural intended version.

If important information is missing, rely on universal acceptance speech principles such as gratitude, humility, and inspiration, without inventing specifics.

### Mode-Specific Behavior
If isPremium is true:
- Highlight the significance of the honor and its impact on the recipient's journey.
- Weave in personal anecdotes or milestones if provided.
- Show emotional depth while maintaining composure and professionalism.
- Recognize others’ contributions with specificity and authenticity.
- Build to a powerful closing that inspires the audience.

If isPremium is false:
- Keep the speech concise, warm, and heartfelt.
- Focus on gratitude and acknowledgment without overcomplication.
- Keep structure simple: thank, reflect briefly, close graciously.
- Use universal acceptance speech patterns if details are limited.

### Structure Guidelines
The speech must include the following sections, each beginning with 'title:' followed by the exact section name. The first section is mandatory and must be named exactly as below without renaming:

- title: Tips for Delivery — Offer guidance on speaking with warmth, authenticity, and confidence. Include tips on tone, pacing, emotional control, and finishing gracefully.

Additional optional sections to include as needed (also prefixed with 'title:'):

- title: Opening Gratitude — Begin with heartfelt thanks to those presenting the award.
- title: Acknowledge Support — Thank key supporters, mentors, colleagues, or family.
- title: Reflect on the Journey — Share meaningful moments, challenges, or lessons.
- title: Meaning of the Honor — Explain what the recognition represents personally or professionally.
- title: Inspire the Audience — Offer an uplifting thought or call to continue striving.
- title: Closing Remarks — End with humility, optimism, and appreciation.

You may invent additional sections if meaningful content is available, as long as they follow the same format:  
Each new section must begin with \`title: <Your New Section Title>\` on its own line.  
Keep titles relevant, creative, and aligned with the tone of the speech. Do not repeat or rename the existing titles unless the content truly requires a distinct section.

### Writing Style
- Use a sincere, gracious, and emotionally resonant tone.
- Keep sentences varied and natural — avoid sounding like a template.
- Focus on gratitude, authenticity, and inspiration.
- Never invent details; only use provided info or universal acceptance speech principles.
- Maintain a natural, spoken tone suitable for live delivery.
`
  };

  // User message: Only the input data
  let userContent = `Write a professional acceptance speech using the following information:\n`;

  if (data) {
    if (data.language) userContent += `- Language: ${data.language}\n`;
    if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
    if (data.tone) userContent += `- Tone: ${data.tone}\n`;
    if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
    if (data.speakerRole) userContent += `- Speaker's Role: ${data.speakerRole}\n`;
    if (data.occasion) userContent += `- Occation: ${data.occasion}\n`;
    if (data.primaryAudience) userContent += `- Audience present (e.g. General public, Colleagues, Familly and Friends): ${data.primaryAudience}\n`;
    if (data.culturalStyle) userContent += `- Cultural/Regional Style: ${data.culturalStyle}\n`;


    if (data.speechLength) {
      const wordEstimate = data.speechLength * wordsPerMinute;
      userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
    }

    if (data.industry) userContent += `- Industry/Field Context: ${data.industry}\n`;
    if (data.details) userContent += `- Additional Details: ${data.details}\n`;

    if (data.isPremium) {

      if (data.coreTheme) userContent += `- Core theme of the speech: ${data.coreTheme}\n`;
      if (data.acknowledgments) userContent += `- Acknowledgment: ${data.acknowledgments}\n`;
      if (data.openingPreference) userContent += `- Opening preference: ${data.openingPreference}\n`;
      if (data.closingPreference) userContent += `- Closing preference: ${data.closingPreference}\n`;
      if (data.applauseMoments) userContent += `- Desired Applause or Pause-for-Impact Moments: ${data.applauseMoments}\n`;

      if (data.lessonsLearned) userContent += `- Lessons Learned to Highlight: ${data.lessonsLearned}\n`;
      if (data.futureCommitments) userContent += `- Commitments or Goals for the Future: ${data.futureCommitments}\n`;
      if (data.messageToAudience) userContent += `- Core Message to Leave with the Audience: ${data.messageToAudience}\n`;
      if (data.awardTitle) userContent += `- Award/Recognition Title: ${data.awardTitle}\n`;
      if (data.organization) userContent += `- Presenting Organization: ${data.organization}\n`;

    }

    userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
  }

  userContent += `
### Output Instructions
- Begin every section with \`title:\` followed by the exact section name. Example: \`title: Tips for Delivery\`
- Theis section must always be included and must match the section title below exactly:
  - \`title: Tips for Delivery\`
- Do not rename, rephrase, or reorder theis section titles.
- Always place the section \`title: Tips for Delivery\` at the very beginning of the output.
- You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.
- Under the \`title: Tips for Delivery\` section:
  - List each tip on a new line.
  - Each tip must start with \`tips:\` (lowercase), followed by a space and the delivery guidance.
  - Do **not** use bullet points, markdown formatting, or bold text for tips.
  - Example: \`tips: Maintain a warm, genuine tone throughout.\`
  - The \`title: Tips for Delivery\` section must be tailored specifically to the acceptance speech.
  - Each tip must be context-aware — based on the purpose, tone, audience, and speech content.
  - Focus on what makes delivery effective for this specific scenario, not speeches in general.
  - Do not use generic or repetitive tips.
- Do not use \`title:\` or \`tips:\` formatting in quotes, stories, or examples.

- Make each section clear, heartfelt, and easy to deliver aloud.
- Prioritize sincerity, humility, and connection with the audience.
- Automatically adjust depth and detail based on the provided input.
- Ensure the speech feels premium, even with minimal data.
- Maintain a natural, spoken tone that leaves a lasting impression.
`.trim();

  const userMessage = {
    role: "user",
    content: userContent,
  };

  return [systemMessage, userMessage];
}
