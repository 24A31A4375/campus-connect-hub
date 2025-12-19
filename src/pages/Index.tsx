import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap,
  FileText,
  Clock,
  CheckCircle2,
  MessageSquare,
  Bell,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
} from 'lucide-react';

const Index: React.FC = () => {
  const features = [
    {
      icon: FileText,
      title: 'Easy Request Submission',
      description: 'Submit requests for certificates, fee issues, exam queries, and more with just a few clicks.',
    },
    {
      icon: Clock,
      title: 'Real-Time Tracking',
      description: 'Track the status of your requests in real-time with detailed timeline updates.',
    },
    {
      icon: MessageSquare,
      title: 'AI-Powered Support',
      description: 'Get instant answers to FAQs and smart request categorization with our AI assistant.',
    },
    {
      icon: Bell,
      title: 'Instant Notifications',
      description: 'Stay informed with real-time notifications for every status update.',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Your data is protected with enterprise-grade security and encryption.',
    },
    {
      icon: Zap,
      title: 'Fast Processing',
      description: 'Streamlined workflows ensure quick resolution of your requests.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-primary-foreground">
              <h1 className="text-xl font-bold">College Helpdesk</h1>
              <p className="text-xs opacity-80">Smart Support System</p>
            </div>
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="lg">
              Sign In
            </Button>
          </Link>
        </nav>

        <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-16 text-center lg:pb-32 lg:pt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm text-primary-foreground backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            AI-Powered Campus Support
          </div>

          <h2 className="text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
            Your Campus Helpdesk,
            <br />
            <span className="text-accent">Simplified.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            No more long queues or endless paperwork. Submit requests, track progress,
            and get instant support—all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth">
              <Button variant="hero" size="xl" className="w-full sm:w-auto">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="xl"
              className="w-full border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
            >
              Learn More
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 border-t border-primary-foreground/10 pt-8">
            <div>
              <p className="text-3xl font-bold text-primary-foreground">500+</p>
              <p className="text-sm text-primary-foreground/70">Requests Resolved</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-foreground">24h</p>
              <p className="text-sm text-primary-foreground/70">Avg Response Time</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-foreground">98%</p>
              <p className="text-sm text-primary-foreground/70">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h3 className="text-3xl font-bold lg:text-4xl">Everything You Need</h3>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              A comprehensive platform designed to streamline campus administration
              and improve student experience.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group border-0 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <h4 className="mt-4 text-lg font-semibold">{feature.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <Card className="overflow-hidden border-0 gradient-primary shadow-2xl">
            <CardContent className="flex flex-col items-center p-12 text-center text-primary-foreground">
              <CheckCircle2 className="h-16 w-16" />
              <h3 className="mt-6 text-3xl font-bold">Ready to Get Started?</h3>
              <p className="mt-4 max-w-xl text-primary-foreground/80">
                Join hundreds of students and staff members who are already using
                our smart helpdesk system.
              </p>
              <Link to="/auth" className="mt-8">
                <Button
                  variant="secondary"
                  size="xl"
                  className="shadow-lg hover:shadow-xl"
                >
                  Create Your Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-semibold">College Helpdesk</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 College Helpdesk. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
