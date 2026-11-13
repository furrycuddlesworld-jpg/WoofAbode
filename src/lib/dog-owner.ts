/** Resolve ownership from the current validated identity, never a cached form session. */
export function dogOwnership(userId: string | undefined, isAdmin: boolean, selectedOwner: string, editing: boolean): { owner_id?: string | null } {
  if (!userId) throw new Error("Your sign-in has expired. Please sign in again before saving your dog.");
  if (isAdmin) return { owner_id: selectedOwner || null };
  // Ordinary edits must not attempt to reassign an existing dog.
  return editing ? {} : { owner_id: userId };
}