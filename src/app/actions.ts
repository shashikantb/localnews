

'use server';

import * as db from '@/lib/db';
import type { Appointment, ConversationDetails, GanpatiMandal, Poll, Post, NewPost as ClientNewPost, Comment, NewComment, DbNewPost, VisitorCounts, User, UserFollowStats, FollowUser, UserWithStatuses, NewStatus, FamilyMember, FamilyMemberLocation, PendingFamilyRequest, Conversation, Message, ConversationParticipant, SortOption, BusinessUser, GorakshakReportUser, PointTransaction, UserForNotification, MessageReaction, NewGanpatiMandal, FindExternalBusinessesOutput, FindExternalBusinessesInput, ExternalBusiness } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { getSession, encrypt } from '@/app/auth/actions';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import admin, { getAi } from '@/utils/firebaseAdmin';
import { getGcsBucketName, getGcsClient } from '@/lib/gcs';
import { seedContent } from '@/ai/flows/seed-content-flow';
import ngeohash from "ngeohash";
import { z } from 'zod';

const ai = getAi();

type NominatimAddr = {
  neighbourhood?: string;
  suburb?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city_district?: string; // e.g., Pimpri-Chinchwad
  municipality?: string;
  city?: string;          // e.g., Pune
  county?: string;        // often used as District in India
  state_district?: string;// also used as District
  state?: string;         // Maharashtra
  country?: string;
};

function pickLabel(a: NominatimAddr): string {
  // Prefer the most local place first
  const locality =
    a.neighbourhood ||
    a.suburb ||
    a.hamlet ||
    a.village ||
    a.town;

  // City-scale: prefer PCMC (city_district) over generic city when present
  const cityLevel =
    a.city_district ||
    a.municipality ||
    a.city ||
    a.town;

  // District fallback (India: district appears in state_district/county)
  const district = a.state_district || a.county;

  if (locality && cityLevel) return `${locality}, ${cityLevel}`;
  if (locality && district)  return `${locality}, ${district}`;
  if (cityLevel)             return cityLevel;
  if (district)              return district;
  return a.state || a.country || "Unknown City";
}

async function resolveCityFromCoords(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lon),
    addressdetails: "1",
    namedetails: "1",
    extratags: "1",
    zoom: "18",
    "accept-language": "en"
  });
  const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        // Per Nominatim policy: real UA + contact
        "User-Agent": "LocalPulse/1.0 (+contact@localpulse.space)"
      }
    });
    if (!res.ok) throw new Error(`Nominatim API failed with status ${res.status}`);
    const data = await res.json() as { address?: NominatimAddr };
    const base = pickLabel(data.address ?? {});

    // Pune-area polish: if in Pune district and locality is a PCMC area,
    // ensure we suffix Pimpri-Chinchwad (prevents "Pune" or worse "Mumbai").
    const inPuneDistrict =
      (data.address?.state_district === "Pune") || (data.address?.county === "Pune");
    if (
      inPuneDistrict &&
      /Moshi|Chikhali|Bhosari|Nigdi|Akurdi|Talwade|Ravet|Wakad|Pimpri|Chinchwad/i.test(base) &&
      !/Pimpri[- ]?Chinchwad/i.test(base)
    ) {
      return `${base}, Pimpri-Chinchwad`;
    }
    return base;
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return "Unknown City";
  }
}


async function enrichPosts(posts: Post[], user: User | null): Promise<Post[]> {
    if (!posts || posts.length === 0) {
        return [];
    }
    const postIds = posts.map(p => p.id);
    const [mentionsMap, pollsMap] = await Promise.all([
      db.getMentionsForPostsDb(postIds),
      db.getPollsForPostsDb(postIds, user?.id)
    ]);

    posts.forEach((post: any) => {
        post.mentions = mentionsMap.get(post.id) || [];
        post.poll = pollsMap.get(post.id) || null;
        // The isLikedByCurrentUser and isAuthorFollowedByCurrentUser flags are now set directly by the DB query
        // but we need to ensure they are boolean values for client-side logic.
        post.isLikedByCurrentUser = !!post.isLikedByCurrentUser;
        post.isAuthorFollowedByCurrentUser = !!post.isAuthorFollowedByCurrentUser;
    });

    return posts;
}

export async function getPosts(options?: { page: number; limit: number; latitude?: number | null; longitude?: number | null; sortBy?: SortOption; }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? {
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        latitude: options.latitude,
        longitude: options.longitude,
        sortBy: options.sortBy,
        currentUserId: user?.id,
    } : { limit: 10, offset: 0, sortBy: 'nearby' as SortOption, currentUserId: user?.id };

    const posts = await db.getPostsDb(dbOptions);
    // Enrich with mentions and polls, which are separate queries.
    // Like and Follow status are now handled in the main getPostsDb query.
    return enrichPosts(posts, user);
    
  } catch (error: any) {
    console.error("Server action error fetching posts:", error.message);
    return [];
  }
}

export async function getFamilyPosts(options: { page: number, limit: number, sortBy?: SortOption }): Promise<Post[]> {
    try {
        const { user } = await getSession();
        if (!user) {
            return [];
        }

        const dbOptions = { limit: options.limit, offset: (options.page - 1) * options.limit, sortBy: options.sortBy || 'newest' };
        const posts = await db.getFamilyPostsDb(user.id, dbOptions);
        return enrichPosts(posts, user);

    } catch (error: any) {
        console.error("Server action error fetching family posts:", error.message);
        return [];
    }
}


export async function getAdminPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? {
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        currentUserId: user?.id,
    } : { limit: 10, offset: 0, currentUserId: user?.id };

    const posts = await db.getPostsDb(dbOptions, true);
    return enrichPosts(posts, user);
  } catch (error) {
    console.error("Server action error fetching admin posts:", error);
    return [];
  }
}


export async function getMediaPosts(options?: { page: number; limit: number }): Promise<Post[]> {
  try {
    const { user } = await getSession();
    const dbOptions = options ? { limit: options.limit, offset: (options.page - 1) * options.limit, currentUserId: user?.id } : { limit: 10, offset: 0, currentUserId: user?.id };
    
    const posts = await db.getMediaPostsDb(dbOptions);
    return enrichPosts(posts, user);

  } catch (error) {
    console.error("Server action error fetching media posts:", error);
    return [];
  }
}

