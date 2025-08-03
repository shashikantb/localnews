
import type { FC } from 'react';
import { notFound } from 'next/navigation';
import { getMandalByIdDb, getMandalMediaPostsDb } from '@/lib/db';
import { getSession } from '@/app/auth/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PartyPopper, MapPin, ThumbsUp, GalleryVertical } from 'lucide-react';
import MandalMediaViewer from '@/components/mandal-media-viewer';

interface MandalPageProps {
  params: {
    mandalId: string;
  };
}

const MandalPage: FC<MandalPageProps> = async ({ params }) => {
  const mandalId = parseInt(params.mandalId, 10);
  if (isNaN(mandalId)) {
    notFound();
  }

  const { user: sessionUser } = await getSession();

  const [mandal, mediaPosts] = await Promise.all([
    getMandalByIdDb(mandalId, sessionUser?.id),
    getMandalMediaPostsDb(mandalId),
  ]);

  if (!mandal) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background to-muted/30 min-h-[calc(100svh_-_var(--header-height,8.5rem))]">
      <div className="container mx-auto max-w-2xl space-y-6 py-8">
        <Card className="shadow-xl border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl font-bold text-primary">
              <PartyPopper className="w-8 h-8 text-accent" />
              {mandal.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 pt-2">
              <MapPin className="w-4 h-4" />
              {mandal.city}
            </CardDescription>
             <div className="flex items-center gap-2 pt-2 text-muted-foreground">
                <ThumbsUp className="w-4 h-4" />
                <span>{mandal.likecount} {mandal.likecount === 1 ? 'Like' : 'Likes'}</span>
            </div>
            {mandal.description && (
                <p className="text-sm text-foreground/80 pt-2">{mandal.description}</p>
            )}
          </CardHeader>
        </Card>
        
        <Card className="shadow-xl border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <GalleryVertical className="w-5 h-5 text-primary"/>
                    Gallery
                </CardTitle>
                <CardDescription>
                    Photos and videos from the mandal.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <MandalMediaViewer posts={mediaPosts} />
            </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default MandalPage;
