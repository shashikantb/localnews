
import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, PlusCircle, Search } from 'lucide-react';
import { getAdminPosts } from '@/app/actions';
import PostActions from '@/components/admin/post-actions';
import CreateAnnouncementDialog from './create-announcement-dialog';

export const dynamic = 'force-dynamic';

const AdminManagePostsPage: FC = async () => {
  const posts = await getAdminPosts({ page: 1, limit: 100 }); // Fetch posts for admin view

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Manage Posts</h1>
          <p className="text-lg text-muted-foreground">View, edit, or delete user posts.</p>
        </div>
        <CreateAnnouncementDialog>
            <Button>
              <PlusCircle className="mr-2 h-5 w-5" />
              Create Announcement
            </Button>
        </CreateAnnouncementDialog>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>A list of all posts on the platform.</CardDescription>
          <div className="pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search posts by content, author, city..." className="pl-10 w-full md:w-1/2 lg:w-1/3" disabled/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3 font-semibold">ID</th>
                  <th className="p-3 font-semibold">Content Snippet</th>
                  <th className="p-3 font-semibold">Author</th>
                  <th className="p-3 font-semibold">City</th>
                  <th className="p-3 font-semibold">Likes</th>
                  <th className="p-3 font-semibold">Created At</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{post.id}</td>
                    <td className="p-3 max-w-xs truncate">{post.content}</td>
                    <td className="p-3">{post.authorname || 'Anonymous'}</td>
                    <td className="p-3">{post.city || 'N/A'}</td>
                    <td className="p-3">{post.likecount}</td>
                    <td className="p-3">{new Date(post.createdat).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                        <PostActions post={post} />
                    </td>
                  </tr>
                ))}
                 {posts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-2" />
                      No posts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Placeholder for Pagination */}
          <div className="flex justify-end mt-6">
            <Button variant="outline" size="sm" className="mr-2" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManagePostsPage;
