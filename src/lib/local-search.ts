

'use server';

import { getNearbyBusinessesDb, searchNearbyPostsDb } from '@/lib/db';
import { BUSINESS_CATEGORIES } from '@/lib/db-types';
import type { BusinessUser, Post } from '@/lib/db-types';

// A mapping from common search terms to official business categories
const categorySynonyms: { [key: string]: string | null } = {
    // Shops & Retail
    'grocery': 'Grocery / Kirana Store', 'kirana': 'Grocery / Kirana Store',
    'fruit': 'Fruits & Vegetable Shop', 'vegetable': 'Fruits & Vegetable Shop',
    'bakery': 'Bakery / Cake Shop', 'cake': 'Bakery / Cake Shop',
    'sweet': 'Sweet Shop',
    'milk': 'Dairy / Milk Booth', 'dairy': 'Dairy / Milk Booth',
    'meat': 'Meat & Fish Shop', 'fish': 'Meat & Fish Shop', 'chicken': 'Meat & Fish Shop',
    'book': 'Stationery & Book Store', 'stationery': 'Stationery & Book Store',
    'toy': 'Gift / Toy Shop', 'gift': 'Gift / Toy Shop',
    'clothing': 'Garment / Clothing Store', 'garment': 'Garment / Clothing Store',
    'shoe': 'Footwear Store',
    'cosmetic': 'Cosmetics & Beauty Products',
    'mobile': 'Mobile & Electronics Store', 'electronic': 'Mobile & Electronics Store',
    'furniture': 'Furniture Store',
    'hardware': 'Hardware / Paint Store', 'paint': 'Hardware / Paint Store',
    // Food & Beverage
    'restaurant': 'Restaurant', 'food': 'Restaurant',
    'pizza': 'Pizza Shop',
    'fast food': 'Fast Food Center',
    'tea': 'Tea & Snacks Stall', 'snacks': 'Tea & Snacks Stall',
    'juice': 'Juice Center',
    'ice cream': 'Ice Cream / Dessert Shop', 'dessert': 'Ice Cream / Dessert Shop',
    'cafe': 'Café / Coffee Shop', 'coffee': 'Café / Coffee Shop',
    // Beauty & Personal Care
    'salon': 'Saloon / Barber Shop', 'barber': 'Saloon / Barber Shop',
    'beauty parlour': 'Beauty Parlour',
    'spa': 'Spa / Massage Center', 'massage': 'Spa / Massage Center',
    'tattoo': 'Mehendi / Tattoo Artist', 'mehendi': 'Mehendi / Tattoo Artist',
    // Home Services
    'electrician': 'Electrician',
    'plumber': 'Plumber',
    'carpenter': 'Carpenter',
    'painter': 'Painter',
    'mason': 'Civil Worker / Mason',
    'ac repair': 'AC / Refrigerator Mechanic', 'fridge repair': 'AC / Refrigerator Mechanic',
    'cctv': 'CCTV Installer',
    'ro service': 'RO / Water Purifier Service', 'water purifier': 'RO / Water Purifier Service',
    'gas repair': 'Gas Stove Repair',
    // Other common terms (These will trigger a general business search)
    'shop': null, 'store': null, 'business': null, 'service': null, 'near me': null
};

const allBusinessCategories = Object.values(BUSINESS_CATEGORIES).flat();

function findCategory(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    // Exact match for full category names first
    for (const category of allBusinessCategories) {
        if (lowerQuery.includes(category.toLowerCase())) {
            return category;
        }
    }

    // Match synonyms
    for (const synonym in categorySynonyms) {
        if (lowerQuery.includes(synonym)) {
            const category = categorySynonyms[synonym];
            return category; // This will be null for general terms like "shop", triggering a general search
        }
    }
    return null;
}

export async function localSearch(query: string, latitude: number, longitude: number): Promise<string> {
    const lowerQuery = query.toLowerCase();

    // 1. Check for "help" queries
    const helpKeywords = ['help', 'info', 'what can you do', 'how do you work'];
    if (helpKeywords.some(keyword => lowerQuery.includes(keyword))) {
        return `I can help you with two main things:\n\n1.  **Find local businesses:** Just ask for a type of business, like "find a plumber" or "show me restaurants."\n\n2.  **Search recent posts:** Ask for the "latest news", "traffic updates", or search for posts mentioning a keyword.`;
    }

    // 2. Check for post-related queries
    const postKeywords = ['post', 'pulse', 'news', 'traffic', 'event', 'latest'];
    if (postKeywords.some(keyword => lowerQuery.includes(keyword))) {
        // Create a search query by removing the keywords. If the result is empty, it's a general search.
        const searchQuery = postKeywords.reduce((q, kw) => q.replace(kw, ''), lowerQuery).trim();
        const posts = await searchNearbyPostsDb({
            latitude,
            longitude,
            query: searchQuery, // This can now be an empty string for a general search
            limit: 5
        });

        if (posts.length > 0) {
            return "Here are the latest posts I found:\n\n" + posts.map(p => `- "${p.content}" by ${p.authorname || 'Anonymous'}`).join('\n');
        } else {
            return "I couldn't find any recent posts matching your search.";
        }
    }
    
    // 3. Check for business-related queries
    const businessKeywords = ['business', 'shop', 'store', 'service', 'find', 'show me', 'where is', 'any'];
    const isBusinessQuery = businessKeywords.some(keyword => lowerQuery.includes(keyword));
    const foundCategory = findCategory(lowerQuery);

    if (isBusinessQuery || foundCategory !== null) {
        const businesses = await getNearbyBusinessesDb({
            latitude,
            longitude,
            category: foundCategory || undefined, // Use found category, or do a general search if null
            limit: 5,
            offset: 0,
        });

        if (businesses.length > 0) {
            return "Here are the businesses I found near you:\n\n" + businesses.map(b => `- **${b.name}** (${b.business_category})\n  [View on Map](https://www.google.com/maps?q=${b.latitude},${b.longitude})`).join('\n\n');
        } else {
            return "I couldn't find any businesses matching your search. Please try a different search term.";
        }
    }

    // 4. Fallback for unrecognized queries
    return "Sorry, I can only search for local businesses or recent posts. Please try a query like 'find a restaurant' or 'latest news'.";
}
