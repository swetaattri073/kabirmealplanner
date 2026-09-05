import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

/** Resize and compress a meal photo before upload to speed up recognition. */
export async function compressMealPhoto(
  uri: string,
): Promise<{ uri: string; mimeType: string; name: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, mimeType: 'image/jpeg', name: 'meal.jpg' };
}