async function sendFamilyPostNotification(post: Post, author: User) {
    if (!admin.apps.length) return;
    try {
        const familyMemberIds = await db.getFamilyMemberIdsDb(author.id);
        if (familyMemberIds.length === 0) return;

        const tokens = await db.getDeviceTokensForUsersDb(familyMemberIds);
        if (tokens.length === 0) return;
        
        const messages = await Promise.all(tokens.map(async ({ token, user_id }) => {
            const freshToken = await encrypt({ userId: user_id });
            return {
                token: token,
                notification: {
                    title: `${author.name} added a new Family Pulse`,
                    body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
                },
                data: {
                    user_auth_token: freshToken,
                    type: 'FAMILY_POST' // Custom data to identify the notification type
                },
                android: { priority: 'high' as const, notification: { channelId: 'family_activity'} },
                apns: { payload: { aps: { 'content-available': 1 } } }
            }
        }));

        const response = await admin.messaging().sendEach(messages as any);
        if (response.successCount > 0) {
            await db.updateNotifiedCountDb(post.id, response.successCount);
        }

        if (response.failureCount > 0) {
            console.error(`Failed to send family post notification to ${response.failureCount} tokens.`);
        }

    } catch (error) {
        console.error('Error sending family post notification:', error);
    }
}


async function sendNotificationForNewPost(post: Post, mentionedUserIds: number[] = []) {
  try {
    // Do not send notifications for Mandal posts or family posts in the main feed
    if (post.mandal_id || post.is_family_post || !admin.apps.length) {
      return;
    }
      
    let successCount = 0;
    const failedTokens: string[] = [];
    const processedTokens = new Set<string>();
    const authorDisplayName = post.authorname || 'an Anonymous Pulsar';

    // 1. Send notifications to mentioned users
    if (mentionedUserIds.length > 0) {
        const mentionedUsersTokens = await db.getDeviceTokensForUsersDb(mentionedUserIds);
        if (mentionedUsersTokens.length > 0) {
            const messages = await Promise.all(mentionedUsersTokens.map(async ({ token, user_id }) => {
                const freshToken = await encrypt({ userId: user_id });
                return {
                    token: token,
                    notification: {
                        title: `${authorDisplayName} mentioned you in a pulse!`,
                        body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
                    },
                    data: {
                        user_auth_token: freshToken
                    },
                    android: { priority: 'high' as const, notification: { channelId: 'new_posts'} },
                    apns: { payload: { aps: { 'content-available': 1 } } }
                }
            }));
            
            const response = await admin.messaging().sendEach(messages as any);
            successCount += response.successCount;
            response.responses.forEach((resp, idx) => {
                if (!resp.success) failedTokens.push(mentionedUsersTokens[idx].token);
            });
            mentionedUsersTokens.forEach(t => processedTokens.add(t.token));
        }
    }

    // 2. Send notifications to nearby users (who were not already notified via mention)
    const nearbyTokens = await db.getNearbyDeviceTokensDb(post.latitude, post.longitude, 20);
    const nearbyOnlyTokens = nearbyTokens.filter(t => !processedTokens.has(t.token));

    if (nearbyOnlyTokens.length > 0) {
        const message = {
            notification: {
                title: `New Pulse Nearby from ${authorDisplayName}!`,
                body: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            },
            data: {
                user_auth_token: '' // No auth for nearby anonymous users
            },
            tokens: nearbyOnlyTokens.map(t => t.token),
            android: { priority: 'high' as const, notification: { channelId: 'new_posts'} },
            apns: { payload: { aps: { 'content-available': 1 } } }
        };
        const response = await admin.messaging().sendEachForMulticast(message as any);
        successCount += response.successCount;
        response.responses.forEach((resp, idx) => {
            if (!resp.success) failedTokens.push(nearbyOnlyTokens[idx].token);
        });
    }

    // 3. Update notification count and clean up failed tokens
    if (successCount > 0) {
      await db.updateNotifiedCountDb(post.id, successCount);
    }
    
    if (failedTokens.length > 0) {
      console.error('List of tokens that caused failures:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

async function sendChatNotification(conversationId: number, sender: User, content: string, title?: string) {
  try {
    if (!admin.apps.length) return;
    const participants = await db.getConversationParticipantsDb(conversationId);
    if (!participants) return;

    const recipientIds = participants.map(p => p.id).filter(id => id !== sender.id);
    if(recipientIds.length === 0) return;

    const deviceTokens = await db.getDeviceTokensForUsersDb(recipientIds);
    if (deviceTokens.length === 0) return;
    
    // Default title for 1-on-1 chats
    let notificationTitle = title || `New message from ${sender.name}`;

    const convDetails = await db.getConversationDetailsDb(conversationId, sender.id);
    if(convDetails?.is_group){
      // For group chats, the title should include the group name
      notificationTitle = title || `New message in ${convDetails.display_name}`;
    }
    
    const notificationBody = content.length > 100 ? `${content.substring(0, 97)}...` : content;

    const messages = await Promise.all(deviceTokens.map(async ({ token, user_id }) => {
        const freshToken = await encrypt({ userId: user_id });
        return {
            token: token,
            notification: {
                title: notificationTitle,
                body: notificationBody,
            },
            data: {
                user_auth_token: freshToken
            },
            android: { priority: 'high' as const, notification: { channelId: 'chat_messages' } },
            apns: { payload: { aps: { 'content-available': 1 } } }
        }
    }));

    const response = await admin.messaging().sendEach(messages as any);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) failedTokens.push(deviceTokens[idx].token);
      });
      console.error('List of tokens that failed for chat notification:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending chat notification:', error);
  }
}


async function sendNotificationForNewComment(comment: Comment, post: Post) {
  try {
    if (!post.authorid || !admin.apps.length) return;
    
    const { user: commenterUser } = await getSession();
    if (commenterUser && commenterUser.id === post.authorid) return;

    const authorDeviceTokens = await db.getDeviceTokensForUsersDb([post.authorid]);
    if (authorDeviceTokens.length === 0) return;
    
    const freshToken = await encrypt({ userId: post.authorid });
    const notificationTitle = `${comment.author} commented on your pulse`;
    const notificationBody = comment.content.length > 100 ? `${comment.content.substring(0, 97)}...` : comment.content;

    const messages = authorDeviceTokens.map(({ token }) => ({
        token: token,
        notification: {
            title: notificationTitle,
            body: notificationBody,
        },
        data: {
            user_auth_token: freshToken
        },
        android: { priority: 'high' as const, notification: { channelId: 'new_posts'} },
        apns: { payload: { aps: { 'content-available': 1 } } }
    }));

    const response = await admin.messaging().sendEach(messages as any);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) failedTokens.push(authorDeviceTokens[idx].token);
      });
      console.error('List of tokens that failed for new comment notification:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending new comment notification:', error);
  }
}

