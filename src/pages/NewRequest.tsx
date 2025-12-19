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

    setLoading(true);

    try {
      let documentUrl = null;

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

      // Create request
      const { data, error } = await supabase
        .from('requests')
        .insert({
          student_id: profile?.id,
          category: formData.category,
          description: formData.description,
          priority: formData.priority,
          department_id: profile?.department_id,
          document_url: documentUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial timeline entry
      await supabase.from('request_timeline').insert({
        request_id: data.id,
        status: 'submitted',
        remarks: 'Request submitted successfully',
        updated_by: profile?.id,
      });

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

                {/* Priority */}
                <div className="space-y-3">
                  <Label>Priority Level</Label>
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
                        <p className="text-xs text-muted-foreground">Standard processing time</p>
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
                          <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {/* Document Upload */}
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
