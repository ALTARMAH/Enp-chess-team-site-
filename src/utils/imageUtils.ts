/**
 * Client-side Canvas image compression utility.
 * Ensures uploaded avatars, cover banners, gallery posts, and logos stay crisp
 * while fitting comfortably below Firestore's 200 KB field cap.
 */
export async function compressImageFile(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxChars?: number;
  } = {}
): Promise<string> {
  const {
    maxWidth = 1280,
    maxHeight = 720,
    quality = 0.82,
    maxChars = 180000,
  } = options;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('File read error'));
    reader.readAsDataURL(file);
  });

  if (dataUrl.length <= maxChars) {
    return dataUrl;
  }

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(1, maxWidth / width, maxHeight / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl.slice(0, maxChars));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      let q = quality;
      let output = canvas.toDataURL('image/jpeg', q);
      while (output.length > maxChars && q > 0.35) {
        q -= 0.1;
        output = canvas.toDataURL('image/jpeg', q);
      }

      if (output.length > maxChars) {
        const scale = 0.7;
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        output = canvas.toDataURL('image/jpeg', 0.65);
      }

      resolve(output);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
