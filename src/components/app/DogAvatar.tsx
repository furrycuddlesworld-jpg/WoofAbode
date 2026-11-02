import { useQuery } from "@tanstack/react-query";
import { Dog as DogIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("dog-files")
        .createSignedUrl(path as string, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function DogAvatar({
  path,
  name,
  className,
}: {
  path: string | null;
  name: string;
  className?: string;
}) {
  const { data: url } = useSignedUrl(path);
  return (
    <div
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-accent-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name} className="size-full object-cover" />
      ) : (
        <DogIcon className="size-1/2" />
      )}
    </div>
  );
}
