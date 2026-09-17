/**
 * Native Camera Bridge — receipt/document capture (offline-first)
 * ------------------------------------------------------------------
 * Uses expo-camera (to be installed) + expo-media-library for offline capture.
 * Returns base64-encoded JPEG so the WebView can preview without upload.
 *
 * Install:
 *   npx expo install expo-camera expo-image-picker expo-media-library
 *
 * Then in app.config.js, add the plugin:
 *   ["expo-camera", { cameraPermission: "Verda needs camera access to capture receipts and field documents." }],
 *   ["expo-media-library", { photosPermission: "Verda saves captured documents to your photo library.", savePhotosPermission: false }],
 */
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export interface CapturedImage {
  uri: string;        // local file:// URI on device
  base64: string;     // base64-encoded JPEG for WebView preview
  width: number;
  height: number;
  sizeKb: number;
  capturedAt: string; // ISO timestamp
}

/**
 * Open the camera, capture a single photo, return base64.
 * Falls back to image library picker if camera permission denied.
 */
export async function captureReceipt(): Promise<CapturedImage | null> {
  // 1) Request camera permission
  const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
  if (camStatus !== "granted") {
    throw new Error("Camera permission denied. Enable it in Settings to capture receipts.");
  }

  // 2) Launch camera
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,           // compress for offline-friendly upload
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  // 3) Read file size if local
  let sizeKb = 0;
  if (asset.uri && Platform.OS === "ios") {
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      sizeKb = Math.round((info.size ?? 0) / 1024);
    } catch { /* ignore */ }
  } else {
    sizeKb = Math.round((asset.fileSize ?? 0) / 1024);
  }

  return {
    uri: asset.uri,
    base64: asset.base64 ?? "",
    width: asset.width,
    height: asset.height,
    sizeKb,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Pick an existing image from the gallery (for re-attaching a saved receipt).
 */
export async function pickFromGallery(): Promise<CapturedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Photo library permission denied.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    base64: asset.base64 ?? "",
    width: asset.width,
    height: asset.height,
    sizeKb: Math.round((asset.fileSize ?? 0) / 1024),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Save a base64 image to the device's document directory for offline reference.
 * Returns the local file:// URI.
 */
export async function saveOffline(
  base64: string,
  filename: string
): Promise<string> {
  const path = `${FileSystem.documentDirectory}verda/${filename}`;
  const dir = `${FileSystem.documentDirectory}verda`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

/**
 * List all offline-saved images in the verda/ directory.
 */
export async function listOfflineImages(): Promise<{ uri: string; sizeKb: number }[]> {
  const dir = `${FileSystem.documentDirectory}verda`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];
  const files = await FileSystem.readDirectoryAsync(dir);
  const out: { uri: string; sizeKb: number }[] = [];
  for (const f of files) {
    const uri = `${dir}/${f}`;
    const fi = await FileSystem.getInfoAsync(uri);
    out.push({ uri, sizeKb: Math.round((fi.size ?? 0) / 1024) });
  }
  return out;
}
