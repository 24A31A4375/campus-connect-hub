import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Megaphone, Globe, Building, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_global: boolean;
  created_at: string;
  profiles: { full_name: string } | null;
  departments: { name: string } | null;
}

const Announcements: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    isGlobal: false,
  });

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          profiles:author_id(full_name),
          departments:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAnnouncements(data as any);
      }
      setLoading(false);
    };

    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase.from('announcements').insert({
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        author_id: profile?.id,
        department_id: newAnnouncement.isGlobal ? null : profile?.department_id,
        is_global: newAnnouncement.isGlobal,
      });

      if (error) throw error;

      toast({
        title: 'Announcement Posted',
        description: 'Your announcement has been published successfully.',
      });

      setDialogOpen(false);
      setNewAnnouncement({ title: '', content: '', isGlobal: false });

      // Refresh announcements
      const { data } = await supabase
        .from('announcements')
        .select(`
          *,
          profiles:author_id(full_name),
          departments:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (data) setAnnouncements(data as any);
    } catch (error: any) {
      toast({
        title: 'Failed to Post',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const canCreateAnnouncement = profile?.role === 'faculty' || profile?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="mt-1 text-muted-foreground">
              Stay updated with the latest news and notices
            </p>
          </div>
          {canCreateAnnouncement && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                  <DialogDescription>
                    Post a new announcement for students and staff
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Announcement title..."
                      value={newAnnouncement.title}
                      onChange={(e) =>
                        setNewAnnouncement({ ...newAnnouncement, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      placeholder="Write your announcement..."
                      value={newAnnouncement.content}
                      onChange={(e) =>
                        setNewAnnouncement({ ...newAnnouncement, content: e.target.value })
                      }
                      className="min-h-32"
                    />
                  </div>

                  {profile?.role === 'admin' && (
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label>Global Announcement</Label>
                        <p className="text-sm text-muted-foreground">
                          Visible to all departments
                        </p>
                      </div>
                      <Switch
                        checked={newAnnouncement.isGlobal}
                        onCheckedChange={(checked) =>
                          setNewAnnouncement({ ...newAnnouncement, isGlobal: checked })
                        }
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        'Post Announcement'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <Card className="border-0 shadow-card">
            <CardContent className="flex h-64 flex-col items-center justify-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No announcements yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Check back later for updates
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {announcements.map((announcement) => (
              <Card
                key={announcement.id}
                className="border-0 shadow-card hover:shadow-card-hover transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {announcement.profiles?.full_name} •{' '}
                        {formatDistanceToNow(new Date(announcement.created_at), {
                          addSuffix: true,
                        })}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        announcement.is_global
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-secondary text-secondary-foreground'
                      }
                    >
                      {announcement.is_global ? (
                        <>
                          <Globe className="mr-1 h-3 w-3" />
                          Global
                        </>
                      ) : (
                        <>
                          <Building className="mr-1 h-3 w-3" />
                          {announcement.departments?.name || 'Department'}
                        </>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{announcement.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Announcements;
