import { buildWeddingToastPrompt } from './wedding-toast.js';
import { buildWeddingVowsPrompt } from './wedding-vow.js';
import { buildBusinessSpeechPrompt } from './business-speech.js';
import { buildSalesPitchPrompt } from './sales-pitch.js';
import { buildGraduationSpeechPrompt } from './graduation-speech.js';
import { buildRetirementSpeechPrompt } from './retirement-speech.js';
import { buildAcceptanceSpeechPrompt } from './acceptance-speech.js';
import { buildColdCallOpeningPrompt } from './cold-call-speech.js';


// Supported speech types
export const SPEECH_TYPES = Object.freeze({
  wedding_toast: "wedding_toast",
  wedding_vow: "wedding_vow",
  business_speech: "business_speech",
  sales_pitch: "sales_pitch",
  graduation_speech: "graduation_speech",
  retirement_speech: "retirement_speech",
  acceptance_speech: "acceptance_speech",
  coldcall_speech: "coldcall_speech",
  // add more types as needed
});

export function isValidSpeechType (type){

  //console.log("isValidSpeechType: ", type);
  return Object.values(SPEECH_TYPES).includes(type.toLowerCase());
}



const promptBuilders = {

  [SPEECH_TYPES.wedding_toast]: buildWeddingToastPrompt,
  [SPEECH_TYPES.wedding_vow]:buildWeddingVowsPrompt,
  [SPEECH_TYPES.business_speech]: buildBusinessSpeechPrompt,
  [SPEECH_TYPES.sales_pitch]:buildSalesPitchPrompt,
  [SPEECH_TYPES.graduation_speech]:buildGraduationSpeechPrompt,
  [SPEECH_TYPES.retirement_speech]: buildRetirementSpeechPrompt,
  [SPEECH_TYPES.acceptance_speech]:buildAcceptanceSpeechPrompt,
  [SPEECH_TYPES.coldcall_speech]:buildColdCallOpeningPrompt,
};

export function getPromptBuilder(type) {

  const builder = promptBuilders[type.toLowerCase()];
  if (!builder) throw new Error(`Speech template not found for type: ${type}`);
  return builder;

}

export function getMandetoryFields(type) {

  switch (type.toLowerCase()) {

    case SPEECH_TYPES.wedding_toast:
      return ["jobId", "language", "speechType", "tone", "emotion", "speechLength"];
    case SPEECH_TYPES.wedding_vow:
      return ["jobId", "language", "speechType", "tone", "emotion", "speechLength"];
    // case 'farewell':
    //   return requiredFields;
    default:
      return ["jobId", "language", "speechType", "tone", "emotion", "speechLength"];
  }
}

