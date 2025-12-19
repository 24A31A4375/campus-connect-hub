import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Building,
  Calendar,
  MessageSquare,
  Loader2,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';

interface TimelineEntry {
  id: string;
  status: string;
  remarks: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface RequestDetail {
  id: string;
  request_number: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  document_url: string | null;
  approved_document_url: string | null;
  certificate_url: string | null;
  verification_id: string | null;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string; email: string; roll_number: string | null } | null;
  departments: { name: string } | null;
  assigned: { full_name: string } | null;
}

const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const fetchRequest = async () => {
      if (!id) return;

      const { data: requestData, error: requestError } = await supabase
        .from('requests')
        .select(`
          *,
          profiles:student_id(full_name, email, roll_number),
          departments:department_id(name),
          assigned:assigned_to(full_name)
        `)
        .eq('id', id)
        .single();

      if (!requestError && requestData) {
        setRequest(requestData as any);
        setNewStatus(requestData.status);
      }

      const { data: timelineData } = await supabase
        .from('request_timeline')
        .select(`
          *,
          profiles:updated_by(full_name)
        `)
        .eq('request_id', id)
        .order('created_at', { ascending: true });

      if (timelineData) setTimeline(timelineData as any);

      setLoading(false);
    };

    fetchRequest();

    // Realtime subscription
    const channel = supabase
      .channel(`request-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `id=eq.${id}` },
        () => fetchRequest()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'request_timeline', filter: `request_id=eq.${id}` },
        () => fetchRequest()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleStatusUpdate = async () => {
    if (!request || !newStatus) return;

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', request.id);

      if (error) throw error;

      if (remarks.trim()) {
        await supabase.from('request_timeline').insert({
          request_id: request.id,
          status: newStatus as any,
          remarks: remarks.trim(),
          updated_by: profile?.id,
        });
      }

      toast({
        title: 'Status Updated',
        description: 'The request status has been updated successfully.',
      });

      setRemarks('');
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-5 w-5 text-warning" />;
      case 'in_progress':
        return <AlertCircle className="h-5 w-5 text-info" />;
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5" />;
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

  const canUpdateStatus = profile?.role === 'faculty' || profile?.role === 'admin';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!request) {
    return (
      <DashboardLayout>
        <div className="flex h-64 flex-col items-center justify-center">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Request not found</h3>
          <Button variant="link" onClick={() => navigate('/requests')}>
            Go back to requests
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{request.request_number}</h1>
              <Badge
                variant="outline"
                className={`capitalize ${getStatusBadge(request.status)}`}
              >
                {getStatusIcon(request.status)}
                <span className="ml-1.5">{request.status.replace('_', ' ')}</span>
              </Badge>
              {request.priority === 'urgent' && (
                <Badge variant="destructive">Urgent</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{formatCategory(request.category)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details */}
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{request.description}</p>
                </div>

                {request.document_url && (
                  <div>
                    <Label className="text-muted-foreground">Attached Document</Label>
                    <Button variant="outline" size="sm" className="mt-1">
                      <Download className="mr-2 h-4 w-4" />
                      Download Document
                    </Button>
                  </div>
                )}

                {request.certificate_url && (
                  <div className="rounded-lg bg-success/10 p-4">
                    <Label className="text-success">Certificate Ready</Label>
                    <div className="mt-2 flex items-center gap-4">
                      <Button variant="success" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download Certificate
                      </Button>
                      {request.verification_id && (
                        <p className="text-sm text-muted-foreground">
                          Verification ID: {request.verification_id}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>Track the progress of your request</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-6 pl-6">
                  <div className="absolute left-[9px] top-2 h-[calc(100%-16px)] w-0.5 bg-border" />
                  {timeline.map((entry, index) => (
                    <div key={entry.id} className="relative">
                      <div
                        className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full ${
                          index === timeline.length - 1 ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            index === timeline.length - 1 ? 'bg-primary-foreground' : 'bg-muted-foreground'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`capitalize ${getStatusBadge(entry.status)}`}
                          >
                            {entry.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        {entry.remarks && (
                          <p className="mt-1 text-sm text-muted-foreground">{entry.remarks}</p>
                        )}
                        {entry.profiles && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            by {entry.profiles.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Update Status (Faculty/Admin) */}
            {canUpdateStatus && (
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
                  <CardDescription>Change the status and add remarks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>New Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Remarks (Optional)</Label>
                    <Textarea
                      placeholder="Add a note or comment..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating || newStatus === request.status}
                    className="w-full"
                  >
                    {updating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Status'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Student Info */}
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Student Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{request.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
                  </div>
                </div>
                {request.profiles?.roll_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Roll Number:</span>
                    <span>{request.profiles.roll_number}</span>
                  </div>
                )}
                {request.departments && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{request.departments.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Request Meta */}
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Request Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{format(new Date(request.updated_at), 'MMM d, yyyy')}</span>
                </div>
                {request.assigned && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Assigned To</span>
                      <span>{request.assigned.full_name}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RequestDetail;
