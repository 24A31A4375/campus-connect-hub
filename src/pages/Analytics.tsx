import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { FileText, Users, Clock, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

interface Stats {
  totalRequests: number;
  pendingRequests: number;
  resolvedRequests: number;
  avgResolutionTime: number;
  urgentRequests: number;
  totalUsers: number;
}

const Analytics: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalRequests: 0,
    pendingRequests: 0,
    resolvedRequests: 0,
    avgResolutionTime: 0,
    urgentRequests: 0,
    totalUsers: 0,
  });
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Fetch requests
      const { data: requests } = await supabase.from('requests').select('*');
      
      if (requests) {
        // Calculate stats
        const total = requests.length;
        const pending = requests.filter((r) => r.status === 'submitted' || r.status === 'in_progress').length;
        const resolved = requests.filter((r) => r.status === 'approved' || r.status === 'rejected').length;
        const urgent = requests.filter((r) => r.priority === 'urgent').length;

        setStats({
          totalRequests: total,
          pendingRequests: pending,
          resolvedRequests: resolved,
          avgResolutionTime: 24,
          urgentRequests: urgent,
          totalUsers: 0,
        });

        // Category distribution
        const categories = requests.reduce((acc: Record<string, number>, req) => {
          acc[req.category] = (acc[req.category] || 0) + 1;
          return acc;
        }, {});

        setCategoryData(
          Object.entries(categories).map(([name, value]) => ({
            name: name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            value,
          }))
        );

        // Status distribution
        const statuses = requests.reduce((acc: Record<string, number>, req) => {
          acc[req.status] = (acc[req.status] || 0) + 1;
          return acc;
        }, {});

        setStatusData(
          Object.entries(statuses).map(([name, value]) => ({
            name: name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            value,
          }))
        );
      }

      // Fetch users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (usersCount) {
        setStats((prev) => ({ ...prev, totalUsers: usersCount }));
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  const COLORS = ['hsl(234, 89%, 54%)', 'hsl(173, 80%, 40%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(199, 89%, 48%)', 'hsl(160, 84%, 39%)'];

  const statCards = [
    {
      title: 'Total Requests',
      value: stats.totalRequests,
      icon: FileText,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Pending',
      value: stats.pendingRequests,
      icon: Clock,
      color: 'bg-warning/10 text-warning',
    },
    {
      title: 'Resolved',
      value: stats.resolvedRequests,
      icon: CheckCircle2,
      color: 'bg-success/10 text-success',
    },
    {
      title: 'Urgent Issues',
      value: stats.urgentRequests,
      icon: AlertTriangle,
      color: 'bg-destructive/10 text-destructive',
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-info/10 text-info',
    },
    {
      title: 'Avg Resolution',
      value: `${stats.avgResolutionTime}h`,
      icon: TrendingUp,
      color: 'bg-accent/10 text-accent',
    },
  ];

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Access restricted to administrators</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of helpdesk performance and metrics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category Distribution */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Requests by Category</CardTitle>
              <CardDescription>Distribution of request types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(234, 89%, 54%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Requests by Status</CardTitle>
              <CardDescription>Current status distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {statusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
