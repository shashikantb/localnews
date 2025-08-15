
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
import { revalidatePath } from 'next/cache';

const ai = getAi();

const SeedContentInputSchema = z.object({
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
  city_hint: z.string().optional().describe('An optional city name hint from a reverse geocoder.'),
  today_iso: z.string().optional().describe('The current date in ISO format, e.g., 2025-08-15.'),
});

const SeedContentOutputSchema = z.object({
  posts: z.array(
    z.object({
      content: z.string().describe('The rewritten, engaging local news update or "pulse" for the app.'),
      photo_hint: z
        .string()
        .optional()
        .describe(
          'A simple 1-3 word description in ENGLISH for a photo if this post would benefit from one. E.g., "traffic jam" or "food festival". Omit if no photo is needed.'
        ),
      category: z.enum(['viral', 'useful']).describe('The category of the post.'),
      source_title: z.string().describe('The short source name for verification.'),
      source_time: z.string().describe("The source timestamp, e.g., ISO or 'today HH:mm'."),
      source_url: z.string().url().describe('The source URL for verification.'),
      locality_radius_km: z.number().describe('The radius in km used to find the news.'),
      confidence: z.number().min(0).max(100).describe('Your confidence in the correctness of the information.'),
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
            tbs: 'qdr:w', // Limit search to the past week for relevance
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

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'LocalPulse/1.0 (contact@localpulse.space)' }});
    if (!res.ok) {
        throw new Error(`Nominatim API failed with status ${res.status}`);
    }
    const data = await res.json();
    const a = data?.address ?? {};
    return (
      a.city || a.town || a.municipality || a.village || a.suburb || a.city_district || a.county || a.state_district || a.state || 'Unknown City'
    );
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return "Unknown City"; // Fallback on error
  }
}


const generateContentPrompt = ai.definePrompt({
    name: 'seedContentPrompt',
    input: { schema: SeedContentInputSchema },
    output: { schema: SeedContentOutputSchema },
    model: 'googleai/gemini-1.5-flash',
    tools: [searchTheWeb],
    prompt: `You are an AI for a hyperlocal social app called LocalPulse. Your job:
1) Create one nostalgic throwback for the nearest main square/chowk.
2) Curate fresh, high-signal local updates (mix of viral + useful).


INPUTS:
- latitude: {{latitude}}
- longitude: {{longitude}}
- city_hint: "{{{city_hint}}}"
- today_iso: {{today_iso}}   // e.g., 2025-08-15

LANGUAGE:
- Determine the primary local language for the location. In India, use the state's main language (e.g., Marathi for Maharashtra, Kannada for Karnataka). For other countries, use the country’s primary language.
- If a major bilingual norm exists, write the post in the local language but keep proper nouns in Latin script when common.
- If confidence in language < 70%, default to English.

PART A — Nostalgic Throwback (All Countries)
1) Create ONE special pulse in the same local language describing a nostalgic “throwback” photo of the nearest chowk, main square, or well-known central spot to the given coordinates ({{latitude}}, {{longitude}}) as it might have looked around **10–20 years ago** (based on the current date).
2) Assume realistic period details for that spot’s surroundings: architecture, signage styles, vehicles common in that era, clothing trends, street furniture, lighting, and general atmosphere typical for that time.
3) Make it warm, familiar, and emotionally relatable — something that sparks comments like “I remember this!”.
4) Keep it under 280 characters and clearly indicate it is an AI recreation from the past.
5) Set the "photo_hint" for this to "{{year_range}} {{city_hint}} square" (or “chowk” if in India) in ENGLISH, where \`year_range\` is the chosen nostalgic period (e.g., "2008 Paris square", "2010 Moshi chowk").

PART B — Local News Curation (Viral + Useful)
1) Treat the location as "{{{city_hint}}}" unless you are certain it is wrong. Prefer items within a 30 km radius of ({{latitude}}, {{longitude}}). If fewer than 2 items are found, expand to district/region; if still sparse, expand to the nearest major city.
2) Use the searchTheWeb tool to find RECENT items (prefer last 72 hours; allow up to 7 days if high-impact).
3) Collect 2 candidates across these buckets (aim for at least one from each A & B):
   A. VIRAL/DELIGHT: unique, surprising, heartwarming, visual (festivals, unusual sightings, new attractions, records).
   B. USEFUL/BENEFICIAL: urgent alerts, road closures, water/power updates, health advisories, job fairs, public service drives, education deadlines, civic announcements, public transport changes, local deals that benefit most residents.
4) EXCLUDE: political ads/propaganda, hate/violence, unverified rumors, explicit content.
5) Rewrite each selected story in the LOCAL LANGUAGE as a friendly, shareable update ≤ 280 characters.
   - Make it vivid but accurate; no clickbait, no exaggeration.
   - Include a concrete “when/where” if available.
   - Avoid hashtags and @mentions.
6) Add a concise ENGLISH photo_hint (1–3 words) only if a visual is obvious (e.g., “Spring festival”, “Metro extension map”). Omit if not helpful.
7) Add lightweight attribution fields so editors can verify quickly.

SAFETY & ACCURACY
- Prefer official or reputable local sources for alerts and advisories.
- If a claim seems uncertain, either drop it or clearly mark “report says/likely”.
- When possible, include date/time in the post text.
- Do not include URLs in the content text.

OUTPUT FORMAT
Return an array of objects, each with:
{
  "content": "<post in local language ≤ 280 chars>",
  "photo_hint": "<EN 1–3 words or omit>",
  "category": "viral" | "useful",
  "source_title": "<short source name>",
  "source_time": "<ISO or 'today HH:mm'>",
  "source_url": "<link>",
  "locality_radius_km": <number>,       // e.g., 7.5
  "confidence": 0–100                    // your confidence in correctness
}

Ensure exactly 1 'throwback' item (Part A) and exactly 2 news items (Part B).`,
});


