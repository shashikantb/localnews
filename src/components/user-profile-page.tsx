
import type { FC } from 'react';
import { notFound } from 'next/navigation';
import { getUserWithFollowInfo, getPostsByUserId } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Building, ShieldCheck, Mail, Calendar, User as UserIcon, Edit, UserPlus, UserCheck as UserCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PostCard } from '@/components/post-card';
import type { User } from '@/lib/db-types';
import ProfilePictureUpdater from '@/components/profile-picture-updater';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import FollowButton from '@/components/follow-button';


interface UserProfilePageProps {
  params: {
    userId: string;
  };
}

const UserProfilePage: FC<UserProfilePageProps> = async ({ params }) => {
  const userId = parseInt(params.userId, 10);
  if (isNaN(userId)) {
    notFound();
  }

  // Fetch user, posts, and session in parallel
  const [{ user: profileUser, stats, isFollowing }, userPosts, { user: sessionUser }] = await Promise.all([
    getUserWithFollowInfo(userId),
    getPostsByUserId(userId),
    getSession()
  ]);

  if (!profileUser || profileUser.status !== 'approved') {
    notFound();
  }
  
  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'Business': return <Building className="h-8 w-8 text-primary" />;
      case 'Gorakshak': return <ShieldCheck className="h-8 w-8 text-primary" />;
      default: return <UserIcon className="h-8 w-8 text-primary" />;
    }
  };

  const isOwnProfile = sessionUser?.id === profileUser.id;

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        
        <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 p-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-primary/60 shadow-lg">
                <AvatarImage src={profileUser.profilepictureurl ?? undefined} alt={profileUser.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                  {getRoleIcon(profileUser.role)}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <Dialog>
                    <DialogTrigger asChild>
                       <Button variant="outline" size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-2 border-primary/50 text-primary shadow-md hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100" aria-label="Update Profile Picture">
                          <Edit className="h-4 w-4" />
                       </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Update Profile Picture</DialogTitle>
                            <DialogDescription>
                                Select a new image to use as your avatar. Recommended size is 200x200 pixels.
                            </DialogDescription>
                        </DialogHeader>
                        <ProfilePictureUpdater />
                    </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-4">
                  <h1 className="text-3xl font-bold text-foreground">{profileUser.name}</h1>
                   {!isOwnProfile && (
                     <FollowButton targetUserId={profileUser.id} initialIsFollowing={isFollowing} />
                   )}
              </div>

               <div className="flex items-center justify-center md:justify-start gap-6 pt-2">
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{userPosts.length}</p>
                    <p className="text-sm text-muted-foreground">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{stats.followerCount}</p>
                    <p className="text-sm text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{stats.followingCount}</p>
                    <p className="text-sm text-muted-foreground">Following</p>
                  </div>
              </div>
              
              <Badge variant={profileUser.role === 'Business' ? 'secondary' : 'default'} className="capitalize">
                {profileUser.role}
              </Badge>
              <p className="text-sm text-muted-foreground pt-1 flex items-center justify-center md:justify-start gap-2">
                <Mail className="w-4 h-4" /> {profileUser.email}
              </p>
               <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                <Calendar className="w-3 h-3"/> Joined: {new Date(profileUser.createdat).toLocaleDateString()}
               </p>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-primary pl-1 border-b-2 border-primary/30 pb-2">
                Posts by {profileUser.name}
            </h2>
            {userPosts.length > 0 ? (
                userPosts.map(post => (
                    <PostCard 
                        key={post.id} 
                        post={post} 
                        userLocation={null} // Can't get viewing user's location on server for distance calc
                        sessionUser={sessionUser} 
                    />
                ))
            ) : (
                <Card className="text-center py-12 rounded-xl shadow-lg border border-border/40 bg-card/80 backdrop-blur-sm">
                    <CardContent>
                        <p className="text-lg text-muted-foreground">This user hasn't pulsed anything yet.</p>
                    </CardContent>
                </Card>
            )}
        </div>

      </div>
    </main>
  );
};

export default UserProfilePage;
