import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Upload,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  DollarSign,
  ClipboardList,
  Home,
  BookMarked,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Category = 'bonafide_certificate' | 'fee_issues' | 'exam_queries' | 'hostel_issues' | 'library_issues' | 'general_administration';

const categoryConfig = {
  bonafide_certificate: {
    label: 'Bonafide Certificate',
    icon: FileText,
    description: 'Request for bonafide/character certificate',
    color: 'bg-primary/10 text-primary',
  },
  fee_issues: {
    label: 'Fee Issues',
    icon: DollarSign,
    description: 'Fee payment, refund, or scholarship queries',
    color: 'bg-success/10 text-success',
  },
  exam_queries: {
    label: 'Exam Queries',
    icon: ClipboardList,
    description: 'Exam schedules, results, or hall tickets',
    color: 'bg-warning/10 text-warning',
  },
  hostel_issues: {
    label: 'Hostel Issues',
    icon: Home,
    description: 'Hostel allotment, maintenance, or facilities',
    color: 'bg-info/10 text-info',
  },
  library_issues: {
    label: 'Library Issues',
    icon: BookMarked,
    description: 'Library cards, books, or access issues',
    color: 'bg-accent/10 text-accent',
  },
  general_administration: {
    label: 'General Administration',
    icon: Settings,
    description: 'Other administrative requests',
    color: 'bg-muted-foreground/10 text-muted-foreground',
  },
};

type FeeSubCategory = 'cdp_fees' | 'bus_fees' | 'tuition_fees';

const feeSubCategoryLabels: Record<FeeSubCategory, string> = {
  cdp_fees: 'CDP Fees (Campus Development Program)',
  bus_fees: 'Bus Fees',
  tuition_fees: 'Tuition Fees',
};