const seedContentFlow = ai.defineFlow(
  {
    name: 'seedContentFlow',
    inputSchema: z.object({ latitude: z.number(), longitude: z.number() }),
    outputSchema: z.custom<SeedContentFlowOutput>(),
  },
  async (input) => {
    // 1. Get the authoritative city name from reverse geocoding
    const cityName = await reverseGeocode(input.latitude, input.longitude);
    if (cityName === 'Unknown' || cityName === 'Unknown City') {
      return { success: false, message: 'Could not determine a valid city from coordinates.', postCount: 0, cityName: 'Unknown' };
    }
    
    // 2. Generate the content from the AI, providing the city name and date as a strong hint.
    const { output } = await generateContentPrompt({
        ...input,
        city_hint: cityName,
        today_iso: new Date().toISOString().split('T')[0],
    });
    
    if (!output || !output.posts || output.posts.length === 0) {
        return { success: false, message: `AI failed to generate content for ${cityName}.`, postCount: 0, cityName };
    }
    
    // 3. Loop through the generated content and create posts
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
              city: cityName, // Use the authoritative city name from reverse geocoding
              authorid: null, // Post as anonymous
              is_family_post: false,
              hide_location: false,
              hashtags: [],
            };
            await addPostDb(postDataForDb);
            createdCount++;
        }
    }
    
    if (createdCount > 0) {
      revalidatePath('/'); // Revalidate the home feed to show new posts
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
    
    // Use Nominatim to get coordinates for the manually entered city name
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    try {
        const geoRes = await fetch(geocodeUrl, { headers: { 'User-Agent': 'LocalPulse/1.0 (contact@localpulse.space)' } });
        if (!geoRes.ok) throw new Error(`Nominatim geocoding failed with status ${geoRes.status}`);
        
        const geoData = await geoRes.json();
        if (geoData.length === 0) {
            return { success: false, message: `Could not find coordinates for "${city}".`, postCount: 0, cityName: city };
        }
        
        const { lat, lon } = geoData[0];
        return await seedContentFlow({ latitude: parseFloat(lat), longitude: parseFloat(lon) });

    } catch(error: any) {
        console.error(`Error during manual seeding for city "${city}":`, error);
        return { success: false, message: error.message, postCount: 0, cityName: city };
    }
}


// This is the new primary function for automatic seeding.
export async function seedContent(input: SeedContentInput): Promise<SeedContentFlowOutput> {
    return await seedContentFlow(input);
}
