
import { getTopMandal } from '@/app/actions';
import { PartyPopper, ThumbsUp } from 'lucide-react';
import Link from 'next/link';

export default async function TopMandalMarquee() {
  const topMandal = await getTopMandal();

  if (!topMandal) {
    return null; // Don't render anything if there are no mandals
  }

  return (
    <div className="relative flex overflow-x-hidden group rounded-lg border bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 p-2 border-cyan-500/30 shadow-inner">
      <Link href={`/`} className="flex animate-marquee whitespace-nowrap items-center text-sm font-medium text-cyan-800 dark:text-cyan-300">
        <PartyPopper className="h-5 w-5 mx-3 text-blue-500 flex-shrink-0" />
        <span className="font-bold">#1 Top Mandal:</span>
        <span className="mx-2 text-foreground">{topMandal.name} ({topMandal.city})</span>
        <ThumbsUp className="h-4 w-4 text-primary" />
        <span className="font-bold text-primary ml-1">{topMandal.likecount} Likes</span>
      </Link>
      <Link href={`/`} className="absolute top-0 flex animate-marquee2 whitespace-nowrap items-center h-full text-sm font-medium text-cyan-800 dark:text-cyan-300 p-2">
        <PartyPopper className="h-5 w-5 mx-3 text-blue-500 flex-shrink-0" />
        <span className="font-bold">#1 Top Mandal:</span>
        <span className="mx-2 text-foreground">{topMandal.name} ({topMandal.city})</span>
        <ThumbsUp className="h-4 w-4 text-primary" />
        <span className="font-bold text-primary ml-1">{topMandal.likecount} Likes</span>
      </Link>
    </div>
  );
}