export async function addPost(newPostData: ClientNewPost): Promise<{ post?: Post; error?: string }> {
  try {
    const { user } = await getSession(); // user can be null

    if (newPostData.isFamilyPost && !user) {
        return { error: 'You must be logged in to create a family post.' };
    }
      
    // Mandal posts require an admin to be logged in
    if (newPostData.mandalId && !user) {
        return { error: 'You must be logged in as an admin to post to a Mandal.'};
    }
    
    // For regular posts, authorId can be null, but if provided, it must match the session user
    if (!newPostData.mandalId && newPostData.authorId && (!user || user.id !== newPostData.authorId)) {
        return { error: 'Authentication mismatch. You can only post for yourself.' };
    }
    
    let mediaUrls = newPostData.mediaUrls;
    let mediaType = newPostData.mediaType;
    let content = newPostData.content;
    
    // If no media file was uploaded, check the text content for a YouTube link.
    if (!mediaUrls || mediaUrls.length === 0) {
      // This regex is now more robust, handling various URL formats and query parameters.
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})(?:\S+)?/
      const match = content.match(urlRegex);

      if (match) {
          const youtubeId = match[1];   // The 11-character video ID is always in the first capturing group.
          const urlToRemove = match[0]; // The full matched URL.

          mediaUrls = [`https://www.youtube.com/embed/${youtubeId}`];
          mediaType = 'video';
          // Replace only the first occurrence of the URL to be safe, then trim whitespace.
          content = content.replace(urlToRemove, '').trim();
      }
    }

    const cityName = await resolveCityFromCoords(newPostData.latitude, newPostData.longitude);

    const postDataForDb: DbNewPost = {
      content: content, // Use potentially modified content
      latitude: newPostData.latitude,
      longitude: newPostData.longitude,
      mediaurls: mediaUrls,
      mediatype: mediaType,
      hashtags: newPostData.hashtags || [], 
      city: cityName,
      is_family_post: newPostData.isFamilyPost || false,
      hide_location: newPostData.hideLocation || false,
      authorid: user ? user.id : null,
      mentionedUserIds: newPostData.mentionedUserIds || [],
      expires_at: newPostData.expires_at,
      max_viewers: newPostData.max_viewers,
      pollData: newPostData.pollData,
      mandal_id: newPostData.mandalId,
    };

    const addedPostDb = await db.addPostDb(postDataForDb);
    
    const finalPost = await db.getPostByIdDb(addedPostDb.id, user?.id);

    if (!finalPost) {
        return { error: 'Failed to retrieve post after creation.' };
    }

    revalidatePath('/');
    if(finalPost.mandal_id) {
        revalidatePath(`/mandals/${finalPost.mandal_id}`);
    }
    
    // Run notifications in the background
    if (finalPost.is_family_post && user) {
        sendFamilyPostNotification(finalPost, user).catch(err => {
            console.error("Background family post notification failed:", err);
        });
    } else {
        sendNotificationForNewPost(finalPost, postDataForDb.mentionedUserIds).catch(err => {
            console.error("Background notification sending failed:", err);
        });
    }

    return { post: finalPost };
  } catch (error: any) {
    console.error("Server action error adding post:", error);
    return { error: error.message || 'Failed to add post due to an unknown server error.' };
  }
}

