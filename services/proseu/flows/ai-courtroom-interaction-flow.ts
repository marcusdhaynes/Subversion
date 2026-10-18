'use server';
/**
 * @fileOverview AI flow for providing strategic guidance on courtroom interactions and objections.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const InteractionInputSchema = z.object({
  scenario: z.string(),
  role: z.string(),
  context: z.string(),
});

const InteractionOutputSchema = z.object({
  suggestedObjections: z.array(z.string()),
  crossExaminationQuestions: z.array(z.string()),
  reasoning: z.string(),
});

export type AICourtroomInteractionOutput = z.infer<typeof InteractionOutputSchema>;

const prompt = ai.definePrompt({
  name: 'courtroomInteractionPrompt',
  input: { schema: InteractionInputSchema },
  output: { schema: InteractionOutputSchema },
  prompt: `You are a courtroom trial coach. Analyze the following courtroom scenario from the perspective of a {{{role}}}:

Context: {{{context}}}

Provide:
1. A list of potential objections that could be raised (if any).
2. Strategic questions for cross-examination or follow-up.
3. The AI's strategic reasoning for these suggestions.`,
});

export const aiCourtroomInteraction = ai.defineFlow(
  {
    name: 'aiCourtroomInteraction',
    inputSchema: InteractionInputSchema,
    outputSchema: InteractionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