const NewRequest: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    category: '' as Category | '',
    description: '',
    priority: 'normal' as 'normal' | 'urgent',
    document: null as File | null,
    feeSubCategory: '' as FeeSubCategory | '',
    receipt: null as File | null,
  });

  const handleCategorySelect = (category: Category) => {
    setFormData({ ...formData, category });
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category || !formData.description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Validate fee issues specific fields
    if (formData.category === 'fee_issues') {
      if (!formData.feeSubCategory) {
        toast({
          title: 'Missing Fee Category',
          description: 'Please select a fee sub-category.',
          variant: 'destructive',
        });
        return;
      }
      if (!formData.receipt) {
        toast({
          title: 'Missing Receipt',
          description: 'Please upload a fee receipt (required for fee issues).',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      let documentUrl = null;
      let receiptUrl = null;

      // Upload document if provided
      if (formData.document) {
        const fileExt = formData.document.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('request-documents')
          .upload(fileName, formData.document);

        if (uploadError) throw uploadError;
        documentUrl = uploadData.path;
      }

      // Upload fee receipt if provided (for fee issues)
      if (formData.receipt && formData.category === 'fee_issues') {
        const fileExt = formData.receipt.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}_receipt.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('fee-receipts')
          .upload(fileName, formData.receipt);

        if (uploadError) throw uploadError;
        receiptUrl = uploadData.path;
      }

      // Create request
      const { data, error } = await supabase
        .from('requests')
        .insert({
          student_id: profile?.id as string,
          category: formData.category as 'bonafide_certificate' | 'fee_issues' | 'exam_queries' | 'hostel_issues' | 'library_issues' | 'general_administration',
          description: formData.description,
          priority: formData.priority,
          department_id: profile?.department_id,
          document_url: documentUrl,
          request_number: `REQ-${Date.now()}`,
          fee_sub_category: formData.category === 'fee_issues' ? formData.feeSubCategory : null,
          receipt_url: receiptUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial timeline entry
      const timelineRemarks = formData.category === 'bonafide_certificate' && formData.priority === 'urgent'
        ? 'Urgent Bonafide Certificate request submitted - Routed to Admin'
        : formData.category === 'fee_issues'
        ? `Fee Issue (${feeSubCategoryLabels[formData.feeSubCategory as FeeSubCategory]}) submitted`
        : 'Request submitted successfully';

      await supabase.from('request_timeline').insert({
        request_id: data.id,
        status: 'submitted',
        remarks: timelineRemarks,
        updated_by: profile?.id,
      });

      // Notify admins for urgent bonafide requests
      if (formData.category === 'bonafide_certificate' && formData.priority === 'urgent') {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (adminRoles && adminRoles.length > 0) {
          const notifications = adminRoles.map(admin => ({
            user_id: admin.user_id,
            title: '🚨 URGENT: Bonafide Certificate Request',
            message: `Urgent bonafide certificate request ${data.request_number} requires immediate admin action.`,
            link: `/requests/${data.id}`,
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }

      // Notify for fee issues submission
      if (formData.category === 'fee_issues') {
        // Notify faculty and admin of the department
        const { data: facultyRoles } = await supabase
          .from('profiles')
          .select('id')
          .eq('department_id', profile?.department_id)
          .in('role', ['faculty', 'admin']);

        if (facultyRoles && facultyRoles.length > 0) {
          const notifications = facultyRoles.map(faculty => ({
            user_id: faculty.id,
            title: `📝 Fee Issue: ${feeSubCategoryLabels[formData.feeSubCategory as FeeSubCategory]}`,
            message: `New fee issue request ${data.request_number} submitted.`,
            link: `/requests/${data.id}`,
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }

      toast({
        title: 'Request Submitted!',
        description: `Your request ${data.request_number} has been created successfully.`,
      });

      navigate('/requests');
    } catch (error: any) {
      toast({
        title: 'Submission Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Request</h1>
            <p className="text-muted-foreground">Submit a new helpdesk request</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              1
            </div>
            <span className={step >= 1 ? 'font-medium' : 'text-muted-foreground'}>
              Select Category
            </span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              2
            </div>
            <span className={step >= 2 ? 'font-medium' : 'text-muted-foreground'}>
              Request Details
            </span>
          </div>
        </div>

        {/* Step 1: Category Selection */}
        {step === 1 && (
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>What do you need help with?</CardTitle>
              <CardDescription>Select a category that best describes your request</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(categoryConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => handleCategorySelect(key as Category)}
                      className={cn(
                        'flex items-start gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary hover:shadow-md',
                        formData.category === key && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', config.color)}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{config.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Request Details */}
        {step === 2 && formData.category && (
          <form onSubmit={handleSubmit}>
            <Card className="border-0 shadow-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle>{categoryConfig[formData.category].label}</CardTitle>
                    <CardDescription>Provide details about your request</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Describe your issue or request <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Please provide detailed information about your request..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Be as specific as possible to help us process your request faster
                  </p>
                </div>

                {/* Fee Sub-Category - Show for Fee Issues */}
                {formData.category === 'fee_issues' && (
                  <div className="space-y-3">
                    <Label>
                      Fee Category <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.feeSubCategory}
                      onValueChange={(value: FeeSubCategory) =>
                        setFormData({ ...formData, feeSubCategory: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fee category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cdp_fees">CDP Fees (Campus Development Program)</SelectItem>
                        <SelectItem value="bus_fees">Bus Fees</SelectItem>
                        <SelectItem value="tuition_fees">Tuition Fees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Fee Receipt Upload - Mandatory for Fee Issues */}
                {formData.category === 'fee_issues' && (
                  <div className="space-y-2">
                    <Label>
                      Fee Receipt <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-4">
                      <label className={cn(
                        'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary hover:bg-muted/50',
                        formData.receipt && 'border-success bg-success/5'
                      )}>
                        <Upload className={cn('h-5 w-5', formData.receipt ? 'text-success' : 'text-muted-foreground')} />
                        <span className={cn('text-sm', formData.receipt ? 'text-success font-medium' : 'text-muted-foreground')}>
                          {formData.receipt ? formData.receipt.name : 'Upload fee receipt (PDF, JPG, PNG) - Max 5MB'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.size > 5 * 1024 * 1024) {
                              toast({
                                title: 'File Too Large',
                                description: 'Receipt file must be less than 5MB.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            setFormData({ ...formData, receipt: file || null });
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload your payment receipt as proof. This is required for fee issue requests.
                    </p>
                  </div>
                )}

                {/* Priority - Show for Bonafide Certificate and Fee Issues */}
                {(formData.category === 'bonafide_certificate' || formData.category === 'fee_issues') && (
                  <div className="space-y-3">
                    <Label>Priority Level</Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.category === 'bonafide_certificate' 
                        ? 'Select Urgent if you need the certificate within 24-48 hours'
                        : 'Select Urgent if your fee issue requires immediate attention'}
                    </p>
                    <RadioGroup
                      value={formData.priority}
                      onValueChange={(value: 'normal' | 'urgent') =>
                        setFormData({ ...formData, priority: value })
                      }
                      className="flex gap-4"
                    >
                      <label
                        className={cn(
                          'flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all hover:bg-muted/50',
                          formData.priority === 'normal' && 'border-primary bg-primary/5'
                        )}
                      >
                        <RadioGroupItem value="normal" />
                        <div>
                          <p className="font-medium">Normal</p>
                          <p className="text-xs text-muted-foreground">3-5 working days</p>
                        </div>
                      </label>
                      <label
                        className={cn(
                          'flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all hover:bg-muted/50',
                          formData.priority === 'urgent' && 'border-destructive bg-destructive/5'
                        )}
                      >
                        <RadioGroupItem value="urgent" />
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <div>
                            <p className="font-medium">Urgent</p>
                            <p className="text-xs text-muted-foreground">
                              {formData.category === 'bonafide_certificate' 
                                ? 'Admin priority (24-48 hours)'
                                : 'Priority processing'}
                            </p>
                          </div>
                        </div>
                      </label>
                    </RadioGroup>
                    {formData.priority === 'urgent' && formData.category === 'bonafide_certificate' && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="mr-2 inline h-4 w-4" />
                        Urgent bonafide requests are routed directly to Admin for immediate processing.
                      </div>
                    )}
                  </div>
                )}

                {/* Document Upload - Optional for non-fee issues */}
                {formData.category !== 'fee_issues' && (
                  <div className="space-y-2">
                    <Label>Supporting Document (Optional)</Label>
                    <div className="flex items-center gap-4">
                      <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary hover:bg-muted/50">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formData.document ? formData.document.name : 'Click to upload PDF, JPG, or PNG'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) =>
                            setFormData({ ...formData, document: e.target.files?.[0] || null })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate('/requests')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="hero" className="flex-1" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Submit Request
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NewRequest;
