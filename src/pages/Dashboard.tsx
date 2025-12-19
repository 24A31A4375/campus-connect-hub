import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Users,
  Megaphone,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RequestStats {
  total: number;
  submitted: number;
  inProgress: number;
  approved: number;
  rejected: number;
}

interface RecentRequest {
  id: string;
  request_number: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_global: boolean;
  created_at: string;
  profiles: { full_name: string } | null;
}

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    submitted: 0,
    inProgress: 0,
    approved: 0,
    rejected: 0,
  });
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;

      // Fetch request stats
      let query = supabase.from('requests').select('status');
      
      if (profile.role === 'student') {
        query = query.eq('student_id', profile.id);
      } else if (profile.role === 'faculty') {
        query = query.eq('department_id', profile.department_id);
      }

      const { data: requestsData } = await query;

      if (requestsData) {
        setStats({
          total: requestsData.length,
          submitted: requestsData.filter((r) => r.status === 'submitted').length,
          inProgress: requestsData.filter((r) => r.status === 'in_progress').length,
          approved: requestsData.filter((r) => r.status === 'approved').length,
          rejected: requestsData.filter((r) => r.status === 'rejected').length,
        });
      }

      // Fetch recent requests
      let recentQuery = supabase
        .from('requests')
        .select('id, request_number, category, status, priority, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (profile.role === 'student') {
        recentQuery = recentQuery.eq('student_id', profile.id);
      } else if (profile.role === 'faculty') {
        recentQuery = recentQuery.eq('department_id', profile.department_id);
      }

      const { data: recentData } = await recentQuery;
      if (recentData) setRecentRequests(recentData);

      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('id, title, content, is_global, created_at, profiles:author_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(3);

      if (announcementsData) setAnnouncements(announcementsData as any);

      setLoading(false);
    };

    fetchData();
  }, [profile]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-info" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      submitted: 'bg-warning/10 text-warning border-warning/20',
      in_progress: 'bg-info/10 text-info border-info/20',
      approved: 'bg-success/10 text-success border-success/20',
      rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return styles[status as keyof typeof styles] || '';
  };

  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const statCards = [
    {
      title: 'Total Requests',
      value: stats.total,
      icon: FileText,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Pending',
      value: stats.submitted,
      icon: Clock,
      color: 'bg-warning/10 text-warning',
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      icon: TrendingUp,
      color: 'bg-info/10 text-info',
    },
    {
      title: 'Resolved',
      value: stats.approved + stats.rejected,
      icon: CheckCircle2,
      color: 'bg-success/10 text-success',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back, {profile?.full_name?.split(' ')[0]}! 👋
            </h1>
            <p className="mt-1 text-muted-foreground">
              Here's an overview of your helpdesk activity
            </p>
          </div>
          {profile?.role === 'student' && (
            <Link to="/requests/new">
              <Button variant="hero" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                New Request
              </Button>
            </Link>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="animate-fade-in-up border-0 shadow-card hover:shadow-card-hover transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Requests */}
          <Card className="lg:col-span-2 border-0 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Requests</CardTitle>
                <CardDescription>Your latest helpdesk tickets</CardDescription>
              </div>
              <Link to="/requests">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentRequests.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                  <div className="text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No requests yet</p>
                    {profile?.role === 'student' && (
                      <Link to="/requests/new">
                        <Button variant="link" size="sm" className="mt-1">
                          Create your first request
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRequests.map((request) => (
                    <Link
                      key={request.id}
                      to={`/requests/${request.id}`}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(request.status)}
                        <div>
                          <p className="font-medium">{request.request_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCategory(request.category)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {request.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-xs">
                            Urgent
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`capitalize ${getStatusBadge(request.status)}`}
                        >
                          {request.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="border-0 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  Announcements
                </CardTitle>
                <CardDescription>Latest updates</CardDescription>
              </div>
              <Link to="/announcements">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">No announcements</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="border-l-2 border-primary pl-4"
                    >
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{announcement.title}</h4>
                        {announcement.is_global && (
                          <Badge variant="secondary" className="text-xs">
                            Global
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {announcement.content}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {announcement.profiles?.full_name} •{' '}
                        {formatDistanceToNow(new Date(announcement.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
