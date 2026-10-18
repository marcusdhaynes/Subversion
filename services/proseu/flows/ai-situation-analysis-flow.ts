'use server';
/**
 * @fileOverview AI flow for analyzing a user's legal situation.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const SituationInputSchema = z.object({
  situation: z.string(),
});

const SituationOutputSchema = z.object({
  laymanSummary: z.string().describe("A summary of the situation in plain English."),
  legalLandscape: z.string().describe("Context about the relevant laws and procedures."),
  riskFactors: z.string().describe("Potential risks or pitfalls identified in the situation."),
  recommendedActions: z.string().describe("Bullet points of what the user should do or say."),
  avoidActions: z.string().describe("Bullet points of what the user should NOT do or say."),
  strategicGuidance: z.string().describe("A high-level strategic conclusion."),
});

export type AISituationAnalysisOutput = z.infer<typeof SituationOutputSchema>;

const prompt = ai.definePrompt({
  name: 'analyzeSituationPrompt',
  input: { schema: SituationInputSchema },
  output: { schema: SituationOutputSchema },
  prompt: `You are a senior legal strategist and coach. Analyze the following legal situation described by a Pro Se litigant:

Situation: {{{situation}}}

Provide:
1. A clear, layman-phrased summary of what is happening.
2. An overview of the relevant legal landscape and procedures.
3. Identification of critical risk factors.
4. Concrete "Do" and "Don't" recommendations.
5. An objective strategic conclusion.

Be professional, objective, and clear. Remind the user that this is guidance, not formal legal advice.`,
});

export const analyzeSituation = ai.defineFlow(
  {
    name: 'analyzeSituation',
    inputSchema: SituationInputSchema,
    outputSchema: SituationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
