import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PageHeader } from "@/components/app/Common";
import { DogForm } from "@/components/app/DogForm";

export const Route = createFileRoute("/_authed/dogs/new")({
  head: () => pageHead("Add a dog", "Add a dog and care details to your WoofAbode account."),
  component: NewDog,
});

function NewDog() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Add a dog" subtitle="You can add health records after saving." />
      <DogForm
        dog={null}
        onSaved={(d) => navigate({ to: "/dogs/$dogId", params: { dogId: d.id } })}
      />
    </>
  );
}
