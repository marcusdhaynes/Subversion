'use server';
/**
 * @fileOverview An AI agent that analyzes a user's legal situation, provides an initial understanding,
 * and suggests relevant next steps or learning paths.
 *
 * - aiSituationAnalysis - A function that handles the legal situation analysis process.
 * - AISituationAnalysisInput - The input type for the aiSituationAnalysis function.
 * - AISituationAnalysisOutput - The return type for the aiSituationAnalysis function.
 */

import {ai} from '../genkit';
import {z} from 'genkit';

const AISituationAnalysisInputSchema = z.object({
  description: z
    .string()
    .describe("A natural language description of the user's legal situation."),
});
export type AISituationAnalysisInput = z.infer<typeof AISituationAnalysisInputSchema>;

const AISituationAnalysisOutputSchema = z.object({
  initialUnderstanding: z
    .string()
    .describe("The AI's initial understanding and summary of the legal situation."),
  suggestedNextSteps: z
    .array(z.string())
    .describe("An array of suggested immediate next steps the user could take."),
  suggestedLearningPaths: z
    .array(z.string())
    .describe("An array of relevant learning paths or modules from ProSeU based on the situation."),
});
export type AISituationAnalysisOutput = z.infer<typeof AISituationAnalysisOutputSchema>;

export async function aiSituationAnalysis(
  input: AISituationAnalysisInput
): Promise<AISituationAnalysisOutput> {
  return aiSituationAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiSituationAnalysisPrompt',
  input: {schema: AISituationAnalysisInputSchema},
  output: {schema: AISituationAnalysisOutputSchema},
  prompt: `You are a legal assistant specializing in helping individuals understand their legal situations and navigate the legal system. Your goal is to provide a clear, initial understanding of a given legal scenario, suggest practical next steps, and recommend relevant learning paths or modules.

Analyze the following legal situation described by the user:

Legal Situation: {{{description}}}

Based on the description, provide:
1. An initial understanding of the situation, outlining key legal aspects or potential issues.
2. A list of concrete, actionable next steps the user might consider.
3. A list of relevant learning paths, courses, or modules (e.g., 'Family Law Basics', 'Small Claims Court Procedures', 'Understanding Contracts') that could help the user further.`,
});

const aiSituationAnalysisFlow = ai.defineFlow(
  {
    name: 'aiSituationAnalysisFlow',
    inputSchema: AISituationAnalysisInputSchema,
    outputSchema: AISituationAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
