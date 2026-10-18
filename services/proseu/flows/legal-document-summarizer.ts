'use server';
/**
 * @fileOverview A Genkit flow for summarizing legal documents and explaining legal jargon.
 *
 * - summarizeLegalDocument - A function that handles the legal document summarization process.
 * - LegalDocumentSummarizerInput - The input type for the summarizeLegalDocument function.
 * - LegalDocumentSummarizerOutput - The return type for the summarizeLegalDocument function.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const LegalDocumentSummarizerInputSchema = z.object({
  documentText: z
    .string()
    .describe(
      'The full text of the legal document or public case information to summarize.'
    ),
});
export type LegalDocumentSummarizerInput = z.infer<
  typeof LegalDocumentSummarizerInputSchema
>;

const LegalDocumentSummarizerOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the key points of the legal document.'),
  jargonExplanation: z
    .string()
    .describe(
      'Explanations of legal jargon found in the document, presented in simple terms.'
    ),
});
export type LegalDocumentSummarizerOutput = z.infer<
  typeof LegalDocumentSummarizerOutputSchema
>;

export async function summarizeLegalDocument(
  input: LegalDocumentSummarizerInput
): Promise<LegalDocumentSummarizerOutput> {
  return legalDocumentSummarizerFlow(input);
}

const legalDocumentSummarizerPrompt = ai.definePrompt({
  name: 'legalDocumentSummarizerPrompt',
  input: { schema: LegalDocumentSummarizerInputSchema },
  output: { schema: LegalDocumentSummarizerOutputSchema },
  prompt: `You are an expert legal assistant. Your task is to summarize the provided legal document or public case information, highlighting the key points.
Additionally, identify any legal jargon within the document and explain it in simple, easy-to-understand terms for a general audience.

Legal Document:
{{documentText}}`,
});

const legalDocumentSummarizerFlow = ai.defineFlow(
  {
    name: 'legalDocumentSummarizerFlow',
    inputSchema: LegalDocumentSummarizerInputSchema,
    outputSchema: LegalDocumentSummarizerOutputSchema,
  },
  async (input) => {
    const { output } = await legalDocumentSummarizerPrompt(input);
    return output!;
  }
);