export async function deleteUserPost(postId: number): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to delete a post.' };
  }

  const postToDelete = await db.getPostByIdDb(postId);
  if (!postToDelete) {
    return { success: false, error: 'Post not found.' };
  }

  if (postToDelete.authorid !== user.id) {
    return { success: false, error: 'You are not authorized to delete this post.' };
  }

  try {
    await db.deletePostDb(postId);
    revalidatePath('/');
    revalidatePath(`/users/${user.id}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting post:', error);
    return { success: false, error: 'Failed to delete post due to a server error.' };
  }
}

export async function toggleLikePost(postId: number): Promise<{ post?: Post; error?: string }> {
  try {
    const { user } = await getSession();
    if (!user) {
      return { error: 'You must be logged in to like a post.' };
    }

    const hasLiked = await db.checkIfUserLikedPostDb(user.id, postId);
    let updatedPost: Post | null;

    if (hasLiked) {
      await db.removeLikeDb(user.id, postId);
      updatedPost = await db.updatePostLikeCountDb(postId, 'decrement');
    } else {
      await db.addLikeDb(user.id, postId);
      updatedPost = await db.updatePostLikeCountDb(postId, 'increment');
    }
    
    if (updatedPost) {
      revalidatePath('/'); 
      revalidatePath(`/posts/${postId}`);
      updatedPost.isLikedByCurrentUser = !hasLiked;
      return { post: updatedPost };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    // Fail silently on the client
    console.error(`Server action error toggling like for post ${postId}:`, error.message);
    return { error: 'Failed to update like count due to a server error.' };
  }
}

export async function likePostAnonymously(postId: number): Promise<{ post?: Post; error?: string }> {
  try {
    // For anonymous users, we just increment the count. We can't toggle.
    const updatedPost = await db.updatePostLikeCountDb(postId, 'increment');
    
    if (updatedPost) {
      revalidatePath('/'); 
      revalidatePath(`/posts/${postId}`);
      return { post: updatedPost };
    }
    return { error: 'Post not found or failed to update.' };
  } catch (error: any) {
    // Fail silently on the client
    console.error(`Server action error liking post ${postId} anonymously:`, error.message);
    return { error: 'Failed to update like count due to a server error.' };
  }
}


export async function addComment(commentData: NewComment): Promise<{ comment?: Comment; error?: string }> {
  try {
    const { user } = await getSession();
    const authorName = user ? user.name : 'PulseFan';
    
    const addedComment = await db.addCommentDb({ ...commentData, author: authorName });

    // Fetch the post to notify its author
    const post = await db.getPostByIdDb(commentData.postId);
    if (post) {
      // Don't block the client response, run notification in the background
      sendNotificationForNewComment(addedComment, post).catch(err => {
        console.error("Background task to send comment notification failed:", err);
      });
    }

    revalidatePath('/');
    revalidatePath(`/posts/${commentData.postId}`);
    revalidatePath(`/chat`);
    return { comment: addedComment };
  } catch (error: any) {
    // Fail silently on the client
    console.error(`Server action error adding comment to post ${commentData.postId}:`, error.message);
    return { error: 'Failed to add comment due to a server error.' };
  }
}

export async function getComments(postId: number): Promise<Comment[]> {
  try {
    const comments = await db.getCommentsByPostIdDb(postId);
    return comments;
  } catch (error) {
    console.error(`Server action error fetching comments for post ${postId}:`, error);
    return [];
  }
}

export async function recordPostView(postId: number): Promise<{ success: boolean }> {
  try {
    await db.incrementPostViewCountDb(postId);
    return { success: true };
  } catch (error) {
    console.error(`Server action error recording view for post ${postId}:`, error);
    return { success: false };
  }
}

export async function recordVisitAndGetCounts(): Promise<VisitorCounts> {
  try {
    const counts = await db.incrementAndGetVisitorCountsDb();
    return counts;
  } catch (error) {
    console.error("Server action error recording visit and getting counts:", error);
    return { totalVisits: 0, dailyVisits: 0 };
  }
}

export async function getCurrentVisitorCounts(): Promise<VisitorCounts> {
  try {
    const counts = await db.getVisitorCountsDb();
    return counts;
  } catch (error) {
    console.error("Server action error getting current visitor counts:", error);
    return { totalVisits: 0, dailyVisits: 0 };
  }
}

export async function registerDeviceToken(
  token: string,
  latitude?: number,
  longitude?: number
): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: 'Device token is required.' };
  }
  try {
    const { user } = await getSession(); // Get user from session to associate token
    const userAuthToken = cookies().get('user-auth-token')?.value;
    await db.addOrUpdateDeviceTokenDb(token, latitude, longitude, user?.id, userAuthToken);
    return { success: true };
  } catch (error: any) {
    console.error('Server action error registering device token:', error);
    return { success: false, error: error.message || 'Failed to register device token.' };
  }
}

export async function updateUserLocation(latitude?: number, longitude?: number): Promise<void> {
    if (latitude === undefined || longitude === undefined) return;
    try {
        const { user } = await getSession();
        if (user) {
            await db.updateUserLocationDb(user.id, latitude, longitude);
        }
    } catch (error: any) {
        // Fail silently
        console.error('Failed to update user location in background:', error.message);
    }
}


export async function checkForNewerPosts(latestPostIdClientKnows: number): Promise<{ hasNewerPosts: boolean; count: number }> {
  try {
    // If the client doesn't know about any posts yet (e.g., initial load),
    // there are no "newer" posts to show. The initial fetch will get the latest ones.
    if (latestPostIdClientKnows === 0) {
        return { hasNewerPosts: false, count: 0 };
    }
    const count = await db.getNewerPostsCountDb(latestPostIdClientKnows);
    return { hasNewerPosts: count > 0, count };
  } catch (error) {
    console.error("Server action error checking for newer posts:", error);
    return { hasNewerPosts: false, count: 0 };
  }
}

export async function getUser(userId: number): Promise<User | null> {
    try {
        const user = await db.getUserByIdDb(userId);
        return user;
    } catch (error) {
        console.error(`Server action error fetching user ${userId}:`, error);
        return null;
    }
}

export async function getPostsByUserId(userId: number, sessionUserId?: number | null): Promise<Post[]> {
  try {
    const { user: sessionUser } = await getSession();
    const posts = await db.getPostsByUserIdDb(userId, sessionUser?.id);
    return enrichPosts(posts, sessionUser);
  } catch (error) {
    console.error(`Server action error fetching posts for user ${userId}:`, error);
    return [];
  }
}

export async function getPostById(postId: number): Promise<Post | null> {
  try {
    const { user } = await getSession();
    let post = await db.getPostByIdDb(postId, user?.id);
    if (!post) return null;

    // enrichPosts now handles mentions and polls
    const enrichedPosts = await enrichPosts([post], user);
    return enrichedPosts[0];

  } catch (error) {
    console.error(`Server action error fetching post ${postId}:`, error);
    return null;
  }
}

export async function getPostsForMap(bounds: { ne: { lat: number, lng: number }, sw: { lat: number, lng: number } }): Promise<Post[]> {
  try {
    const posts = await db.getPostsInBoundsDb(bounds);
    // For the map, we don't need full enrichment, just the posts themselves.
    return posts;
  } catch (error) {
    console.error("Server action error fetching posts for map:", error);
    return [];
  }
}


// --- Follower Actions ---

export async function getUserWithFollowInfo(profileUserId: number): Promise<{ user: User | null; stats: UserFollowStats; isFollowing: boolean }> {
  const { user: sessionUser } = await getSession();
  
  const [profileUser, stats] = await Promise.all([
    db.getUserByIdDb(profileUserId),
    db.getFollowerCountsDb(profileUserId),
  ]);

  if (!profileUser) {
    return { user: null, stats: { followerCount: 0, followingCount: 0 }, isFollowing: false };
  }

  // Sanitization is now handled by the DB query.

  let isFollowing = false;
  if (sessionUser && sessionUser.id !== profileUserId) {
    isFollowing = await db.checkIfUserIsFollowingDb(sessionUser.id, profileUserId);
  }

  return { user: profileUser, stats, isFollowing };
}

export async function getFollowingList(userId: number): Promise<FollowUser[]> {
    try {
        return await db.getFollowingListDb(userId);
    } catch (error) {
        console.error(`Error fetching following list for user ${userId}:`, error);
        return [];
    }
}

export async function toggleFollow(targetUserId: number): Promise<{ success: boolean; isFollowing?: boolean; error?: string; }> {
  const { user: sessionUser } = await getSession();
  
  if (!sessionUser) {
    return { success: false, error: "You must be logged in to follow users." };
  }
  
  if (sessionUser.id === targetUserId) {
    return { success: false, error: "You cannot follow yourself." };
  }

  try {
    const isCurrentlyFollowing = await db.checkIfUserIsFollowingDb(sessionUser.id, targetUserId);

    if (isCurrentlyFollowing) {
      await db.unfollowUserDb(sessionUser.id, targetUserId);
    } else {
      await db.followUserDb(sessionUser.id, targetUserId);
    }
    
    revalidatePath(`/users/${targetUserId}`);
    revalidatePath('/', 'layout'); // Revalidate home page feed as well
    return { success: true, isFollowing: !isCurrentlyFollowing };

  } catch (error: any) {
    console.error(`Error toggling follow for user ${targetUserId}:`, error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}

export async function getPotentialGroupMembers(): Promise<FollowUser[]> {
  const { user } = await getSession();
  if (!user) return [];
  try {
    return await db.getPotentialGroupMembersDb(user.id);
  } catch (error) {
    console.error(`Error fetching potential group members for user ${user.id}:`, error);
    return [];
  }
}


// --- Mention Actions ---
export async function searchUsers(query: string, currentUserId?: number): Promise<User[]> {
  const { user } = await getSession();
  if (!query) return [];
  try {
    return await db.searchUsersDb(query, user?.id);
  } catch (error) {
    console.error("Server action error searching users:", error);
    return [];
  }
}

export async function searchGroupMembers(query: string, conversationId: number): Promise<ConversationParticipant[]> {
    const { user } = await getSession();
    if (!query || !user) return [];
    try {
        return await db.searchGroupMembersDb(query, conversationId, user.id);
    } catch (error) {
        console.error("Server action error searching group members:", error);
        return [];
    }
}

// --- Poll Actions ---
export async function castVote(pollId: number, optionId: number): Promise<{ poll: Poll | null; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { poll: null, error: 'You must be logged in to vote.' };
  }

  try {
    const updatedPoll = await db.castVoteDb(user.id, pollId, optionId);
    if (updatedPoll) {
      revalidatePath('/'); // Revalidate feed to show new vote counts
      revalidatePath(`/posts/${updatedPoll.post_id}`);
      return { poll: updatedPoll };
    } else {
      return { poll: null, error: "You have already voted in this poll." };
    }
  } catch (error: any) {
    console.error('Error casting vote:', error);
    return { poll: null, error: 'An unexpected server error occurred.' };
  }
}


// --- Status (Story) Actions ---

export async function addStatus(mediaUrl: string, mediaType: 'image' | 'video'): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to post a status.' };
  }
  
  try {
    const newStatus: NewStatus = {
      userId: user.id,
      mediaUrl,
      mediaType,
    };
    await db.addStatusDb(newStatus);
    revalidatePath('/'); // Revalidate home page to show new status
    return { success: true };
  } catch (error: any) {
    console.error('Error adding status:', error);
    return { success: false, error: error.message || 'Failed to post status.' };
  }
}

export async function getStatusesForFeed(): Promise<UserWithStatuses[]> {
  const { user } = await getSession();
  if (!user) {
    return [];
  }
  
  try {
    return await db.getStatusesForFeedDb(user.id);
  } catch (error) {
    console.error('Error fetching statuses for feed:', error);
    return [];
  }
}

// --- Family Relationship Actions ---

async function sendFamilyRequestNotification(requester: User, receiverId: number) {
    if (!admin.apps.length) return;
    try {
        const tokens = await db.getDeviceTokensForUsersDb([receiverId]);
        if (tokens.length === 0) return;

        const freshToken = await encrypt({ userId: receiverId });
        const notification = {
            title: 'New Family Request!',
            body: `${requester.name} has sent you a family request.`,
        };
        
        const messages = tokens.map(t => ({
            token: t.token,
            notification,
            data: { user_auth_token: freshToken },
            android: { priority: 'high' as const, notification: { channelId: 'family_activity' } },
            apns: { payload: { aps: { 'content-available': 1 } } }
        }));
        
        await admin.messaging().sendEach(messages as any);
    } catch (error) {
        console.error('Error sending family request notification:', error);
    }
}

export async function getFamilyRelationshipStatus(sessionUser: User | null, targetUserId: number): Promise<{ status: 'none' | 'pending_from_me' | 'pending_from_them' | 'approved' }> {
  if (!sessionUser || sessionUser.id === targetUserId) {
    return { status: 'none' };
  }

  try {
    const relationship = await db.getFamilyRelationshipDb(sessionUser.id, targetUserId);
    if (!relationship) {
      return { status: 'none' };
    }

    if (relationship.status === 'approved') {
      return { status: 'approved' };
    }

    if (relationship.status === 'pending') {
      if (relationship.requester_id === sessionUser.id) {
        return { status: 'pending_from_me' };
      } else {
        return { status: 'pending_from_them' };
      }
    }
    
    // 'rejected' status is treated as 'none' for a new request
    return { status: 'none' }; 
  } catch (error) {
    console.error(`Error fetching family relationship status for user ${targetUserId}:`, error);
    return { status: 'none' };
  }
}

export async function sendFamilyRequest(targetUserId: number): Promise<{ success: boolean; error?: string }> {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return { success: false, error: 'You must be logged in to send a request.' };
  }
  if (sessionUser.id === targetUserId) {
    return { success: false, error: 'You cannot add yourself as family.' };
  }

  try {
    const existingRelationship = await db.getFamilyRelationshipDb(sessionUser.id, targetUserId);
    if (existingRelationship && existingRelationship.status !== 'rejected') {
        return { success: false, error: 'A request already exists or you are already family members.' };
    }
    
    await db.sendFamilyRequestDb(sessionUser.id, targetUserId);
    
    // Send notification in the background
    sendFamilyRequestNotification(sessionUser, targetUserId).catch(err => {
        console.error("Background family request notification failed:", err);
    });

    revalidatePath(`/users/${targetUserId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send request.' };
  }
}

export async function cancelFamilyRequest(targetUserId: number): Promise<{ success: boolean; error?: string }> {
    const { user: sessionUser } = await getSession();
    if (!sessionUser) {
        return { success: false, error: 'You must be logged in.' };
    }

    try {
        const relationship = await db.getFamilyRelationshipDb(sessionUser.id, targetUserId);
        if (!relationship || relationship.status !== 'pending' || relationship.requester_id !== sessionUser.id) {
            return { success: false, error: 'No pending request found to cancel.' };
        }
        await db.deleteFamilyRelationshipDb(relationship.id);
        revalidatePath(`/users/${targetUserId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to cancel request.' };
    }
}


export async function respondToFamilyRequest(otherUserId: number, response: 'approve' | 'reject'): Promise<{ success: boolean; error?: string }> {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return { success: false, error: 'You must be logged in.' };
  }

  try {
    const relationship = await db.getFamilyRelationshipDb(sessionUser.id, otherUserId);

    if (!relationship || relationship.status !== 'pending' || relationship.requester_id === sessionUser.id) {
        return { success: false, error: 'No pending request found from this user.' };
    }
    
    if (response === 'approve') {
        await db.updateFamilyRequestStatusDb(relationship.id, 'approved');
    } else {
        // If rejected, we'll just delete the request to allow for a new one in the future.
        await db.deleteFamilyRelationshipDb(relationship.id);
    }
    
    revalidatePath(`/users/${otherUserId}`);
    revalidatePath(`/users/${sessionUser.id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to respond to request.' };
  }
}

export async function getFamilyMembers(userId: number): Promise<FamilyMember[]> {
    try {
        return await db.getFamilyMembersForUserDb(userId);
    } catch (error) {
        console.error(`Error fetching family members for user ${userId}:`, error);
        return [];
    }
}

export async function getPendingFamilyRequests(): Promise<PendingFamilyRequest[]> {
    const { user } = await getSession();
    if (!user) return [];
    try {
        return await db.getPendingFamilyRequestsForUserDb(user.id);
    } catch (error) {
        console.error(`Error fetching pending family requests for user ${user.id}:`, error);
        return [];
    }
}

export async function toggleLocationSharing(targetUserId: number, share: boolean): Promise<{ success: boolean; error?: string }> {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    return { success: false, error: 'You must be logged in.' };
  }
  
  try {
    await db.toggleLocationSharingDb(sessionUser.id, targetUserId, share);
    revalidatePath(`/users/${sessionUser.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error toggling location sharing for user ${targetUserId}:`, error);
    return { success: false, error: 'An unexpected server error occurred.' };
  }
}

export async function getFamilyLocations(): Promise<FamilyMemberLocation[]> {
    const { user } = await getSession();
    if (!user) return [];
    try {
        return await db.getFamilyLocationsForUserDb(user.id);
    } catch (error) {
        console.error(`Error fetching family locations for user ${user.id}:`, error);
        return [];
    }
}


// --- Chat Actions ---

async function sendReactionNotification(reactor: User, message: Message, reaction: string) {
    if (!admin.apps.length || reactor.id === message.sender_id) return;
    try {
        const recipientId = message.sender_id;
        const deviceTokens = await db.getDeviceTokensForUsersDb([recipientId]);
        if (deviceTokens.length === 0) return;
        
        const notificationTitle = `${reactor.name} reacted to your message`;
        const notificationBody = `${reaction} "${message.content.substring(0, 50)}..."`;

        const messages = await Promise.all(deviceTokens.map(async ({ token, user_id }) => {
            const freshToken = await encrypt({ userId: user_id });
            return {
                token: token,
                notification: { title: notificationTitle, body: notificationBody },
                data: { user_auth_token: freshToken },
                android: { priority: 'high' as const, notification: { channelId: 'chat_messages' } },
                apns: { payload: { aps: { 'content-available': 1 } } }
            }
        }));

        await admin.messaging().sendEach(messages as any);
    } catch (error) {
        console.error('Error sending chat reaction notification:', error);
    }
}

export async function startChatAndRedirect(formData: FormData): Promise<void> {
  const { user } = await getSession();
  if (!user) {
    redirect('/login');
    return;
  }
  
  const otherUserIdStr = formData.get('otherUserId');
  if (!otherUserIdStr || typeof otherUserIdStr !== 'string') {
    // Handle error case, maybe redirect back with an error message
    return;
  }
  const otherUserId = parseInt(otherUserIdStr, 10);
  
  if(isNaN(otherUserId) || otherUserId === user.id) {
    // Handle error case
    return;
  }
  
  const conversationId = await db.findOrCreateConversationDb(user.id, otherUserId);
  redirect(`/chat/${conversationId}`);
}

export async function createGroup(groupName: string, memberIds: number[]): Promise<{ success: boolean; error?: string; conversationId?: number }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'You must be logged in.' };
    }
    if (!groupName.trim()) {
        return { success: false, error: 'Group name cannot be empty.' };
    }
    if (memberIds.length === 0) {
        return { success: false, error: 'You must add at least one member to the group.' };
    }
    
    try {
        const allMemberIds = Array.from(new Set([user.id, ...memberIds]));
        const newConversation = await db.createGroupConversationDb(user.id, groupName.trim(), allMemberIds);
        revalidatePath('/chat');
        return { success: true, conversationId: newConversation.id };
    } catch (error: any) {
        return { success: false, error: 'Failed to create group.' };
    }
}

