
'use server';
/**
 * @fileOverview A local helper AI agent.
 *
 * - localHelper - A function that handles responding to user queries about their local area.
 */

import { getAi } from '@/utils/firebaseAdmin';
import { getNearbyBusinessesDb, searchNearbyPostsDb } from '@/lib/db';
import type { BusinessUser, Post, LocalHelperInput, LocalHelperOutput } from '@/lib/db-types';
import { z } from 'zod';

const ai = getAi();

const LocalHelperInputSchema = z.object({
  query: z.string().describe('The user question about their local area.'),
  latitude: z.number().describe('The latitude of the user.'),
  longitude: z.number().describe('The longitude of the user.'),
});

// Tool for the AI to find nearby businesses
const findNearbyBusinessesTool = ai.defineTool(
  {
    name: 'findNearbyBusinesses',
    description:
      'Finds nearby businesses based on the user\'s location and an optional category. Use this to answer questions about local services, shops, or restaurants.',
    inputSchema: z.object({
      latitude: z.number().describe("The user's current latitude."),
      longitude: z.number().describe("The user's current longitude."),
      category: z
        .string()
        .optional()
        .describe(
          'A specific business category to filter by, e.g., "Restaurant", "Plumber", "Hardware Store".'
        ),
    }),
    outputSchema: z.array(
      z.object({
        name: z.string(),
        business_category: z.string().nullable(),
        distance: z.number().nullable(),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
      })
    ),
  },
  async (input) => {
    const businesses = await getNearbyBusinessesDb({
      latitude: input.latitude,
      longitude: input.longitude,
      category: input.category,
      limit: 5, // Limit to top 5 results for concise answers
      offset: 0,
    });

    return businesses.map((b: BusinessUser) => ({
      name: b.name,
      business_category: b.business_category,
      distance: b.distance,
      latitude: b.latitude,
      longitude: b.longitude,
    }));
  }
);

// Tool for the AI to search recent nearby posts
const searchNearbyPostsTool = ai.defineTool(
  {
    name: 'searchNearbyPosts',
    description:
      "Searches recent public posts (pulses) near the user's location based on a query. Use this to find information about current events, traffic, news, or other user-reported activities.",
    inputSchema: z.object({
      latitude: z.number().describe("The user's current latitude."),
      longitude: z.number().describe("The user's current longitude."),
      query: z
        .string()
        .describe(
          'Keywords to search for in the posts, e.g., "traffic", "roadblock", "event".'
        ),
    }),
    outputSchema: z.array(
      z.object({
        content: z.string(),
        authorname: z.string().nullable(),
        distance: z.number().nullable(),
      })
    ),
  },
  async (input) => {
    const posts = await searchNearbyPostsDb({
      latitude: input.latitude,
      longitude: input.longitude,
      query: input.query,
      limit: 5,
    });

    return posts.map((p: Post) => ({
        content: p.content,
        authorname: p.authorname,
        distance: p.distance,
    }));
  }
);


// The main flow for the Local Helper
const localHelperFlow = ai.defineFlow(
  {
    name: 'localHelperFlow',
    inputSchema: LocalHelperInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await ai.generate({
      prompt: `You are a friendly and helpful local guide for the LocalPulse app.
Your goal is to answer the user's question based on the data provided by the available tools.
Be concise and helpful. If you find businesses or posts, present them clearly as a list.

- Use the \`findNearbyBusinesses\` tool for questions about shops, restaurants, or services.
- Use the \`searchNearbyPosts\` tool for questions about real-time events, news, or user reports like traffic.
- If you find a business with location data, provide a Google Maps link like this: \`https://www.google.com/maps?q=LATITUDE,LONGITUDE\`.

If you can't find anything relevant with the tools, say so politely.
The user is at latitude ${input.latitude} and longitude ${input.longitude}.

User's Question: ${input.query}`,
      tools: [findNearbyBusinessesTool, searchNearbyPostsTool],
      model: 'googleai/gemini-1.5-flash',
    });

    return text;
  }
);

export async function localHelper(
  input: LocalHelperInput
): Promise<LocalHelperOutput> {
  return localHelperFlow(input);
}
