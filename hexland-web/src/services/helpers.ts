import { maxProfileEntries } from '../data/policy';
import { IAdventureSummary } from '../data/profile';

// Extension helper functions shared between the web application and the Firebase Functions.

export function updateProfileAdventures(adventures: IAdventureSummary[] | undefined, changed: IAdventureSummary): IAdventureSummary[] | undefined {
  const existingIndex = adventures?.findIndex(a => a.id === changed.id) ?? -1;
  if (adventures !== undefined && existingIndex >= 0) {
    const existing = adventures[existingIndex];
    if (existing.name === changed.name && existing.description === changed.description &&
      existing.ownerName === changed.ownerName) {
      // No change to make
      return undefined;
    }

    const updated = [...adventures];
    updated[existingIndex].name = changed.name;
    updated[existingIndex].description = changed.description;
    updated[existingIndex].ownerName = changed.ownerName;
    return updated;
  } else {
    const created = [changed];
    if (adventures !== undefined) {
      created.push(...adventures.slice(0, maxProfileEntries - 1));
    }

    return created;
  }
}