export async function getMessages(conversationId: number): Promise<Message[]> {
    const { user } = await getSession();
    if (!user) return [];
    try {
        return await db.getMessagesForConversationDb(conversationId, user.id);
    } catch (error) {
        console.error(`Error fetching messages for conversation ${conversationId}:`, error);
        return [];
    }
}

export async function sendMessage(conversationId: number, content: string): Promise<{ message?: Message; error?: string }> {
    const { user } = await getSession();
    if (!user) {
        return { error: 'You must be logged in to send a message.' };
    }
    try {
        const newMessage = await db.addMessageDb({ conversationId, senderId: user.id, content });
        // Don't await notification, let it run in background
        sendChatNotification(conversationId, user, content).catch(err => console.error("Chat notification failed:", err));
        revalidatePath(`/chat`);
        revalidatePath(`/chat/${conversationId}`);
        return { message: newMessage };
    } catch (error: any) {
        return { error: 'Failed to send message.' };
    }
}

export async function deleteMessage(messageId: number): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'You must be logged in.' };
    }
    try {
        const wasDeleted = await db.deleteMessageDb(messageId, user.id);
        if (wasDeleted) {
            revalidatePath('/chat'); // Revalidating all chats might be necessary
            return { success: true };
        } else {
            return { success: false, error: 'Message not found or you do not have permission to delete it.' };
        }
    } catch (error: any) {
        return { success: false, error: 'Failed to delete message.' };
    }
}

