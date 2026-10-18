'use server';
/**
 * @fileOverview AI flow for drafting professional legal documents.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const DraftingInputSchema = z.object({
  documentType: z.enum(['Motion', 'Argument', 'Closing Statement', 'Legal Filing']),
  jurisdiction: z.string(),
  caseDetails: z.string(),
  relevantFacts: z.string(),
  specificInstructions: z.string().optional(),
});

const DraftingOutputSchema = z.object({
  draftedDocument: z.string(),
  disclaimer: z.string(),
});

export type AIDocumentDraftingOutput = z.infer<typeof DraftingOutputSchema>;

const prompt = ai.definePrompt({
  name: 'draftLegalDocumentPrompt',
  input: { schema: DraftingInputSchema },
  output: { schema: DraftingOutputSchema },
  prompt: `You are a professional legal drafting assistant. Draft a {{{documentType}}} for the following case:

Jurisdiction: {{{jurisdiction}}}
Case Details: {{{caseDetails}}}
Relevant Facts: {{{relevantFacts}}}
Additional Instructions: {{{specificInstructions}}}

Use professional legal formatting and tone. Ensure all placeholders are clearly marked (e.g. [PLAINTIFF NAME]). Include a strong disclaimer that this is a draft and must be reviewed by a professional.`,
});

export const draftLegalDocument = ai.defineFlow(
  {
    name: 'draftLegalDocument',
    inputSchema: DraftingInputSchema,
    outputSchema: DraftingOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
