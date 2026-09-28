import { File } from 'expo-file-system';

// Expo replaces global fetch with expo/fetch, which rejects the legacy React
// Native `{ uri, name, type }` FormData part. expo-file-system's File
// implements Blob, so it can be appended directly.
export function fileFormData(field: string, fileUri: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  form.append(field, new File(fileUri));
  return form;
}
