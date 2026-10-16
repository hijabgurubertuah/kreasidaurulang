export const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com)\/(?:.*\/)?(.+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  // Google Drive
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;

  return null;
};
