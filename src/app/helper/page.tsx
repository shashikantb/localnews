

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { localHelper } from '@/ai/flows/local--helper-flow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Send, Bot, User, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function HelperPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if(position.coords.latitude === 0 && position.coords.longitude === 0) {
              setLocationError("Could not get a valid location. Please ensure location services are enabled and accurate.");
              return;
          }
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError("Could not get your location. The Local Helper needs your location to work correctly. Please enable it in your browser settings.");
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!location || locationError) {
      toast({
        variant: 'destructive',
        title: 'Location Required',
        description: locationError || "We're still trying to determine your location. Please wait a moment and try again.",
      });
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await localHelper({
        query: input,
        latitude: location.latitude,
        longitude: location.longitude,
      });

      const assistantMessage: Message = { role: 'assistant', content: response };
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error: any) {
        console.error('Error calling local search:', error);
        let errorMessage = "Sorry, the helper ran into an unexpected problem. Please try again in a moment.";
        setMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'The helper is currently unavailable.',
        });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-2xl h-[calc(100vh_-_var(--header-height,8.5rem)_-_2rem)] flex flex-col shadow-xl">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-3 text-primary">
            <Sparkles className="w-7 h-7" />
            Local Helper
          </CardTitle>
          <CardDescription>
            Ask me to find businesses or check for the latest local posts.
          </CardDescription>
        </CardHeader>
        
        {/* Input Form Area */}
        <div className="p-4 border-b">
            <form onSubmit={handleSubmit} className="flex gap-3">
            <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 resize-none"
                rows={1}
                disabled={isLoading || !!locationError}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                    }
                }}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim() || !!locationError}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
                <span className="sr-only">Send</span>
            </Button>
            </form>
            {locationError && (
                <div className="mt-3 p-2 text-center bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {locationError}
                </div>
            )}
        </div>

        {/* Message List Area */}
        <CardContent className="flex-grow p-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
            <div className="space-y-6">
                {messages.length === 0 && (
                    <div className="text-center text-muted-foreground pt-12">
                        <Bot className="mx-auto h-12 w-12 mb-4" />
                        <p className="font-semibold">Ask me something!</p>
                        <p className="text-sm">e.g., "Find a restaurant" or "latest pulse".</p>
                    </div>
                )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <Avatar className="h-9 w-9 border-2 border-primary/50">
                      <AvatarFallback className="bg-primary/10 text-primary"><Sparkles className="w-5 h-5"/></AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-sm rounded-2xl p-3 ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted text-foreground rounded-bl-none'}`}>
                    <Markdown className="prose prose-sm dark:prose-invert max-w-none">{m.content}</Markdown>
                  </div>
                   {m.role === 'user' && (
                    <Avatar className="h-9 w-9 border-2 border-muted-foreground/50">
                        <AvatarFallback><User className="w-5 h-5"/></AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="h-9 w-9 border-2 border-primary/50">
                       <AvatarFallback className="bg-primary/10 text-primary"><Loader2 className="w-5 h-5 animate-spin"/></AvatarFallback>
                    </Avatar>
                    <div className="bg-muted p-3 rounded-2xl rounded-bl-none">
                        <p className="text-sm italic text-muted-foreground">Searching...</p>
                    </div>
                  </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
