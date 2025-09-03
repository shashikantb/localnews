
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getConversations, searchUsers, startChatAndRedirect } from '@/app/actions';
import type { Conversation, User } from '@/lib/db-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Skeleton } from './ui/skeleton';
import { Input } from './ui/input';
import { Search, Loader2, Users } from 'lucide-react';
import CreateGroupDialog from './create-group-dialog';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSession } from '@/app/auth/actions';

const POLLING_INTERVAL = 15000; // 15 seconds
const CACHE_KEY = 'localpulse-chat-cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedChats {
  timestamp: number;
  conversations: Conversation[];
}

const ConversationItem = ({ conv, sessionUser }: { conv: Conversation, sessionUser: User | null }) => {
    const pathname = usePathname();
    const isActive = pathname === `/chat/${conv.id}`;
    const showUnread = conv.unread_count > 0 && !isActive;

    let lastMessageText = conv.last_message_content || 'No messages yet.';
    if (conv.is_group && conv.last_message_sender_id !== sessionUser?.id && conv.last_message_sender_name) {
        lastMessageText = `${conv.last_message_sender_name}: ${lastMessageText}`;
    }

    return (
        <Link
            href={`/chat/${conv.id}`}
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted",
                isActive ? "bg-primary/10" : ""
            )}
        >
            <Avatar className="h-12 w-12 border-2"
             style={{ borderColor: isActive ? 'hsl(var(--primary))' : 'transparent' }}
            >
                <AvatarImage src={conv.display_avatar_url || undefined} alt={conv.display_name} />
                <AvatarFallback>{conv.display_name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <p className={cn("font-semibold truncate", showUnread ? "text-primary" : "")}>
                        {conv.display_name}
                    </p>
                    {conv.last_message_at && (
                        <p className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDistanceToNowStrict(new Date(conv.last_message_at), { addSuffix: true })}
                        </p>
                    )}
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    <p className={cn("text-sm text-muted-foreground truncate", showUnread ? "font-bold text-foreground" : "")}>
                        {lastMessageText}
                    </p>
                    {showUnread && (
                        <span className="flex-shrink-0 ml-2 h-5 w-5 bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center rounded-full">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
};


const ChatSidebar = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [sessionUser, setSessionUser] = useState<User | null>(null);
    const { toast } = useToast();

    const fetchAndSetConversations = useCallback(async () => {
        try {
            const convos = await getConversations();
            setConversations(convos);
            
            // Update cache with fresh data
            const cacheData: CachedChats = {
                timestamp: Date.now(),
                conversations: convos,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        } catch (error) {
            console.error("Failed to fetch conversations:", error);
            toast({ variant: 'destructive', title: 'Could not load chats.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    // Initial load effect
    useEffect(() => {
        let isMounted = true;

        getSession().then(session => {
            if(isMounted) setSessionUser(session.user);
        });
        
        // Load from cache first
        try {
            const cachedItem = localStorage.getItem(CACHE_KEY);
            if(cachedItem) {
                const cachedData: CachedChats = JSON.parse(cachedItem);
                if(isMounted) {
                    setConversations(cachedData.conversations);
                    setIsLoading(false); // We have something to show
                }
                
                // Revalidate if cache is stale
                if(Date.now() - cachedData.timestamp > CACHE_EXPIRY_MS) {
                    fetchAndSetConversations();
                }
            } else {
                // No cache, fetch from server
                fetchAndSetConversations();
            }
        } catch(error) {
            console.warn("Failed to load chats from cache.", error);
            fetchAndSetConversations();
        }

        return () => { isMounted = false; };
    }, [fetchAndSetConversations]);

    // Polling effect
    useEffect(() => {
        const intervalId = setInterval(fetchAndSetConversations, POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, [fetchAndSetConversations]);


    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const users = await searchUsers(searchQuery);
                setSearchResults(users);
            } catch (error) {
                console.error("Failed to search users:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(handler);
    }, [searchQuery]);

    return (
        <div className="flex flex-col h-full bg-card">
            <div className="p-4 border-b flex items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-primary flex-shrink-0 truncate">Chats</h1>
                <div className="flex-1" />
                <CreateGroupDialog>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <Users className="h-5 w-5" />
                        <span className="sr-only">Create Group</span>
                    </Button>
                </CreateGroupDialog>
            </div>
            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search people to start a chat..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                {searchQuery ? (
                    <div className="p-2">
                        {isSearching ? (
                            <div className="p-4 text-center text-muted-foreground flex items-center justify-center">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
                            </div>
                        ) : searchResults.length > 0 ? (
                            searchResults.map(user => (
                                <form action={startChatAndRedirect} key={user.id}>
                                    <input type="hidden" name="otherUserId" value={user.id} />
                                    <button type="submit" className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted">
                                        <Avatar className="h-10 w-10 border-2">
                                            <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-semibold truncate">{user.name}</p>
                                        </div>
                                    </button>
                                </form>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">No users found.</div>
                        )}
                    </div>
                ) : (
                    <>
                        {isLoading ? (
                            <div className="p-4 space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex items-center space-x-3">
                                        <Skeleton className="h-12 w-12 rounded-full" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : conversations.length > 0 ? (
                            <div className="p-2 space-y-1">
                                {conversations.map(conv => (
                                    <ConversationItem key={conv.id} conv={conv} sessionUser={sessionUser} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                <p>No recent conversations.</p>
                                <p className="text-sm">Use the search bar above to find someone and start a chat.</p>
                            </div>
                        )}
                    </>
                )}
            </ScrollArea>
        </div>
    );
};

export default ChatSidebar;