export async function getConversations(): Promise<Conversation[]> {
    const { user } = await getSession();
    if (!user) return [];
    try {
        return await db.getConversationsForUserDb(user.id);
    } catch (error) {
        console.error(`Error fetching conversations for user ${user.id}:`, error);
        return [];
    }
}

export async function markConversationAsRead(conversationId: number) {
    try {
        const { user } = await getSession();
        if (user) {
            await db.markConversationAsReadDb(conversationId, user.id);
            revalidatePath(`/chat`);
        }
    } catch (error: any) {
        console.error("Server action error marking conversation as read:", error);
    }
}

export async function getUnreadMessageCount(): Promise<number> {
    try {
        const { user } = await getSession();
        if (user) {
            return await db.getTotalUnreadMessagesDb(user.id);
        }
        return 0;
    } catch (error: any) {
        console.error("Server action error getting unread message count:", error);
        return 0;
    }
}

export async function getConversationDetails(conversationId: number): Promise<ConversationDetails | null> {
    try {
        const { user } = await getSession();
        if (user) {
            return await db.getConversationDetailsDb(conversationId, user.id);
        }
        return null;
    } catch (error) {
        console.error("Server action error getting conversation details:", error);
        return null;
    }
}

export async function leaveGroup(conversationId: number): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) return { success: false, error: 'You must be logged in.' };
    try {
        await db.removeParticipantFromGroupDb(conversationId, user.id);
        revalidatePath('/chat');
        redirect('/chat');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to leave group.' };
    }
}

