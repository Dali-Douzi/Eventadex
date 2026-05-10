/**
 * Resolve an image path to a full URL.
 *
 * Images stored before the Cloudinary migration are relative paths like:
 *   /uploads/logos/logo-orgId-timestamp.png
 *
 * Images stored after migration are absolute Cloudinary URLs like:
 *   https://res.cloudinary.com/cloud/image/upload/v1/registrations/…
 *
 * This function handles both transparently so old data keeps working.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path}`;
}
