'use server';
/**
 * @fileOverview AI flow for simplifying legal terms and explaining their significance.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const TermInputSchema = z.object({
  legalTerm: z.string(),
});

const TermOutputSchema = z.object({
  officialDefinition: z.string(),
  simplifiedExplanation: z.string(),
  famousCases: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
});

export type AILegalTermSimplificationOutput = z.infer<typeof TermOutputSchema>;

const prompt = ai.definePrompt({
  name: 'simplifyLegalTermPrompt',
  input: { schema: TermInputSchema },
  output: { schema: TermOutputSchema },
  prompt: `You are a legal educator. Simplify the following legal term or Latin phrase:

Term: {{{legalTerm}}}

Provide:
1. The authoritative official definition.
2. A plain-English simplified explanation.
3. Examples of famous cases or scenarios where this term was pivotal.`,
});

export const aiLegalTermSimplification = ai.defineFlow(
  {
    name: 'aiLegalTermSimplification',
    inputSchema: TermInputSchema,
    outputSchema: TermOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
