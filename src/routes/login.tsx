import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PawPrint } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSupabaseConfigured } from "@/integrations/supabase/configured";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  if (!loading && session) return <Navigate to="/" />;

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function signUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    if (!data.session) toast.success("Check your email to confirm your account, then sign in.");
  }

  async function resetPassword() {
    if (!email.trim()) return void toast.error("Type your email first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("We've emailed you a link to set a new password.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <PawPrint className="size-8" />
          </div>
          <h1 className="text-3xl font-bold">WoofAbode</h1>
          <p className="mt-1 text-muted-foreground">A home away from home for your dog</p>
        </div>
        {!isSupabaseConfigured ? (
          <p className="rounded-xl bg-warning/25 p-3 text-center text-sm">
            The backend isn't connected yet. Enable Lovable Cloud for this project.
          </p>
        ) : null}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <Tabs defaultValue="signin">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <Field label="Email">
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="w-full text-center text-sm text-muted-foreground underline"
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <Field label="Your name">
                  <Input
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Password" hint="At least 6 characters">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
