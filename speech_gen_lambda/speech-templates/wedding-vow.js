export function buildWeddingVowsPrompt(data) {
  const wordsPerMinute = 130;
  const premiumMode = Boolean(data?.isPremium);

  // ✅ System Message
  const systemMessage = {
    role: "system",
    content: `
You are a world-class wedding vow writer.
Your vows must be sincere, emotionally resonant, and deeply personal.
They should sound natural when spoken aloud — never overly formal or scripted.
Use ONLY the provided information. Never invent or assume missing details. 
Correct obvious typos or formatting issues gracefully.

If important information is missing, rely on timeless themes such as love, commitment, and vulnerability — without fictionalizing specifics.

### Mode-Specific Behavior
If isPremium is true:
- Incorporate specific stories, personal values, quotes, or cultural symbols.
- Use vivid language, layered emotion, and shared memories to create unforgettable vows.
- Let the speaker's voice and love story shine through.

If isPremium is false:
- Keep vows short, heartfelt, and sincere.
- Focus on love, admiration, and meaningful promises — even with limited input.
- Prioritize clear, spoken-style phrasing.

### Structure Guidelines
The speech must include the following sections, each beginning with 'title:' followed by the exact section name. The first section is mandatory and must be named exactly as below without renaming:

- title: Tips for Delivery — Offer guidance on tone, emotional pacing, vulnerability, and staying present during the moment.

Additional optional sections may be added as needed (always begin with 'title:'):

- title: Opening — A heartfelt or poetic way to begin.
- title: Personal Connection — Speak directly to your partner about their qualities.
- title: Story or Reflection — Include memories or shared experiences.
- title: Promises — Make sincere and specific commitments.
- title: Closing — A final, powerful statement of enduring love.

You may invent additional sections if meaningful content is available, as long as they follow the same format:  
Each new section must begin with \`title: <Your New Section Title>\` on its own line.  
Do not duplicate or rename existing titles unless the content demands a distinct purpose.

### Writing Style
- Use a natural, spoken, emotionally grounded tone.
- Vary sentence length and avoid clichés — every line should feel personal and authentic.
- Do not invent information — rely only on provided content or universal themes of love.
- Ensure the vows feel unique and deeply human, not templated or generic.
`.trim()
  };

  // User Message
  let userContent = `Write personal wedding vows using the following information:\n`;

  if (data) {
    if (data.language) userContent += `- Language: ${data.language}\n`;
    if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
    if (data.tone) userContent += `- Tone: ${data.tone}\n`;
    if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
    if (data.speechLength) {
      const wordEstimate = data.speechLength * wordsPerMinute;
      userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
    }
    if (data.speakerName) userContent += `- Speaker's Name: ${data.speakerName}\n`;
    if (data.partnerName) userContent += `- Partner's Name: ${data.partnerName}\n`;
    if (data.whatILove) userContent += `- What the speaker loves about their partner: ${data.whatILove}\n`;
    if (data.promises) userContent += `- Specific Promises to Make: ${data.promises}\n`;
    if (data.details) userContent += `- Additional Details: ${data.details}\n`;

    if (premiumMode) {
      if (data.memorableMoments) userContent += `- Memorable or Defining Moments: ${data.memorableMoments}\n`;
      if (data.howTheyMet) userContent += `- How They Met: ${data.howTheyMet}\n`;
      if (data.sharedValues) userContent += `- Shared Values: ${data.sharedValues}\n`;
      if (data.challengesFaced) userContent += `- Challenges They've Overcome Together: ${data.challengesFaced}\n`;
      if (data.culturalElements) userContent += `- Cultural or Symbolic References: ${data.culturalElements}\n`;
      if (data.quotes) userContent += `- Quotes or Lyrics to Include: ${data.quotes}\n`;
      if (data.personalInsideJoke) userContent += `- Inside Jokes or Fun References: ${data.personalInsideJoke}\n`;
    }

    userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
  }

  //  Output Instructions
  userContent += `
### Output Instructions
- Begin every section with \`title:\` followed by the exact section name. Example: \`title: Tips for Delivery\`
- This section must always be included and must match the section title below exactly:
  - \`title: Tips for Delivery\`
- Do not rename, rephrase, or reorder this section title.
- Always place the section \`title: Tips for Delivery\` at the very beginning of the output.
- You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.

- Under the \`title: Tips for Delivery\` section:
  - List each tip on a new line.
  - Each tip must start with \`tips:\` (lowercase), followed by the delivery guidance.
  - Do **not** use bullet points, markdown formatting, or bold text for tips.
  - Example: \`tips: Pause and breathe when you feel emotional — it's part of the moment.\`
  - The \`title: Tips for Delivery\` section must be tailored specifically to wedding vows.
  - Each tip must be context-aware — based on tone, emotion, audience, and content.
  - Avoid generic or repetitive delivery advice.

- Do not use \`title:\`, \`instructions:\`, or \`tips:\` formatting in quotes, stories, or examples.

- Ensure every section is heartfelt, clear, and easy to speak aloud.
- Adjust detail and richness based on available input.
- Make the vows emotionally powerful and memorable — even for minimal data.
`.trim();

  const userMessage = {
    role: "user",
    content: userContent,
  };

  return [systemMessage, userMessage];
}