'use server';
/**
 * @fileOverview AI flow for providing strategic guidance on Direct and Cross-examination.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const ExaminationInputSchema = z.object({
  examinationType: z.enum(['Direct', 'Cross']),
  perspective: z.enum(['Witness', 'Attorney']),
  caseContext: z.string().describe('Background details of the legal dispute.'),
  witnessDetails: z.string().describe('Information about the witness being examined.'),
});

const ExaminationOutputSchema = z.object({
  strategicAdvice: z.string().describe('High-level strategic guidance.'),
  suggestedQuestions: z.array(z.string()).describe('A list of effective questions to ask (Attorney) or anticipate (Witness).'),
  potentialTraps: z.array(z.string()).describe('Common pitfalls or aggressive tactics to watch out for.'),
  preparationChecklist: z.array(z.string()).describe('Actionable steps for final preparation.'),
});

export type AIExaminationCoachOutput = z.infer<typeof ExaminationOutputSchema>;

const prompt = ai.definePrompt({
  name: 'examinationCoachPrompt',
  input: { schema: ExaminationInputSchema },
  output: { schema: ExaminationOutputSchema },
  prompt: `You are an expert trial consultant. Provide professional coaching for a {{{examinationType}}} examination from the perspective of the {{{perspective}}}.

Case Context: {{{caseContext}}}
Witness Details: {{{witnessDetails}}}

Provide:
1. Strategic advice on tone, body language, and legal objectives.
2. If perspective is Attorney: Provide a sequence of powerful questions.
3. If perspective is Witness: Provide a list of tough questions they are likely to face and how to answer them.
4. Identify 3 potential "traps" or cross-examination techniques that might be used.
5. A preparation checklist for the morning of the trial.`,
});

export const aiExaminationCoach = ai.defineFlow(
  {
    name: 'aiExaminationCoach',
    inputSchema: ExaminationInputSchema,
    outputSchema: ExaminationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
