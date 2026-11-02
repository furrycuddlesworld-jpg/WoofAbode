import { createFileRoute, Link } from "@tanstack/react-router";
import { Dog as DogIcon, Plus } from "lucide-react";

import { EmptyState, Loading, PageHeader } from "@/components/app/Common";
import { DogAvatar } from "@/components/app/DogAvatar";
import { Button } from "@/components/ui/button";
import { formatAge } from "@/lib/dates";
import { useDogs } from "@/lib/queries";

export const Route = createFileRoute("/_authed/dogs/")({
  component: DogsPage,
});

function DogsPage() {
  const { data: dogs = [], isLoading } = useDogs();
  return (
    <>
      <PageHeader
        title="My dogs"
        actions={
          <Button asChild>
            <Link to="/dogs/new">
              <Plus className="size-4" /> Add a dog
            </Link>
          </Button>
        }
      />
      {isLoading ? <Loading /> : null}
      {!isLoading && dogs.length === 0 ? (
        <EmptyState icon={<DogIcon className="size-8" />} title="No dogs yet">
          Add your dog's profile, vet details and vaccination records.
        </EmptyState>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {dogs.map((d) => (
          <Link
            key={d.id}
            to="/dogs/$dogId"
            params={{ dogId: d.id }}
            className="flex items-center gap-4 rounded-2xl border bg-card p-4 hover:border-primary"
          >
            <DogAvatar path={d.photo_path} name={d.name} />
            <div>
              <div className="text-lg font-semibold">{d.name}</div>
              <div className="text-sm text-muted-foreground">
                {[
                  d.breed,
                  formatAge(d.date_of_birth),
                  d.sex === "male" ? "Male" : d.sex === "female" ? "Female" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