export async function removeMemberFromGroup(conversationId: number, memberId: number): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) return { success: false, error: 'You must be logged in.' };
    try {
        const isAdmin = await db.isUserGroupAdminDb(conversationId, user.id);
        if(!isAdmin) return { success: false, error: 'You are not an admin of this group.' };
        await db.removeParticipantFromGroupDb(conversationId, memberId);
        revalidatePath(`/chat/${conversationId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to remove member.' };
    }
}

export async function addMembersToGroup(conversationId: number, memberIds: number[]): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) return { success: false, error: 'You must be logged in.' };
    try {
        const isAdmin = await db.isUserGroupAdminDb(conversationId, user.id);
        if(!isAdmin) return { success: false, error: 'You are not an admin of this group.' };
        await db.addParticipantsToGroupDb(conversationId, memberIds);
        revalidatePath(`/chat/${conversationId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to add members.' };
    }
}

export async function makeUserGroupAdmin(conversationId: number, memberId: number): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) return { success: false, error: 'You must be logged in.' };
    try {
        const isAdmin = await db.isUserGroupAdminDb(conversationId, user.id);
        if(!isAdmin) return { success: false, error: 'You are not an admin of this group.' };
        await db.makeUserGroupAdminDb(conversationId, memberId);
        revalidatePath(`/chat/${conversationId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to make admin.' };
    }
}

export async function updateGroupAvatar(conversationId: number, imageUrl: string): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) return { success: false, error: 'You must be logged in.' };

  try {
    const isAdmin = await db.isUserGroupAdminDb(conversationId, user.id);
    if (!isAdmin) return { success: false, error: 'You are not an admin of this group.' };
    await db.updateGroupAvatarDb(conversationId, imageUrl);
    revalidatePath(`/chat/${conversationId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Failed to update group avatar.' };
  }
}

export async function toggleMessageReaction(messageId: number, reaction: string): Promise<{ success: boolean; error?: string }> {
    const { user } = await getSession();
    if (!user) return { success: false, error: 'You must be logged in.' };
    try {
        const { wasAdded, message } = await db.toggleMessageReactionDb(messageId, user.id, reaction);
        if (wasAdded && message) {
            // Don't await, run in background
            sendReactionNotification(user, message, reaction).catch(err => console.error("Reaction notification failed:", err));
        }
        revalidatePath('/chat'); // Revalidate all chats for simplicity
        return { success: true };
    } catch (error: any) {
        return { success: false, error: 'Failed to toggle reaction.' };
    }
}

export async function getPointHistory(userId: number): Promise<PointTransaction[]> {
    try {
        return await db.getPointHistoryForUserDb(userId);
    } catch (error) {
        console.error(`Failed to get point history for user ${userId}:`, error);
        return [];
    }
}

export async function getTopLpPointUsers(): Promise<Pick<User, 'id' | 'name' | 'profilepictureurl' | 'lp_points'>[]> {
    try {
        return await db.getTopLpPointUsersDb();
    } catch (error) {
        console.error("Failed to get top LP point users:", error);
        return [];
    }
}

export async function getSignedUploadUrl(fileName: string, fileType: string): Promise<{ success: boolean; uploadUrl?: string; publicUrl?: string; error?: string; }> {
  const gcsClient = getGcsClient();
  const bucketName = getGcsBucketName();

  if (!gcsClient || !bucketName) {
    return { success: false, error: "Cloud Storage is not configured on the server." };
  }

  const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const file = gcsClient.bucket(bucketName).file(`uploads/${cleanFileName}`);

  try {
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType,
    };

    const [url] = await file.getSignedUrl(options);
    const publicUrl = `https://storage.googleapis.com/${bucketName}/uploads/${cleanFileName}`;
    
    return { success: true, uploadUrl: url, publicUrl: publicUrl };
  } catch (error: any) {
    console.error("Failed to get signed URL:", error);
    return { success: false, error: "Could not create an upload URL." };
  }
}

export async function getNearbyBusinesses(options: { page: number; limit: number; latitude: number; longitude: number; category?: string; radiusKm?: number;}): Promise<BusinessUser[]> {
    try {
        return await db.getNearbyBusinessesDb({
            ...options,
            page: options.page || 1,
            limit: options.limit || 10,
        });
    } catch (error) {
        console.error("Error fetching nearby businesses:", error);
        return [];
    }
}

export async function getBusinessesForMap(bounds: { ne: { lat: number, lng: number }, sw: { lat: number, lng: number } }): Promise<BusinessUser[]> {
    try {
        return await db.getBusinessesInBoundsDb(bounds);
    } catch (error) {
        console.error("Error fetching businesses for map:", error);
        return [];
    }
}

export async function getGorakshakReport(adminLat: number, adminLon: number): Promise<GorakshakReportUser[]> {
    try {
        return await db.getGorakshaksSortedByDistanceDb(adminLat, adminLon);
    } catch (error) {
        console.error("Error fetching Gorakshak report:", error);
        return [];
    }
}

export async function sendSosMessage(latitude: number, longitude: number): Promise<{ success: boolean; message?: string; error?: string; }> {
    const { user } = await getSession();
    if (!user) return { success: false, error: "You must be logged in to send an SOS." };
    if (!admin.apps.length) return { success: false, error: "Notification service is not configured." };
    
    try {
        const recipients = await db.getRecipientsForSosDb(user.id);
        if(recipients.length === 0) {
            return { success: false, error: "You are not sharing your location with any family members. No one to notify." };
        }
        
        const recipientIds = recipients.map(r => r.id);
        const deviceTokens = await db.getDeviceTokensForUsersDb(recipientIds);
        
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const sosContent = `🆘 EMERGENCY SOS from ${user.name}! 🆘\n\nTheir current location is: ${mapUrl}`;

        // Send a message to the chat for each recipient
        for (const recipientId of recipientIds) {
            try {
                const conversationId = await db.findOrCreateConversationDb(user.id, recipientId);
                await sendMessage(conversationId, sosContent);
            } catch (chatError) {
                console.error(`Failed to send SOS chat message to user ${recipientId}:`, chatError);
                // Continue to send notifications even if chat fails
            }
        }
        
        if(deviceTokens.length === 0) {
            return { success: true, message: "SOS message sent in chat, but no family members have notifications enabled."};
        }
        
        const messages = await Promise.all(deviceTokens.map(async ({ token, user_id }) => {
            const freshToken = await encrypt({ userId: user_id });
            return {
                token: token,
                notification: {
                    title: `🆘 SOS from ${user.name}!`,
                    body: `Emergency alert! Tap to see their location.`
                },
                data: {
                    user_auth_token: freshToken,
                    type: 'SOS',
                    latitude: String(latitude),
                    longitude: String(longitude),
                    url: mapUrl,
                },
                android: { priority: 'high' as const, notification: { channelId: 'sos_alerts' } },
                apns: { payload: { aps: { 'content-available': 1, sound: 'default' } } }
            }
        }));

        const response = await admin.messaging().sendEach(messages as any);
        return { success: true, message: `SOS sent to ${response.successCount} family member(s).` };

    } catch(error: any) {
        return { success: false, error: "Failed to send SOS due to a server error."};
    }
}

