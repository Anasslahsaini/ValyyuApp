import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export type PhotoResult = { uri: string } | { denied: true } | null;

/** Camera or library photo of a piece. `denied` when the person refused access (the screen offers Settings). */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PhotoResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { denied: true };
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: true,
    aspect: [3, 4],
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { uri: asset.uri } : null;
}

/** Copies a picked photo into the app's own folder (the picker's copy is temporary). Returns the kept file's URI. */
export async function keepPhoto(uri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'wardrobe');
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${id}-${String(Date.now())}.jpg`);
  await new File(uri).copy(target);
  return target.uri;
}

/** Deletes a kept photo; a missing file is not an error. */
export function dropPhoto(uri: string | undefined) {
  if (!uri?.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}
