'use server';
/**
 * @fileOverview AI flow for simulating a mock hearing environment.
 */

import { ai } from '../genkit';
import { z } from 'genkit';

const MockInputSchema = z.object({
  userRole: z.string(),
  caseType: z.string(),
  userStatement: z.string(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })),
});

const MockOutputSchema = z.object({
  aiResponse: z.string().describe("The judge's response or question."),
  feedback: z.string().describe("Educational feedback on the user's statement."),
  nextActionPrompt: z.string().describe("A hint for the user's next move."),
});

export type AIMockHearingSimulationOutput = z.infer<typeof MockOutputSchema>;

const prompt = ai.definePrompt({
  name: 'mockHearingSimulationPrompt',
  input: { schema: MockInputSchema },
  output: { schema: MockOutputSchema },
  prompt: `You are an experienced judge in a {{{caseType}}} mock hearing. The user is playing the role of the {{{userRole}}}.

Current User Statement: {{{userStatement}}}

History:
{{#each conversationHistory}}
{{role}}: {{content}}
{{/each}}

As the judge:
1. Provide a realistic response or follow-up question.
2. Offer brief, constructive coaching feedback on the user's statement (tone, legal validity, clarity).
3. Suggest what the user might consider doing next.`,
});

export const aiMockHearingSimulation = ai.defineFlow(
  {
    name: 'aiMockHearingSimulation',
    inputSchema: MockInputSchema,
    outputSchema: MockOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
