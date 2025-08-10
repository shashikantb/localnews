
'use server';
/**
 * @fileOverview An AI flow for seeding the database with realistic, fictional content.
 *
 * - seedContent - The main function that handles generating and posting content for a location.
 */

import { getAi } from '@/utils/firebaseAdmin';
import { addPostDb } from '@/lib/db';
import type { DbNewPost, SeedContentInput, SeedContentFlowOutput } from '@/lib/db-types';
import { z } from 'zod';
import { getGcsClient, getGcsBucketName } from '@/lib/gcs';
import { getJson } from 'google-search-results-nodejs';

const ai = getAi();

const SeedContentInputSchema = z.object({
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
});

const SeedContentOutputSchema = z.object({
  city: z.string().describe('The city identified from the coordinates.'),
  posts: z.array(
    z.object({
      content: z.string().describe('The rewritten, engaging local news update or "pulse" for the app.'),
      photo_hint: z
        .string()
        .optional()
        .describe(
          'A simple 1-2 word description in ENGLISH for a photo if this post would benefit from one. E.g., "traffic jam" or "food festival". Omit if no photo is needed.'
        ),
    })
  ),
});

// Tool for the AI to search the web for real news
const searchTheWeb = ai.defineTool(
    {
        name: 'searchTheWeb',
        description: 'Searches the web for recent news and updates for a specific city.',
        inputSchema: z.object({
            query: z.string().describe('The search query, e.g., "latest news in Mumbai".'),
        }),
        outputSchema: z.object({
            results: z.array(z.object({
                title: z.string(),
                link: z.string(),
                snippet: z.string(),
            })),
        }),
    },
    async (input) => {
        if (!process.env.SERPAPI_API_KEY) {
            throw new Error('SERPAPI_API_KEY environment variable is not set. Cannot perform web search.');
        }

        const json = await getJson({
            engine: 'google',
            q: input.query,
            api_key: process.env.SERPAPI_API_KEY,
        });

        const results = (json.organic_results || []).slice(0, 5).map(res => ({
            title: res.title,
            link: res.link,
            snippet: res.snippet,
        }));

        return { results };
    }
);


// Helper function to upload base64 image to GCS
async function uploadImageToGcs(base64Data: string, city: string): Promise<string> {
    const gcsClient = getGcsClient();
    const bucketName = getGcsBucketName();

    if (!gcsClient || !bucketName) {
        throw new Error('GCS not configured. Cannot upload image.');
    }
    
    // Extract mime type and data from data URI
    const match = base64Data.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error('Invalid base64 image data URI format.');
    }
    const contentType = match[1];
    const data = match[2];

    const buffer = Buffer.from(data, 'base64');
    const fileName = `seeded-content/${city.toLowerCase().replace(/[\s,]+/g, '-')}/${Date.now()}.png`;
    const file = gcsClient.bucket(bucketName).file(fileName);

    await file.save(buffer, {
        metadata: { contentType: contentType },
        public: true, // Make the file publicly readable
    });
    
    // Return the public URL
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}


const generateContentPrompt = ai.definePrompt({
    name: 'seedContentPrompt',
    input: { schema: SeedContentInputSchema },
    output: { schema: SeedContentOutputSchema },
    model: 'googleai/gemini-1.5-flash',
    tools: [searchTheWeb],
    prompt: `You are an AI for a social media app called LocalPulse. Your task is to act as a local news curator.
    
    1.  **First, you MUST determine the major city, state, and country for the given latitude: {{{latitude}}} and longitude: {{{longitude}}}.**
    2.  Determine the primary local language for that location. For India, use the state language (e.g., Marathi for Maharashtra, Kannada for Karnataka). For other countries, use their primary language (e.g., German for Germany).
    3.  Use the 'searchTheWeb' tool to find 2-3 of the most recent and relevant news updates for that city. Use a search query like "latest news in [city name]".
    4.  **IMPORTANT**: Ignore any news related to political campaigns, election ads, or political advertising. Focus on local events, infrastructure, traffic, or general community news.
    5.  For each piece of news you find, rewrite it in the determined **LOCAL LANGUAGE** as a short, realistic, and engaging local news update or "pulse" for the app.
    6.  Keep each pulse under 280 characters.
    7.  For each rewritten pulse, provide a simple 1-2 word "photo_hint" in **ENGLISH** describing a suitable image (e.g., "traffic jam", "food festival"). Omit the photo_hint if no photo is suitable.
    8.  The tone should be informative but casual, like a real person sharing an update.
    9.  DO NOT use hashtags.

    Generate the content for the location provided.`,
});


