export function buildWeddingToastPrompt(data) {
  const wordsPerMinute = 130;

  const premiumMode = Boolean(data?.isPremium);

  // ✅ System message: Instructions & writing rules
  const systemMessage = {
    role: "system",
    content: `
You are a world-class wedding toast speechwriter.
Your speeches must be heartfelt, memorable, and sound like they are being spoken aloud — not written.
Use a natural, conversational, and engaging tone.
Use ONLY the provided information. Do not invent or assume facts. Correct typos or formatting errors gracefully.

If important information is missing, rely on universal toast-writing principles such as sincerity, storytelling, and emotional resonance — without adding fictional details.

### Mode-Specific Behavior
If isPremium is true:
- Incorporate specific stories, emotional insights, quotes, and cultural touches when available.
- Make the speech layered, heartfelt, and unforgettable.
- Respect the tone and setting — formal, traditional, light-hearted, or cultural.

If isPremium is false:
- Focus on clarity, brevity, and emotional simplicity.
- Deliver a meaningful message even with limited data.
- Avoid filler or generic clichés.

### Structure Guidelines
The speech must include the following sections, each beginning with 'title:' followed by the exact section name. The first section is mandatory and must be named exactly as below without renaming or reordering:

- title: Tips for Delivery — Offer delivery tips on presence, emotional pacing, and how to connect naturally.

Additional optional sections may be included (also prefixed with 'title:'):

- title: Opening — Greeting or light-hearted way to start.
- title: Personal Connection — Speaker’s relationship to the couple.
- title: Storytelling / Memories — Funny, touching, or unique stories.
- title: Reflections on Love & Marriage — Personal thoughts, quotes, or observations.
- title: Memorable Line — A short, impactful phrase unique to the couple.
- title: Closing / Toast — Warm closing with invitation to raise a glass.

You may invent additional sections if meaningful content is available, as long as they follow the same format:  
Each new section must begin with \`title: <Your New Section Title>\` on its own line.  
Keep titles relevant, creative, and aligned with the tone of the speech. Do not repeat or rename the existing titles unless the content truly requires a distinct section.

### Writing Style
- Use a sincere, confident, and emotionally intelligent tone.
- Avoid scripts or robotic phrasing — it should feel personal and spoken.
- Make every line memorable, clear, and easy to say out loud.
- Do not fabricate facts — base content strictly on the input data or universal emotional truths.
`.trim()
  };

  //  User message: Input data and formatting instructions
  let userContent = `Write a wedding toast using the following information:\n`;

  if (data) {
    if (data.language) userContent += `- Language: ${data.language}\n`;
    if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
    if (data.tone) userContent += `- Tone: ${data.tone}\n`;
    if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
    if (data.speakerRole) userContent += `- Speaker’s Role: ${data.speakerRole}\n`;

    if (data.speechLength) {
      const wordEstimate = data.speechLength * wordsPerMinute;
      userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
    }

    if (data.details) userContent += `- Additional Details: ${data.details}\n`;
    if (data.speakerRelationship) userContent += `- Speaker’s Relationship to the Couple: ${data.speakerRelationship}\n`;
    if (data.howTheyMet) userContent += `- How the Couple Met: ${data.howTheyMet}\n`;
    if (data.brideName) userContent += `- Bride’s Name: ${data.brideName}\n`;
    if (data.groomName) userContent += `- Groom’s Name: ${data.groomName}\n`;

    if (premiumMode) {

      if (data.memorableMoments) userContent += `- Memorable or Funny Stories: ${data.memorableMoments}\n`;
      if (data.quotes) userContent += `- Favorite Quotes or Sayings: ${data.quotes}\n`;
      if (data.weddingSetting) userContent += `- Wedding Location or Setting: ${data.weddingSetting}\n`;
      if (data.culturalThemes) userContent += `- What makes them a great pair: ${data.culturalThemes}\n`;
      if (data.brideDetails) userContent += `- Bride’s Personality: ${data.brideDetails}\n`;
      if (data.groomDetails) userContent += `- Groom’s Personality: ${data.groomDetails}\n`;
    }

    userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
  }

  userContent += `
### Output Instructions
- Begin every section with \`title:\` followed by the exact section name. Example: \`title: Tips for Delivery\`
- This section must always be included and must match the section titles below exactly:
  - \`title: Tips for Delivery\`
- Do not rename, rephrase, or reorder theis section title.
- Always place the section \`title: Tips for Delivery\` at the very beginning of the output.
- You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.

- Under the \`title: Tips for Delivery\` section:
  - List each tip on a new line.
  - Each tip must start with \`tips:\` (lowercase), followed by a space and the delivery guidance.
  - Do **not** use bullet points, markdown formatting, or bold text for tips.
  - Example: \`tips: Pause briefly after emotional moments to let them land.\`
  - The \`title: Tips for Delivery\` section must be tailored specifically to the speech type.
  - Each tip must be context-aware — based on tone, emotion, audience, and content.
  - Do not use generic or repetitive tips.

- Do not use \`title:\` or \`tips:\` formatting in stories, quotes, or examples.
- Make each section clear, heartfelt, and easy to speak aloud.
- Prioritize emotional impact, natural rhythm, and audience connection.
- Automatically adjust depth and length based on the provided input.
- Ensure the toast feels premium and unique — even with minimal data.
`.trim();

  const userMessage = {
    role: "user",
    content: userContent,
  };

  return [systemMessage, userMessage];
}