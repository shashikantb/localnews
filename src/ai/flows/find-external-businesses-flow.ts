
'use server';
/**
 * @fileOverview An AI flow for finding businesses on the web when none exist in the app's DB.
 *
 * - findExternalBusinesses - The main function that searches for and returns business information.
 */

import { getAi } from '@/utils/firebaseAdmin';
import { getJson } from 'google-search-results-nodejs';
import { z } from 'zod';
import type { FindExternalBusinessesInput, FindExternalBusinessesOutput } from '@/lib/db-types';

const ai = getAi();

const ExternalBusinessSchema = z.object({
  name: z.string().describe('The full name of the business.'),
  phone: z.string().optional().describe('The contact phone number of the business.'),
  address: z.string().optional().describe('The full address of the business.'),
});

const FindExternalBusinessesInputSchema = z.object({
  category: z.string().describe('The category of business to search for, e.g., "plumber", "restaurant".'),
  latitude: z.number(),
  longitude: z.number(),
});

const FindExternalBusinessesOutputSchema = z.object({
  businesses: z.array(ExternalBusinessSchema),
});


// Tool for the AI to search Google for real businesses
const searchGoogleForBusinesses = ai.defineTool(
  {
    name: 'searchGoogleForBusinesses',
    description: 'Searches for local businesses on Google based on a category and location.',
    inputSchema: z.object({
      query: z.string().describe('The search query, e.g., "plumbers near me", "restaurants in Pune".'),
      latitude: z.number(),
      longitude: z.number(),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          title: z.string(),
          address: z.string().optional(),
          phone: z.string().optional(),
          link: z.string().optional(),
        })
      ),
    }),
  },
  async (input) => {
    if (!process.env.SERPAPI_API_KEY) {
      throw new Error('SERPAPI_API_KEY environment variable is not set. Cannot perform web search.');
    }

    const json = await getJson({
      engine: 'google_local',
      q: input.query,
      ll: `@${input.latitude},${input.longitude},15z`, // Use lat/lon for location
      api_key: process.env.SERPAPI_API_KEY,
    });

    const results = (json.local_results || []).slice(0, 10).map((res) => ({
      title: res.title,
      address: res.address,
      phone: res.phone,
      link: res.link,
    }));

    return { results };
  }
);

const findExternalBusinessesFlow = ai.defineFlow(
  {
    name: 'findExternalBusinessesFlow',
    inputSchema: FindExternalBusinessesInputSchema,
    outputSchema: FindExternalBusinessesOutputSchema,
  },
  async (input) => {
    const { businesses } = await ai.generate({
      prompt: `You are a helpful local business finder. Find businesses matching the category "${input.category}" near the user's location. Return a list of businesses with their name, and phone number and address if available.`,
      tools: [searchGoogleForBusinesses],
      model: 'googleai/gemini-1.5-flash',
      output: {
        schema: FindExternalBusinessesOutputSchema,
      },
    });

    return businesses || { businesses: [] };
  }
);


export async function findExternalBusinesses(
  input: FindExternalBusinessesInput
): Promise<FindExternalBusinessesOutput> {
  return findExternalBusinessesFlow(input);
}
