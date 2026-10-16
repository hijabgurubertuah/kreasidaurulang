import { APPS_SCRIPT_URL } from '../firebaseConfig';

export const uploadImageToDrive = async (file: File): Promise<string> => {
  // Resize image
  const resizedImage = await resizeImage(file);
  const base64 = await toBase64(resizedImage);
  
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      data: base64.split(',')[1] // remove prefix
    }),
  });

  const result = await response.json();
  if (result.ok) {
    return result.url;
  } else {
    throw new Error('Gagal mengunggah gambar');
  }
};

const resizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1280;
      const scale = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85);
    };
  });
};

const toBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};