const seedContentFlow = ai.defineFlow(
  {
    name: 'seedContentFlow',
    inputSchema: SeedContentInputSchema,
    outputSchema: z.custom<SeedContentFlowOutput>(),
  },
  async (input) => {
    // 1. Generate the content from the AI, which will also determine the city.
    const { output } = await generateContentPrompt(input);
    
    if (!output || !output.city) {
      return { success: false, message: 'AI failed to identify city from coordinates.', postCount: 0, cityName: 'Unknown' };
    }
    const cityName = output.city;

    if (!output.posts || output.posts.length === 0) {
        return { success: false, message: `AI failed to generate content for ${cityName}.`, postCount: 0, cityName };
    }
    
    // 2. Loop through the generated content and create posts
    let createdCount = 0;
    for (const post of output.posts) {
        if (post.content) {
            let mediaUrls: string[] | undefined = undefined;
            let mediaType: 'image' | undefined = undefined;
            
            // If there's a photo hint, generate an image
            if(post.photo_hint) {
                 try {
                    const { media } = await ai.generate({
                        model: 'googleai/gemini-2.0-flash-preview-image-generation',
                        prompt: `A realistic photo of ${post.photo_hint} in ${cityName}.`,
                        config: { responseModalities: ['TEXT', 'IMAGE'] },
                    });

                    if (media && media.url) {
                        const publicUrl = await uploadImageToGcs(media.url, cityName);
                        mediaUrls = [publicUrl];
                        mediaType = 'image';
                    }
                } catch (imgError) {
                    console.error(`Failed to generate or upload image for hint "${post.photo_hint}":`, imgError);
                    // Continue without an image if generation fails
                }
            }
            
            const postDataForDb: DbNewPost = {
              content: post.content,
              latitude: input.latitude,
              longitude: input.longitude,
              mediaurls: mediaUrls,
              mediatype: mediaType,
              city: cityName,
              authorid: null, // Post as anonymous
              is_family_post: false,
              hide_location: false,
              hashtags: [],
            };
            await addPostDb(postDataForDb);
            createdCount++;
        }
    }

    return { 
        success: true, 
        message: `Successfully seeded ${createdCount} posts for ${cityName}.`,
        postCount: createdCount,
        cityName: cityName,
    };
  }
);

// This is the manual seeding function for the admin panel
export async function seedCityContent(city: string): Promise<SeedContentFlowOutput> {
    if (!city) {
        throw new Error(`City name must be provided for manual content seeding.`);
    }
    // Note: Manual seeding via the admin panel doesn't have specific coordinates.
    // We'll use a placeholder or lookup if we want to add it back.
    // For now, let's throw an error because the flow requires lat/lon.
    // A better implementation would be to geocode the city name here.
    // For simplicity, we are disabling manual seeding until that is implemented.
    // throw new Error("Manual seeding by city name is temporarily disabled. Please use live seeding.");
    console.warn(`Manual seeding for "${city}" is using placeholder coordinates. Geocoding should be implemented.`);
    const placeholderCoords = { latitude: 51.5072, longitude: -0.1276 }; // London placeholder
    return await seedContentFlow({ latitude: placeholderCoords.latitude, longitude: placeholderCoords.longitude });
}

// This is the new primary function for automatic seeding.
export async function seedContent(input: SeedContentInput): Promise<SeedContentFlowOutput> {
    return await seedContentFlow(input);
}
