-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'faculty', 'admin');

-- Create enum for request status
CREATE TYPE public.request_status AS ENUM ('submitted', 'in_progress', 'approved', 'rejected');

-- Create enum for request priority
CREATE TYPE public.request_priority AS ENUM ('normal', 'urgent');

-- Create enum for request category
CREATE TYPE public.request_category AS ENUM (
  'bonafide_certificate',
  'fee_issues',
  'exam_queries',
  'hostel_issues',
  'library_issues',
  'general_administration'
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  department_id UUID REFERENCES public.departments(id),
  roll_number TEXT,
  section TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create requests table
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category request_category NOT NULL,
  description TEXT NOT NULL,
  priority request_priority NOT NULL DEFAULT 'normal',
  status request_status NOT NULL DEFAULT 'submitted',
  assigned_to UUID REFERENCES public.profiles(id),
  department_id UUID REFERENCES public.departments(id),
  document_url TEXT,
  approved_document_url TEXT,
  certificate_url TEXT,
  verification_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create request_timeline table
CREATE TABLE public.request_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  status request_status NOT NULL,
  remarks TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id),
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default departments
INSERT INTO public.departments (name) VALUES
  ('Computer Science'),
  ('Electronics'),
  ('Mechanical'),
  ('Civil'),
  ('Electrical'),
  ('Information Technology'),
  ('Administration');

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- RLS Policies for departments (public read)
CREATE POLICY "Departments are viewable by everyone" ON public.departments
  FOR SELECT USING (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for requests
CREATE POLICY "Students can view own requests" ON public.requests
  FOR SELECT USING (
    auth.uid() = student_id OR 
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'faculty') AND department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid()))
  );

CREATE POLICY "Students can create requests" ON public.requests
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Faculty and admin can update requests" ON public.requests
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'faculty') AND department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid()))
  );

-- RLS Policies for request_timeline
CREATE POLICY "Users can view request timeline" ON public.request_timeline
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.requests r WHERE r.id = request_id AND (
        r.student_id = auth.uid() OR
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'faculty') AND r.department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "Faculty and admin can create timeline entries" ON public.request_timeline
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'faculty')
  );

-- RLS Policies for announcements
CREATE POLICY "Users can view relevant announcements" ON public.announcements
  FOR SELECT USING (
    is_global = true OR
    public.has_role(auth.uid(), 'admin') OR
    department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Faculty can create department announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR
      (public.has_role(auth.uid(), 'faculty') AND department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid()))
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Function to generate request number
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.request_number := 'REQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_request_number
  BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_request_number();

-- Function to create timeline entry on status change
CREATE OR REPLACE FUNCTION public.create_timeline_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.request_timeline (request_id, status, updated_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER request_status_change
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.create_timeline_entry();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role app_role;
  dept_id UUID;
BEGIN
  user_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'student');
  dept_id := (NEW.raw_user_meta_data ->> 'department_id')::UUID;
  
  INSERT INTO public.profiles (id, email, full_name, role, department_id, roll_number, section)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    user_role,
    dept_id,
    NEW.raw_user_meta_data ->> 'roll_number',
    NEW.raw_user_meta_data ->> 'section'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for requests and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;