import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Phone } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BoardingPanel } from "@/components/app/BoardingPanel";
import { EmptyState, Loading } from "@/components/app/Common";
import { DogAvatar } from "@/components/app/DogAvatar";
import { DogForm } from "@/components/app/DogForm";
import { HealthPanel } from "@/components/app/HealthPanel";
import { RatesPanel } from "@/components/app/RatesPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { formatAge, formatDate } from "@/lib/dates";
import { useDog, useProfiles } from "@/lib/queries";

export const Route = createFileRoute("/_authed/dogs/$dogId")({
  staticData: { sitemap: false },
  head: () => pageHead("Dog details", "Dog care, boarding records and individual rates at WoofAbode."),
  component: DogPage,
});

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}

function DogPage() {
  const { dogId } = Route.useParams();
  const { isAdmin } = useAuth();
  const { data: dog, isLoading } = useDog(dogId);
  const { data: profiles = [] } = useProfiles(isAdmin);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <Loading />;
  if (!dog) return <EmptyState title="Dog not found" />;
  const owner = profiles.find((p) => p.id === dog.owner_id);

  return (
    <>
      <Link
        to={isAdmin ? "/admin/dogs" : "/dogs"}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div className="mb-5 flex items-center gap-4">
        <DogAvatar path={dog.photo_path} name={dog.name} className="size-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{dog.name}</h1>
          <p className="text-muted-foreground">
            {[dog.breed, formatAge(dog.date_of_birth)].filter(Boolean).join(" · ")}
          </p>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">
              Parent:{" "}
              {owner
                ? owner.full_name || owner.email
                : dog.pending_owner_email
                  ? `${dog.pending_owner_email} (not signed up yet)`
                  : "not linked"}
            </p>
          ) : null}
        </div>
        {!editing ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <DogForm dog={dog} onSaved={() => setEditing(false)} />
      ) : (
        <Tabs defaultValue="profile">
          <TabsList className="mb-4 flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="boarding">Boarding</TabsTrigger>
            {isAdmin ? <TabsTrigger value="rates">Rates</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="profile">
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="rounded-2xl border bg-card p-4">
                <h3 className="mb-2 font-semibold">About</h3>
                <Row label="Date of birth" value={formatDate(dog.date_of_birth)} />
                <Row
                  label="Sex"
                  value={dog.sex === "male" ? "Male" : dog.sex === "female" ? "Female" : null}
                />
                <Row
                  label="Neutered"
                  value={dog.neutered == null ? null : dog.neutered ? "Yes" : "No"}
                />
                <Row label="Weight" value={dog.weight_kg ? `${dog.weight_kg} kg` : null} />
                <Row label="Location" value={dog.location} />
                <Row label="Food" value={dog.food} />
                <Row label="Medicines" value={dog.medicines} />
                <Row label="Allergies" value={dog.allergies} />
                <Row label="Behaviour" value={dog.behaviour_notes} />
              </dl>
              <div className="space-y-4">
                <dl className="rounded-2xl border bg-card p-4">
                  <h3 className="mb-2 font-semibold">Vet</h3>
                  {dog.vet_name || dog.vet_clinic ? (
                    <>
                      <Row label="Vet" value={dog.vet_name} />
                      <Row label="Clinic" value={dog.vet_clinic} />
                      <Row label="Address" value={dog.vet_address} />
                      {dog.vet_phone ? (
                        <a
                          href={`tel:${dog.vet_phone}`}
                          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary"
                        >
                          <Phone className="size-4" /> {dog.vet_phone}
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No vet details yet. Tap Edit to add them.
                    </p>
                  )}
                </dl>
                {isAdmin && owner ? (
                  <dl className="rounded-2xl border bg-card p-4">
                    <h3 className="mb-2 font-semibold">Emergency contacts</h3>
                    <Row
                      label="Parent"
                      value={[owner.full_name, owner.phone].filter(Boolean).join(" · ")}
                    />
                    <Row
                      label={owner.emergency1_relation || "Contact 1"}
                      value={[owner.emergency1_name, owner.emergency1_phone]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <Row
                      label={owner.emergency2_relation || "Contact 2"}
                      value={[owner.emergency2_name, owner.emergency2_phone]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  </dl>
                ) : null}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="health">
            <HealthPanel dog={dog} />
          </TabsContent>
          <TabsContent value="boarding">
            <BoardingPanel dog={dog} />
          </TabsContent>
          {isAdmin ? (
            <TabsContent value="rates">
              <RatesPanel dog={dog} />
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </>
  );
}
