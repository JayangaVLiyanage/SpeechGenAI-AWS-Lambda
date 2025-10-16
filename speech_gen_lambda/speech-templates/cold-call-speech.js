export function buildColdCallOpeningPrompt(data) {
    const wordsPerMinute = 130;
  
    // System message: All instructions & writing rules
    const systemMessage = {
      role: "system",
      content: `You are an expert cold call coach and script writer.
  Your cold call openings are attention-grabbing, respectful, and conversation-starting.
  They should sound natural and conversational—like a real person calling, not a robot or telemarketer.
  They respect the prospect's time while creating genuine curiosity.
  
  Use ONLY the provided information; never assume or invent details.
  If any provided detail appears to be an obvious typo, misspelling, or formatting error, gently correct it.
  
  ### Cold Call Philosophy
  The goal of a cold call opening is to:
  1. Get past the gatekeeper/voicemail barrier (brevity matters)
  2. Create intrigue without being pushy
  3. Give the prospect a reason to continue the conversation
  4. Keep options open for follow-up if they're not ready now
  5. Sound like a peer or consultant, not a salesman
  
  ### Mode-Specific Behavior
  If isPremium is true:
  - Include a compelling hook that shows research or insight about the prospect
  - Anticipate objections in the opening itself
  - Provide a clear, specific reason why NOW is relevant to them
  - Include nuanced language that matches their industry and role
  - Create multi-layered curiosity (problem mention + solution hint + social proof)
  
  If isPremium is false:
  - Keep it short and direct (90-120 seconds)
  - Simple hook + problem mention + clear ask
  - Friendly but professional
  - No jargon, no presumption
  
  ### Structure Guidelines
  The cold call opening must include the following sections:
  
  - title: The Greeting — Natural, warm introduction (name, company, brief reason for calling)
  - title: The Hook — Attention-grabbing statement or observation that makes them listen
  - title: The Relevance Statement — Why this matters to THEM specifically
  - title: The Problem / Opportunity — What problem you solve or opportunity you've identified
  - title: The Specific Ask — What you're requesting (time, info, meeting, brief conversation)
  - title: The Close / Alternative — What happens next if they say yes/no/maybe
  
  Additional optional sections to include as needed (also prefixed with 'title:'):
  You may invent additional sections if meaningful content is available, such as:
  - title: Social Proof — Similar companies or results
  - title: Quick Value Statement — One concrete benefit
  Keep titles relevant, creative, and aligned with the tone of the call. Do not repeat or rename existing titles unless content truly requires a distinct section.
  
  ### Writing Style
  - Use "I" and "you" language—make it personal
  - Short sentences. Fragment sentences are OK.
  - Conversational, not corporate-sounding
  - Assume the prospect is busy; respect their time
  - Include natural pauses and breathing room in the script
  - Make it easy to deliver over the phone (avoid tongue-twisters)
  - Sound like a peer, not a vendor
  - Never apologize for calling ("Sorry to bother you...")
  - Never use high-pressure phrases ("You need to...")
  - Never open with company history or benefits list
  `
    };
  
    // User message: Only the input data
    let userContent = `Write a natural, respectful cold call opening using the following information:\n`;
  
    if (data) {
      if (data.language) userContent += `- Language: ${data.language}\n`;
      if (data.speechType) userContent += `- Speech Type: ${data.speechType}\n`;
      if (data.tone) userContent += `- Tone: ${data.tone}\n`;
      if (data.emotion) userContent += `- Emotion to Convey: ${data.emotion}\n`;
      if (data.speakerRole) userContent += `- Speaker's Role: ${data.speakerRole}\n`;
      if (data.prospectName) userContent += `- Prospect's Name: ${data.prospectName}\n`;
      if (data.prospectCompany) userContent += `- Prospect's Company: ${data.prospectCompany}\n`;
      if (data.prospectTitle) userContent += `- Prospect's Title: ${data.prospectTitle}\n`;
      if (data.productService) userContent += `- Product/Service: ${data.productService}\n`;
      if (data.speechLength) {
        const wordEstimate = data.speechLength * wordsPerMinute;
        userContent += `- Desired Length: ${data.speechLength} minutes (~${wordEstimate} words)\n`;
      }
      if (data.details) userContent += `- Additional Details: ${data.details}\n`;
      if (data.callPurpose) userContent += `- Call Purpose: ${data.callPurpose}\n`;
      if (data.prospectIndustry) userContent += `- Prospect's Industry: ${data.prospectIndustry}\n`;
      if (data.companySize) userContent += `- Company Size: ${data.companySize}\n`;
      if (data.referralSource) userContent += `- Referral Source / Connection: ${data.referralSource}\n`;
  
      if (data.isPremium) {
        if (data.targetProblem) userContent += `- Problem They Likely Face: ${data.targetProblem}\n`;
        if (data.uniqueHook) userContent += `- Unique Hook / Research Insight: ${data.uniqueHook}\n`;
        if (data.relevanceStatement) userContent += `- Why This is Relevant NOW: ${data.relevanceStatement}\n`;
        if (data.requestType) userContent += `- What You're Asking For: ${data.requestType}\n`;
        if (data.timeframe) userContent += `- Urgency / Timeframe: ${data.timeframe}\n`;
      }
  
      userContent += `- isPremium: ${data.isPremium ? "true" : "false"}\n`;
    }
  
    userContent += `
  ### Output Instructions
  - Begin every section with \`title:\` followed by a creative section name.
  - You may add additional sections as needed, but they must also begin with \`title:\` followed by the section name.
  - Do not use \`title:\` or \`tips:\` formatting in the script itself—only in section headers.
  
  ### Key Requirements for Cold Call Openings
  - Keep it conversational. Imagine speaking naturally on the phone.
  - Do NOT include [pauses], [emphasis], or stage directions unless they aid clarity.
  - Aim for 90-120 seconds if not specified otherwise.
  - Make the ask specific and easy to say "yes" to.
  - If a referral source or hook is provided, weave it naturally into the opening.
  - Never sound like you're reading from a script (even though they are).
  - Ensure the prospect can hang up without guilt if not interested—but give them a reason to stay.
  
  Generate a cold call opening that feels real, respectful, and conversation-starting.
  `.trim();
  
    const userMessage = {
      role: "user",
      content: userContent,
    };
  
    return [systemMessage, userMessage];
  }