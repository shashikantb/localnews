

import type { FC } from 'react';
import { notFound } from 'next/navigation';
import { getPostsByUserId, getFamilyMembers, getPendingFamilyRequests, getFamilyRelationshipStatus, getUserWithFollowInfo, startChatAndRedirect } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, ShieldCheck, Mail, Calendar, User as UserIcon, Edit, MessageSquare, Settings, Users, Briefcase, Phone, FileBarChart, Copy, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { PostCard } from '@/components/post-card';
import type { User, FamilyMember, UserRole } from '@/lib/db-types';
import ProfilePictureUpdater from '@/components/profile-picture-updater';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import FollowButton from '@/components/follow-button';
import UsernameEditor from '@/components/username-editor';
import FollowingListDialog from '@/components/following-list-dialog';
import LogoutButton from '@/components/logout-button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import BajrangDalIdCard from '@/components/bajrang-dal-id-card';
import UpdateMobileForm from '@/components/update-mobile-form';
import FamilyActionButton from '@/components/family-action-button';
import FamilyMembersCard from '@/components/family-members-card';
import FamilyRequestsList from '@/components/family-requests-list';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import DeleteAccountButton from '@/components/delete-account-button';
import { Separator } from '@/components/ui/separator';
import UpdateUserDetailsModal from '@/components/update-user-details-modal';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  // Fetch session first to determine if this is the user's own profile
  const { user: sessionUser } = await getSession();
  const isOwnProfile = sessionUser?.id === userId;

  // Fetch all other data in parallel
  const [
    { user: profileUser, stats, isFollowing },
    userPosts,
    familyMembers,
    pendingRequests,
    familyStatusResult
  ] = await Promise.all([
    getUserWithFollowInfo(userId),
    getPostsByUserId(userId),
    // Only fetch family members and requests if it's the user's own profile
    isOwnProfile ? getFamilyMembers(userId) : Promise.resolve([] as FamilyMember[]),
    isOwnProfile ? getPendingFamilyRequests() : Promise.resolve([]),
    // Pass sessionUser directly to the action to ensure correct authentication context
    getFamilyRelationshipStatus(sessionUser, userId)
  ]);

  if (!profileUser || profileUser.status !== 'approved') {
    notFound();
  }

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'Business': return <Building className="h-8 w-8 text-primary" />;
      case 'Gorakshak': return <ShieldCheck className="h-8 w-8 text-primary" />;
      case 'Gorakshak Admin': return <ShieldCheck className="h-8 w-8 text-primary" />;
      default: return <UserIcon className="h-8 w-8 text-primary" />;
    }
  };

  const isFamily = familyStatusResult.status === 'approved';
  const showContactInfo = isOwnProfile || isFamily;

  const isGorakshak = profileUser.role === 'Gorakshak' || profileUser.role === 'Gorakshak Admin';
  const isBusiness = profileUser.role === 'Business';

  const needsProfileUpdate = isOwnProfile && (!sessionUser?.mobilenumber || (sessionUser?.role === 'Business' && !sessionUser?.business_category));


  return (
    <div className="flex flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl space-y-8 py-8 mb-20">

        {isOwnProfile && <UpdateUserDetailsModal user={sessionUser!} />}

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
                       <Button variant="outline" size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-2 border-primary/50 text-primary shadow-md hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100">
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold text-foreground">{profileUser.name}</h1>
                    {isOwnProfile && (
                        <UsernameEditor currentName={profileUser.name}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit name</span>
                            </Button>
                        </UsernameEditor>
                    )}
                  </div>
                   {isOwnProfile ? (
                      <LogoutButton />
                   ) : (
                      <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
                        <FollowButton targetUserId={profileUser.id} initialIsFollowing={isFollowing} />
                        {sessionUser && (
                            <form action={startChatAndRedirect}>
                                <input type="hidden" name="otherUserId" value={profileUser.id} />
                                <Button type="submit" variant="outline" size="sm">
                                    <MessageSquare className="mr-2 h-4 w-4" /> Message
                                </Button>
                            </form>
                        )}
                        {sessionUser && !isOwnProfile && (
                          <FamilyActionButton
                            initialStatus={familyStatusResult.status}
                            targetUserId={profileUser.id}
                          />
                        )}
                      </div>
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
                  <FollowingListDialog userId={profileUser.id}>
                    <div className="text-center cursor-pointer rounded-md p-1 hover:bg-muted">
                        <p className="text-xl font-bold text-foreground">{stats.followingCount}</p>
                        <p className="text-sm text-muted-foreground">Following</p>
                    </div>
                  </FollowingListDialog>
                  <div className="text-center">
                    <p className="text-xl font-bold text-primary flex items-center justify-center gap-1">
                      <Award className="h-5 w-5"/>
                      {profileUser.lp_points}
                    </p>
                    <p className="text-sm text-muted-foreground">LP Points</p>
                  </div>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1">
                <Badge variant={profileUser.role === 'Business' ? 'secondary' : 'default'} className="capitalize">
                    {profileUser.role}
                </Badge>
                {showContactInfo && (
                    <p className="text-sm text-muted-foreground pt-1 flex items-center justify-center md:justify-start gap-2">
                        <Mail className="w-4 h-4" /> {profileUser.email}
                    </p>
                )}
              </div>
              
              {showContactInfo && profileUser.mobilenumber &&
                  <p className="text-sm text-muted-foreground pt-1 flex items-center justify-center md:justify-start gap-2">
                      <Phone className="w-4 h-4" /> {profileUser.mobilenumber}
                  </p>
              }

              {isBusiness && profileUser.business_category &&
                <p className="text-sm text-muted-foreground pt-1 flex items-center justify-center md:justify-start gap-2">
                    <Briefcase className="w-4 h-4" /> {profileUser.business_category === 'Any Other' ? profileUser.business_other_category : profileUser.business_category}
                </p>
              }
               <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                <Calendar className="w-3 h-3"/> Joined: {new Date(profileUser.createdat).toLocaleDateString()}
               </p>
            </div>
          </CardHeader>
          
          {isOwnProfile && (
            <CardContent className="p-4 pt-2 border-t">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium text-primary">Your Referral Code:</p>
                <div className="flex items-center gap-2 p-1.5 pl-3 rounded-md bg-background border shadow-sm">
                  <span className="text-base font-bold tracking-wider text-foreground">{profileUser.referral_code}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                                navigator.clipboard.writeText(profileUser.referral_code);
                            }}
                         >
                           <Copy className="h-4 w-4" />
                         </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy Code</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          )}

        </Card>

        {isOwnProfile && pendingRequests.length > 0 && (
          <FamilyRequestsList initialRequests={pendingRequests} />
        )}

        {isOwnProfile && familyMembers.length > 0 && (
          <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm p-0">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="family-members" className="border-b-0">
                <AccordionTrigger className="p-6 hover:no-underline">
                   <div className="flex items-center">
                        <Users className="w-6 h-6 mr-3 text-primary" />
                        <div className="text-left">
                            <h2 className="text-lg font-semibold leading-none tracking-tight">Family Members</h2>
                            <p className="text-sm text-muted-foreground pt-1">Manage location sharing with your family.</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-0">
                  <FamilyMembersCard familyMembers={familyMembers} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        )}

        {isOwnProfile && isGorakshak && (
          <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>बजरंग दल ID Card</CardTitle>
              <CardDescription>
                {profileUser.mobilenumber ? 'Your digital ID card. You can download it as an image.' : 'Please provide your mobile number to generate your ID card.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profileUser.mobilenumber ? (
                <BajrangDalIdCard user={profileUser} />
              ) : (
                <UpdateMobileForm userRole={profileUser.role} />
              )}
            </CardContent>
          </Card>
        )}

        {isOwnProfile && profileUser.role === 'Gorakshak Admin' && (
            <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <FileBarChart className="mr-3 h-6 w-6 text-primary" />
                        Admin Reports
                    </CardTitle>
                    <CardDescription>
                        Access special reports available for your role.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/reports/gorakshaks">View Gorakshak Report</Link>
                    </Button>
                </CardContent>
            </Card>
        )}

        {isOwnProfile && (
           <Card className="shadow-xl border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm p-0">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="settings" className="border-b-0">
                <AccordionTrigger className="p-6 hover:no-underline">
                   <div className="flex items-center">
                        <Settings className="w-6 h-6 mr-3 text-primary" />
                        <div className="text-left">
                            <h2 className="text-lg font-semibold leading-none tracking-tight">Settings</h2>
                            <p className="text-sm text-muted-foreground pt-1">Manage theme and account settings.</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-0">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base">Theme</Label>
                      <ThemeSwitcher />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-base text-destructive">Danger Zone</Label>
                      <DeleteAccountButton />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        )}

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
    </div>
  );
};

export default UserProfilePage;
