import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Upload,
  Shield,
  AlertTriangle,
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
  student_id: string;
  approved_by: string | null;
  approval_timestamp: string | null;
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
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const certificateInputRef = useRef<HTMLInputElement>(null);

  const isBonafideRequest = request?.category === 'bonafide_certificate';
  const isAdmin = profile?.role === 'admin';
  const isFaculty = profile?.role === 'faculty';
  const isStudent = profile?.role === 'student';

  // For bonafide requests, only admin can approve/reject
  // Faculty can only view and add remarks
  const canUpdateStatus = isBonafideRequest
    ? isAdmin
    : (isAdmin || isFaculty);

  const canUploadCertificate = isBonafideRequest && isAdmin;

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

    // Block non-admin from approving/rejecting bonafide requests
    if (isBonafideRequest && !isAdmin && (newStatus === 'approved' || newStatus === 'rejected')) {
      toast({
        title: 'Access Denied',
        description: 'Only administrators can approve or reject Bonafide Certificate requests.',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);

    try {
      const validStatus = newStatus as 'submitted' | 'in_progress' | 'approved' | 'rejected';
      const updateData: any = { status: validStatus };

      // Add approval metadata for approved status
      if (validStatus === 'approved' && isAdmin) {
        updateData.approved_by = profile?.id;
        updateData.approval_timestamp = new Date().toISOString();
      }

      const { error } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', request.id);

      if (error) throw error;

      // Create notification for status change
      const notificationTitle = isBonafideRequest && validStatus === 'approved'
        ? 'Bonafide Certificate Approved!'
        : isBonafideRequest && validStatus === 'rejected'
        ? 'Bonafide Certificate Rejected'
        : 'Request Status Updated';

      const notificationMessage = isBonafideRequest && validStatus === 'approved'
        ? `Your Bonafide Certificate request ${request.request_number} has been approved. You can now download your certificate.`
        : isBonafideRequest && validStatus === 'rejected'
        ? `Your Bonafide Certificate request ${request.request_number} has been rejected. Please check the remarks for details.`
        : `Your request ${request.request_number} status changed to ${newStatus.replace('_', ' ')}`;

      await supabase.from('notifications').insert({
        user_id: request.student_id,
        title: notificationTitle,
        message: notificationMessage,
        link: `/requests/${request.id}`,
      });

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

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !request) return;

    if (!isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only administrators can upload Bonafide Certificates.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingCertificate(true);

    try {
      // Upload certificate to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${request.student_id}/${request.id}_bonafide.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Generate verification ID
      const verificationId = `BON-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Update request with certificate info
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          certificate_url: fileName,
          verification_id: verificationId,
          status: 'approved',
          approved_by: profile?.id,
          approval_timestamp: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Create timeline entry
      await supabase.from('request_timeline').insert({
        request_id: request.id,
        status: 'approved',
        remarks: `Bonafide Certificate issued. Verification ID: ${verificationId}`,
        updated_by: profile?.id,
      });

      // Notify student
      await supabase.from('notifications').insert({
        user_id: request.student_id,
        title: '🎉 Bonafide Certificate Ready!',
        message: `Your Bonafide Certificate (${request.request_number}) is ready for download. Verification ID: ${verificationId}`,
        link: `/requests/${request.id}`,
      });

      toast({
        title: 'Certificate Uploaded',
        description: 'The Bonafide Certificate has been issued successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingCertificate(false);
      if (certificateInputRef.current) {
        certificateInputRef.current.value = '';
      }
    }
  };

  const handleDownloadCertificate = async () => {
    if (!request?.certificate_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('certificates')
        .download(request.certificate_url);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bonafide_Certificate_${request.request_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive',
      });
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
            <div className="flex items-center gap-3 flex-wrap">
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
              {isBonafideRequest && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Shield className="mr-1 h-3 w-3" />
                  Admin Only
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{formatCategory(request.category)}</p>
          </div>
        </div>

        {/* Urgent Bonafide Alert for Faculty */}
        {isBonafideRequest && request.priority === 'urgent' && isFaculty && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Admin Approval Required (Urgent Bonafide)</p>
                  <p className="text-sm text-muted-foreground">
                    This is an urgent Bonafide Certificate request. Only administrators can approve or reject this request.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

                {/* Certificate Download Section - Only for students with approved bonafide */}
                {isBonafideRequest && request.status === 'approved' && request.certificate_url && (
                  <div className="rounded-lg bg-success/10 p-4">
                    <Label className="text-success">Bonafide Certificate Ready</Label>
                    <div className="mt-2 flex items-center gap-4 flex-wrap">
                      <Button variant="default" size="sm" onClick={handleDownloadCertificate}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Certificate
                      </Button>
                      {request.verification_id && (
                        <p className="text-sm text-muted-foreground">
                          Verification ID: <span className="font-mono font-medium">{request.verification_id}</span>
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

            {/* Admin Certificate Upload - Only for Bonafide requests */}
            {canUploadCertificate && request.status !== 'approved' && (
              <Card className="border-0 shadow-card border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Issue Bonafide Certificate
                  </CardTitle>
                  <CardDescription>Upload the Bonafide Certificate for this student</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Student Name</Label>
                      <p className="font-medium">{request.profiles?.full_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Roll Number</Label>
                      <p className="font-medium">{request.profiles?.roll_number || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <p className="font-medium">{request.departments?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Priority</Label>
                      <Badge variant={request.priority === 'urgent' ? 'destructive' : 'secondary'}>
                        {request.priority === 'urgent' ? 'URGENT' : 'Normal'}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Upload Certificate (PDF)</Label>
                    <div className="flex items-center gap-4">
                      <input
                        ref={certificateInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleCertificateUpload}
                        className="hidden"
                        id="certificate-upload"
                      />
                      <Button
                        variant="default"
                        onClick={() => certificateInputRef.current?.click()}
                        disabled={uploadingCertificate}
                      >
                        {uploadingCertificate ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload & Approve
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uploading the certificate will automatically approve the request and notify the student.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Update Status (Faculty/Admin) - Conditional for Bonafide */}
            {(isAdmin || (isFaculty && !isBonafideRequest) || (isFaculty && isBonafideRequest)) && (
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>
                    {isBonafideRequest && isFaculty ? 'Add Remarks' : 'Update Status'}
                  </CardTitle>
                  <CardDescription>
                    {isBonafideRequest && isFaculty
                      ? 'You can view and add remarks. Only admins can approve this request.'
                      : 'Change the status and add remarks'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status dropdown - Hidden for faculty on bonafide requests */}
                  {canUpdateStatus && (
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
                  )}

                  <div className="space-y-2">
                    <Label>Remarks {isBonafideRequest && isFaculty ? '' : '(Optional)'}</Label>
                    <Textarea
                      placeholder={
                        isBonafideRequest && isFaculty
                          ? 'Add a note for the admin or student...'
                          : 'Add a note or comment...'
                      }
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>

                  {canUpdateStatus ? (
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
                  ) : (
                    // Faculty can only add remarks for bonafide
                    <Button
                      onClick={async () => {
                        if (!remarks.trim() || !request) return;
                        setUpdating(true);
                        try {
                          await supabase.from('request_timeline').insert({
                            request_id: request.id,
                            status: request.status as any,
                            remarks: remarks.trim(),
                            updated_by: profile?.id,
                          });
                          toast({
                            title: 'Remarks Added',
                            description: 'Your remarks have been added to the timeline.',
                          });
                          setRemarks('');
                        } catch (error: any) {
                          toast({
                            title: 'Failed',
                            description: error.message,
                            variant: 'destructive',
                          });
                        } finally {
                          setUpdating(false);
                        }
                      }}
                      disabled={updating || !remarks.trim()}
                      className="w-full"
                      variant="secondary"
                    >
                      {updating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Remarks'
                      )}
                    </Button>
                  )}
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
                {request.approval_timestamp && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Approved On</span>
                      <span>{format(new Date(request.approval_timestamp), 'MMM d, yyyy')}</span>
                    </div>
                  </>
                )}
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