export async function requestLocationUpdate(targetUserId: number): Promise<{ success: boolean; error?: string }> {
    const { user: requester } = await getSession();
    if (!requester || !admin.apps.length) {
        return { success: false, error: "User not logged in or notifications not configured." };
    }
    
    try {
        const targetTokens = await db.getDeviceTokensForUsersDb([targetUserId]);
        if (targetTokens.length === 0) return { success: false, error: "Target user does not have notifications enabled." };

        const messages = await Promise.all(targetTokens.map(async ({ token, user_id }) => {
            const freshToken = await encrypt({ userId: user_id });
            return {
                token: token,
                data: {
                    user_auth_token: freshToken,
                    type: 'REQUEST_LOCATION_UPDATE',
                    requesterName: requester.name
                },
                // No notification payload, this is a silent data-only push
                android: { priority: 'high' as const },
                apns: { payload: { aps: { 'content-available': 1 } } }
            }
        }));

        await admin.messaging().sendEach(messages as any);
        return { success: true };
    } catch (error) {
        console.error("Error requesting location update:", error);
        return { success: false, error: "Failed to send request." };
    }
}

export async function getUnreadFamilyPostCount(): Promise<number> {
    try {
        const { user } = await getSession();
        if (user) {
            return await db.getUnreadFamilyPostCountDb(user.id);
        }
        return 0;
    } catch(error: any) {
        return 0;
    }
}

export async function markFamilyFeedAsRead() {
    try {
        const { user } = await getSession();
        if(user) {
            await db.markFamilyFeedAsReadDb(user.id);
            revalidatePath('/'); // Revalidate to update UI state if needed
        }
    } catch (error: any) {
        console.error("Server action error marking family feed as read:", error);
    }
}

// --- Live Seeding Action ---
export async function triggerLiveSeeding(latitude: number, longitude: number): Promise<void> {
    try {
        const liveSeedingEnabled = await db.getAppSettingDb('live_seeding_enabled');
        if (liveSeedingEnabled !== 'true') {
            return;
        }

        const seedKey = ngeohash.encode(latitude, longitude, 6);
        const lastSeedTime = await db.getLastSeedTimeDb(seedKey);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        const lowContent = (await db.countRecentPostsNearbyDb(latitude, longitude, 12, 6)) < 3;
        
        if (!lastSeedTime || new Date(lastSeedTime) < twoHoursAgo || lowContent) {
            console.log(`[seed] trigger ${seedKey} lat=${latitude} lon=${longitude} lowContent=${lowContent}`);
            
            const result = await seedContent({ latitude, longitude });
            
            if (result.success) {
                await db.updateLastSeedTimeDb(seedKey);
                console.log(`[seed] success ${seedKey} city=${result.cityName} count=${result.postCount}`);
                revalidatePath('/'); // Revalidate after successful seeding
            } else {
                console.error(`[seed] failed ${seedKey}: ${result.message}`);
            }
        }
    } catch (error) {
        console.error('Error in triggerLiveSeeding action:', error);
    }
}

// --- Festival Actions ---
export async function registerMandal(newMandal: NewGanpatiMandal): Promise<{ success: boolean, error?: string }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'You must be logged in to register a mandal.' };
    }

    try {
        await db.registerMandalDb({ ...newMandal, admin_user_id: user.id });
        revalidatePath('/'); // Revalidate the feed to show the new festival tab content
        return { success: true };
    } catch (error: any) {
        console.error('Error registering mandal:', error);
        return { success: false, error: error.message || 'An unexpected server error occurred.' };
    }
}

export async function getMandalsForFeed(userId?: number | null): Promise<GanpatiMandal[]> {
    try {
        return await db.getMandalsDb(userId);
    } catch (error) {
        console.error("Server action error fetching mandals:", error);
        return [];
    }
}

export async function getTopMandal(): Promise<GanpatiMandal | null> {
    try {
        return await db.getTopMandalDb();
    } catch (error) {
        console.error("Server action error fetching top mandal:", error);
        return null;
    }
}

export async function getMandalMediaPosts(mandalId: number): Promise<Post[]> {
  try {
    return await db.getMandalMediaPostsDb(mandalId);
  } catch (error) {
    console.error(`Server action error fetching media posts for mandal ${mandalId}:`, error);
    return [];
  }
}

export async function toggleMandalLike(mandalId: number): Promise<{ mandal?: GanpatiMandal | null; error?: string; }> {
    const { user } = await getSession();
    if (!user) {
        return { error: 'You must be logged in to like a mandal.' };
    }
    
    try {
        const mandal = await db.toggleMandalLikeDb(user.id, mandalId);
        revalidatePath('/'); // Revalidate the feed
        return { mandal };
    } catch (error: any) {
        console.error(`Error toggling like for mandal ${mandalId}:`, error);
        return { error: 'Failed to update like status due to a server error.' };
    }
}

export async function updateMandal(mandalId: number, data: { name: string; city: string; description?: string }): Promise<{ success: boolean, error?: string }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'You must be logged in.' };
    }
    // A proper implementation would also check if the user is the admin of this mandal
    try {
        await db.updateMandalDb(mandalId, data, user.id);
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function sendAartiNotification(mandalId: number): Promise<{ success: boolean; error?: string; sentCount?: number }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'You must be logged in.' };
    }
    if (!admin.apps.length) {
        return { success: false, error: 'Notification service not configured on server.' };
    }
    try {
        const mandal = await db.getMandalByIdDb(mandalId);
        if (!mandal) {
            return { success: false, error: 'Mandal not found.' };
        }
        if (mandal.admin_user_id !== user.id) {
            return { success: false, error: 'You are not the admin of this mandal.' };
        }

        const nearbyTokens = await db.getNearbyDeviceTokensDb(mandal.latitude, mandal.longitude, 1); // 1km radius for Aarti
        if (nearbyTokens.length === 0) {
            return { success: true, sentCount: 0, error: 'No users found within 1km to notify.' };
        }

        const message = {
            notification: {
                title: `Aarti at ${mandal.name}!`,
                body: `🪔 गणपती बाप्पाची आरती सुरू होत आहे, भक्तांनी लवकरात लवकर यावे. 🌺`,
            },
            tokens: nearbyTokens.map(t => t.token),
            android: { priority: 'high' as const, notification: { channelId: 'festival_alerts' } },
            apns: { payload: { aps: { 'content-available': 1, sound: 'default' } } }
        };

        const response = await admin.messaging().sendEachForMulticast(message as any);
        return { success: true, sentCount: response.successCount };

    } catch (error: any) {
        console.error('Error sending Aarti notification:', error);
        return { success: false, error: 'An unexpected server error occurred.' };
    }
}

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'status' | 'created_at' | 'customer_id'>): Promise<{ success: boolean; error?: string; appointment?: Appointment }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'Authentication required.' };
    }
    
    try {
        const newAppointment = await db.createAppointmentDb({ ...appointment, customer_id: user.id });
        return { success: true, appointment: newAppointment };
    } catch (error: any) {
        console.error("Error creating appointment:", error);
        return { success: false, error: error.message };
    }
}
