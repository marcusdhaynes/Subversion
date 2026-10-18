
'use server';
/**
 * @fileOverview AI flow for generating a comprehensive legal strategy debrief.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const DebriefInputSchema = z.object({
  caseData: z.any(),
});

const DebriefOutputSchema = z.object({
  executiveSummary: z.string(),
  jurisdictionalAnalysis: z.string(),
  researchNotes: z.string(),
  partyStrengths: z.array(z.object({
    party: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  })),
  proceduralRoadmap: z.array(z.object({
    phase: z.string(),
    steps: z.array(z.string()),
    potentialHurdles: z.string(),
  })),
  strategicRisks: z.array(z.string()),
  suggestedActions: z.array(z.string()),
});

export type LegalDebriefOutput = z.infer<typeof DebriefOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateLegalDebriefPrompt',
  input: { schema: DebriefInputSchema },
  output: { schema: DebriefOutputSchema },
  prompt: `You are a senior legal strategist. Generate a professional strategy debrief based on the following case data:

{{JSON.stringify caseData}}

Provide:
1. An executive summary of the situation.
2. Jurisdictional considerations.
3. Relevant statutes or precedents to research.
4. A SWOT analysis for the primary parties.
5. A procedural roadmap of what to expect next.
6. Critical strategic risks.
7. Recommended next actions for a Pro Se litigant.`,
});

export const generateLegalDebrief = ai.defineFlow(
  {
    name: 'generateLegalDebrief',
    inputSchema: DebriefInputSchema,
    outputSchema: DebriefOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
