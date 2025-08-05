
'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Message, User, ConversationDetails, MessageReaction, ConversationParticipant } from '@/lib/db-types';
import { getMessages, sendMessage, deleteMessage, toggleMessageReaction, searchGroupMembers } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Users, MoreHorizontal, Trash2, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ChatInfoSidebar from './chat-info-sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatClientProps {
  initialMessages: Message[];
  conversationDetails: ConversationDetails;
  sessionUser: User;
  conversationId: number;
}

const POLLING_INTERVAL = 1500; // 1.5 seconds

// Helper function to escape special characters for regex
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

const ReactionsDisplay = ({ reactions, onReactionClick }: { reactions: MessageReaction[]; onReactionClick: (reaction: string) => void }) => {
    if (!reactions || reactions.length === 0) return null;

    const groupedReactions = reactions.reduce((acc, reaction) => {
        acc[reaction.reaction] = (acc[reaction.reaction] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
                <button
                    key={emoji}
                    onClick={() => onReactionClick(emoji)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-foreground text-xs border border-transparent hover:border-primary transition-colors"
                >
                    <span>{emoji}</span>
                    <span className="font-medium">{count}</span>
                </button>
            ))}
        </div>
    );
};


export default function ChatClient({ initialMessages, conversationDetails, sessionUser, conversationId }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<ConversationParticipant[]>([]);
  
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;
  
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const partner = !conversationDetails.is_group ? conversationDetails.participants?.find(p => p.id !== sessionUser.id) : null;
  
  const renderChatMessageContent = (content: string) => {
    if (!content) return null;

    const participantNames = conversationDetails.participants.map(p => escapeRegExp(`@${p.name}`));
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const mentionRegex = participantNames.length > 0 ? new RegExp(`(${participantNames.join('|')})\\b`, 'g') : null;

    const allMatches: { type: 'url' | 'mention', text: string, index: number }[] = [];

    // Find all URL matches
    for (const match of content.matchAll(urlRegex)) {
        allMatches.push({ type: 'url', text: match[0], index: match.index! });
    }
    // Find all mention matches
    if (mentionRegex) {
        for (const match of content.matchAll(mentionRegex)) {
            allMatches.push({ type: 'mention', text: match[0], index: match.index! });
        }
    }

    // Sort matches by their index
    allMatches.sort((a, b) => a.index - b.index);

    if (allMatches.length === 0) {
        return content;
    }

    const result: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    allMatches.forEach(match => {
        // Add text before the match
        if (match.index > lastIndex) {
            result.push(content.substring(lastIndex, match.index));
        }

        // Add the styled match
        if (match.type === 'url') {
            const href = match.text.startsWith('www.') ? `https://` + match.text : match.text;
            result.push(
                <a
                    key={`link-${match.index}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                >
                    {match.text}
                </a>
            );
        } else if (match.type === 'mention') {
            result.push(
                <span key={`mention-${match.index}`} className="text-accent font-semibold bg-accent/10 rounded px-1 py-0.5">
                    {match.text}
                </span>
            );
        }
        lastIndex = match.index + match.text.length;
    });

    // Add any remaining text after the last match
    if (lastIndex < content.length) {
        result.push(content.substring(lastIndex));
    }

    return result.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
  };


  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
        if (isSendingRef.current) {
            return;
        }
        try {
            const newMessages = await getMessages(conversationId);
            if (isMounted && JSON.stringify(messagesRef.current) !== JSON.stringify(newMessages)) {
                setMessages(newMessages);
            }
        } catch (error) {
            console.error("Failed to fetch new messages:", error);
        }
    };
    
    const intervalId = setInterval(fetchMessages, POLLING_INTERVAL);

    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };
  }, [conversationId]);
  
  useEffect(() => {
    if (showMentionSuggestions && mentionQuery) {
        searchGroupMembers(mentionQuery, conversationId).then(setMentionResults);
    } else {
        setMentionResults([]);
    }
  }, [mentionQuery, showMentionSuggestions, conversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);

    const result = await sendMessage(conversationId, newMessage.trim());
    
    if (result.error || !result.message) {
      console.error('Failed to send message:', result.error);
      toast({
        variant: 'destructive',
        title: 'Message Not Sent',
        description: result.error || 'Could not send the message. Please try again.',
      });
    } else {
      setMessages(prev => [result.message!, ...prev]);
      setNewMessage('');
    }
    
    setIsSending(false);
  };
  
  const handleDeleteMessage = async (messageId: number) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));

    const result = await deleteMessage(messageId);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: result.error || 'Message could not be deleted. It may have already been removed.',
      });
      getMessages(conversationId).then(setMessages);
    }
  };

  const handleReaction = async (messageId: number, emoji: string) => {
    // Optimistic update
    setMessages(prevMessages => prevMessages.map(msg => {
        if (msg.id !== messageId) return msg;

        const existingReactionIndex = msg.reactions?.findIndex(r => r.user_id === sessionUser.id);
        
        let newReactions = [...(msg.reactions || [])];

        if (existingReactionIndex !== -1) {
            if (newReactions[existingReactionIndex].reaction === emoji) {
                newReactions.splice(existingReactionIndex, 1);
            } else {
                newReactions[existingReactionIndex] = { ...newReactions[existingReactionIndex], reaction: emoji };
            }
        } else {
            newReactions.push({ id: -1, message_id: messageId, user_id: sessionUser.id, reaction: emoji, user_name: sessionUser.name });
        }
        
        return { ...msg, reactions: newReactions };
    }));
    
    const { success, error } = await toggleMessageReaction(messageId, emoji);
    if (!success) {
        toast({ variant: 'destructive', title: 'Reaction failed', description: error });
        getMessages(conversationId).then(setMessages);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    const mentionMatch = text.match(/@([\w\s]*)$/);
    if (mentionMatch) {
      setShowMentionSuggestions(true);
      setMentionQuery(mentionMatch[1]);
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleSelectMention = (username: string) => {
    setNewMessage(prev => prev.replace(/@[\w\s]*$/, `@${username} `));
    setShowMentionSuggestions(false);
    setMentionResults([]);
  };


  const headerContent = (
      <div className="flex items-center gap-3 hover:bg-muted p-2 rounded-md">
        <Avatar>
            <AvatarImage src={conversationDetails.display_avatar_url || undefined} alt={conversationDetails.display_name} />
            <AvatarFallback>{conversationDetails.is_group ? <Users /> : conversationDetails.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold">{conversationDetails.display_name}</h2>
          {conversationDetails.is_group && (
              <p className="text-xs text-muted-foreground">{conversationDetails.participants.length} members</p>
          )}
        </div>
      </div>
  );

  return (
    <div className="flex flex-col bg-background h-full">
        <header className="flex-shrink-0 flex items-center p-3 border-b bg-card">
            {conversationDetails.is_group ? (
                <Sheet>
                    <SheetTrigger asChild>
                        <button className="w-full">{headerContent}</button>
                    </SheetTrigger>
                    <SheetContent className="w-[300px] sm:w-[400px] p-0" side="left">
                        <ChatInfoSidebar conversationId={conversationId} />
                    </SheetContent>
                </Sheet>
            ) : (
                <Link href={partner ? `/users/${partner.id}` : '#'}>
                    {headerContent}
                </Link>
            )}
        </header>

        {/* Message Input Form */}
        <div className="p-4 border-b relative">
            {showMentionSuggestions && mentionResults.length > 0 && (
                <div className="absolute bottom-full left-4 mb-1 w-3/4 max-w-sm bg-background border rounded-lg shadow-lg z-10">
                    <ScrollArea className="max-h-40">
                        {mentionResults.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleSelectMention(user.name)}
                                className="flex items-center gap-2 p-2 w-full text-left hover:bg-muted"
                            >
                                <Avatar className="h-7 w-7"><AvatarImage src={user.profilepictureurl || undefined}/><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                <span className="text-sm font-medium">{user.name}</span>
                            </button>
                        ))}
                    </ScrollArea>
                </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <Textarea
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message... (use @ to mention)"
                className="flex-1 resize-none bg-card border"
                rows={1}
                disabled={isSending}
                onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                }
                }}
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
                {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                <span className="sr-only">Send</span>
            </Button>
            </form>
        </div>
        
        {/* Message List Area */}
        <ScrollArea className="flex-grow p-4">
            <div className="flex flex-col-reverse">
                {messages.map((message) => {
                    const isSender = message.sender_id === sessionUser.id;
                    const senderDetails = conversationDetails.participants.find(p => p.id === message.sender_id);

                    return (
                    <div
                        key={message.id}
                        className={cn(
                            'flex items-end gap-2 my-2 group',
                            isSender ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {!isSender && (
                        <Avatar className="h-8 w-8 self-start">
                            <AvatarImage src={senderDetails?.profilepictureurl || undefined} />
                            <AvatarFallback>{senderDetails?.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        )}
                        <div className="flex flex-col" style={{ alignItems: isSender ? 'flex-end' : 'flex-start' }}>
                            <div
                                className={cn(
                                    'relative max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl flex flex-col',
                                    isSender
                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                    : 'bg-muted text-foreground rounded-bl-none'
                                )}
                            >
                                {!isSender && conversationDetails.is_group && (
                                <p className="text-xs font-semibold text-accent mb-1">{senderDetails?.name}</p>
                                )}
                                <div className="text-sm whitespace-pre-wrap break-words">{renderChatMessageContent(message.content)}</div>
                                <span className={cn('text-xs mt-1.5 opacity-70', isSender ? 'self-end' : 'self-start')}>
                                    {format(new Date(message.created_at), 'p')}
                                </span>
                                <div className={cn("absolute bottom-[-8px] z-10 opacity-0 group-hover:opacity-100 transition-opacity", isSender ? 'left-[-12px]' : 'right-[-12px]')}>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background border shadow-sm">
                                                <Smile className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 border-0">
                                            <EmojiPicker
                                                onEmojiClick={(emojiData) => handleReaction(message.id, emojiData.emoji)}
                                                theme={theme === 'dark' ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <ReactionsDisplay reactions={message.reactions || []} onReactionClick={(emoji) => handleReaction(message.id, emoji)} />
                        </div>

                        {isSender && (
                            <DropdownMenu>
                                <AlertDialog>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your message.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteMessage(message.id)}>
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenu>
                        )}
                    </div>
                    );
                })}
            </div>
        </ScrollArea>
    </div>
  );
}
