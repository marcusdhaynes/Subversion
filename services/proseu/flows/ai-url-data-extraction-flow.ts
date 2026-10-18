
'use server';
/**
 * @fileOverview AI flow for extracting structured case data from court URLs or narratives.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const ExtractionInputSchema = z.object({
  url: z.string().optional(),
  rawText: z.string().optional(),
});

const ExtractionOutputSchema = z.object({
  caseNumber: z.string().optional(),
  caseTitle: z.string().optional(),
  courtName: z.string().optional(),
  jurisdiction: z.string().optional(),
  caseType: z.enum(['Civil', 'Criminal', 'Administrative', 'Appellate']).optional(),
  parties: z.array(z.object({
    role: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    type: z.string(),
  })).optional(),
  claimDescription: z.string().optional(),
  causeOfAction: z.string().optional(),
  timeline: z.array(z.object({
    date: z.string(),
    type: z.string(),
    description: z.string(),
  })).optional(),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

const prompt = ai.definePrompt({
  name: 'extractCaseDataPrompt',
  input: { schema: ExtractionInputSchema },
  output: { schema: ExtractionOutputSchema },
  prompt: `You are a legal data extraction assistant. Analyze the following information and extract structured case details.

{{#if url}}URL to analyze: {{url}}{{/if}}
{{#if rawText}}Narrative description: {{rawText}}{{/if}}

Extract the case number, title, court, jurisdiction, parties involved, and a summary of the claims and timeline. If some fields are missing, omit them.`,
});

export const extractCaseDataFromUrl = ai.defineFlow(
  {
    name: 'extractCaseDataFromUrl',
    inputSchema: ExtractionInputSchema,
    outputSchema: ExtractionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
