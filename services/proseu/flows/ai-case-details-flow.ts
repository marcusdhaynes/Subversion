'use server';
/**
 * @fileOverview AI flow for retrieving and synthesizing detailed case intelligence.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const CaseDetailsInputSchema = z.object({
  caseId: z.string().describe('The unique identifier for the case.'),
});

const CaseDetailsOutputSchema = z.object({
  caseName: z.string(),
  citation: z.string(),
  docketNumber: z.string(),
  dateFiled: z.string(),
  court: z.string(),
  judges: z.array(z.string()),
  keyTakeaways: z.array(z.string()),
  summary: z.string(),
  legalImpact: z.string(),
  courtListenerUrl: z.string(),
});

export type CaseDetailsOutput = z.infer<typeof CaseDetailsOutputSchema>;

const prompt = ai.definePrompt({
  name: 'caseDetailsPrompt',
  input: { schema: CaseDetailsInputSchema },
  output: { schema: CaseDetailsOutputSchema },
  prompt: `You are a legal research assistant. Provide detailed information about the case with ID: {{caseId}}.

If this is a real-world landmark case (e.g., Roe v. Wade, Miranda v. Arizona), provide authoritative details including its summary, specific judges, official citation, and historical legal impact. 

If the ID is unrecognized, provide a realistic but simulated response based on the context of legal research.

Ensure the output is professional, objective, and clearly structured for a legal wiki format.`,
});

export const getCaseDetails = ai.defineFlow(
  {
    name: 'getCaseDetails',
    inputSchema: CaseDetailsInputSchema,
    outputSchema: CaseDetailsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
