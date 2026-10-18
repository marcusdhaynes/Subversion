'use server';
/**
 * @fileOverview A Genkit flow for summarizing legal news articles and identifying their relevance to specific legal fields or ongoing cases.
 *
 * - summarizeLegalNews - A function that handles the legal news summarization and relevance identification process.
 * - LegalNewsSummarizerInput - The input type for the summarizeLegalNews function.
 * - LegalNewsSummarizerOutput - The return type for the summarizeLegalNews function.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const LegalNewsSummarizerInputSchema = z.object({
  articleText: z.string().describe('The full text of the legal news article to summarize.'),
  legalFields: z.array(z.string()).optional().describe('Optional: A list of specific legal fields (e.g., "Family Law", "Criminal Defense") to check the article\'s relevance against.'),
  ongoingCases: z.array(z.string()).optional().describe('Optional: A list of descriptions of ongoing cases to check the article\'s relevance against.'),
});
export type LegalNewsSummarizerInput = z.infer<typeof LegalNewsSummarizerInputSchema>;

const LegalNewsSummarizerOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the legal news article.'),
  relevantLegalFields: z.array(z.string()).describe('A list of legal fields that the article is relevant to. If no specific fields are provided in the input, identify general relevant fields. If specific fields are provided, identify which of those are relevant.'),
  relevantOngoingCases: z.array(z.string()).describe('A list of ongoing cases (from the input) that the article is relevant to. If no ongoing cases are provided in the input or no relevance is found, return an empty array.'),
  relevanceExplanation: z.string().describe('A brief explanation of why the article is relevant to the identified legal fields and/or ongoing cases. If no relevance is found to the provided cases/fields, state that.'),
});
export type LegalNewsSummarizerOutput = z.infer<typeof LegalNewsSummarizerOutputSchema>;

const legalNewsSummarizerPrompt = ai.definePrompt({
  name: 'legalNewsSummarizerPrompt',
  input: { schema: LegalNewsSummarizerInputSchema },
  output: { schema: LegalNewsSummarizerOutputSchema },
  prompt: `You are an expert legal analyst and summarizer for ProSeU, an online legal education platform. Your task is to provide a concise summary of a legal news article and identify its potential relevance to specific legal fields or ongoing cases.

---START ARTICLE---
{{{articleText}}}
---END ARTICLE---

{{#if legalFields}}
Consider the following specific legal fields for relevance. Only include those fields in the 'relevantLegalFields' array in the output that are directly relevant to the article:
{{#each legalFields}}
- {{{this}}}
{{/each}}
{{else}}
If no specific legal fields are provided, identify general legal fields that the article pertains to and include them in 'relevantLegalFields'.
{{/if}}

{{#if ongoingCases}}
Consider the following descriptions of ongoing cases for relevance. Only include those cases in the 'relevantOngoingCases' array in the output that are directly relevant to the article:
{{#each ongoingCases}}
- {{{this}}}
{{/each}}
{{else}}
There are no specific ongoing cases to consider for relevance. The 'relevantOngoingCases' array should be empty.
{{/if}}

Your output MUST be a JSON object conforming to the schema described for the output. Ensure all fields are present. If no relevance is found for provided fields/cases, output an empty array for that field and clearly explain why in 'relevanceExplanation'.`,
});

const legalNewsSummarizerFlow = ai.defineFlow(
  {
    name: 'legalNewsSummarizerFlow',
    inputSchema: LegalNewsSummarizerInputSchema,
    outputSchema: LegalNewsSummarizerOutputSchema,
  },
  async (input) => {
    const { output } = await legalNewsSummarizerPrompt(input);
    return output!;
  }
);

export async function summarizeLegalNews(input: LegalNewsSummarizerInput): Promise<LegalNewsSummarizerOutput> {
  return legalNewsSummarizerFlow(input);
}
