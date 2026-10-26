import type { EditorProfile, ProfileId, ProfileIndex } from './types/profile';

/**
 * The whole editor is configured by one backend call.
 */

// Relative to the deploy base, so it also works under a GitHub Pages subpath.
const API_BASE = `${import.meta.env.BASE_URL}api/profiles`;

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} — ${url}`);
  }
  return (await response.json()) as T;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Malformed editor config: ${message}`);
}

const validate = (profile: EditorProfile, id: ProfileId): EditorProfile => {
  assert(profile && typeof profile === 'object', `profile "${id}" is not an object`);
  assert(profile.theme, `profile "${id}" is missing theme.json`);
  assert(profile.palette?.entries?.length, `profile "${id}" has an empty palette`);
  assert(profile.workflow?.seed, `profile "${id}" is missing workflow.seed`);
  assert(profile.chrome?.tagline, `profile "${id}" is missing chrome.tagline`);
  return profile;
};

export const loadIndex = (): Promise<ProfileIndex> => {
  return getJson<ProfileIndex>(`${API_BASE}.json`);
};

export const loadProfile = async (id: ProfileId): Promise<EditorProfile> => {
  return validate(await getJson<EditorProfile>(`${API_BASE}/${id}.json`), id);
};

export const loadProfilePart = (
  id: ProfileId,
  part: 'profile' | 'theme' | 'palette' | 'workflow',
): Promise<unknown> => {
  return getJson(`${API_BASE}/${id}/${part}.json`);
};
