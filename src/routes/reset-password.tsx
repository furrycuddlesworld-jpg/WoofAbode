import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({ meta: [...pageHead("Reset password", "Set a new password for your WoofAbode account.").meta, { name: "robots", content: "noindex" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function save(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return void toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-4 text-2xl font-bold">Set a new password</h1>
      <form onSubmit={save} className="space-y-4">
        <Field label="New password">
          <Input
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full">
          Save password
        </Button>
      </form>
    </div>
  );
}
