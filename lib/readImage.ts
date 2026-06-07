// Read an image File into a data URL + its natural dimensions.
export function readImageFile(
  file: File
): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new window.Image();
      img.onload = () =>
        resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not load the image."));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
