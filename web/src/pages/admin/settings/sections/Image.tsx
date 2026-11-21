import { SchemaFields, type Field } from '../SchemaFields';

const format = [
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG' },
];

const fields: Field[] = [
  { path: 'image.thumbnail.size', type: 'number', label: 'Thumbnail size (px)', min: 50 },
  { path: 'image.thumbnail.format', type: 'select', label: 'Thumbnail format', options: format },
  { path: 'image.thumbnail.quality', type: 'number', label: 'Thumbnail quality', min: 1, max: 100 },
  { path: 'image.preview.size', type: 'number', label: 'Preview size (px)', min: 100 },
  { path: 'image.preview.format', type: 'select', label: 'Preview format', options: format },
  { path: 'image.preview.quality', type: 'number', label: 'Preview quality', min: 1, max: 100 },
  { path: 'image.fullsize.enabled', type: 'switch', label: 'Generate full-size images', help: 'For formats browsers cannot show (RAW, HEIC).' },
  { path: 'image.fullsize.format', type: 'select', label: 'Full-size format', options: format, when: (c) => !!c.image?.fullsize?.enabled },
  { path: 'image.fullsize.quality', type: 'number', label: 'Full-size quality', min: 1, max: 100, when: (c) => !!c.image?.fullsize?.enabled },
  { path: 'image.colorspace', type: 'select', label: 'Colour space', options: [{ value: 'p3', label: 'Display P3' }, { value: 'srgb', label: 'sRGB' }] },
  { path: 'image.extractEmbedded', type: 'switch', label: 'Prefer embedded previews', help: 'Faster for RAW files.' },
  { path: 'image.previewOnDemand.enabled', type: 'switch', label: 'Create previews on demand' },
  { path: 'image.previewOnDemand.retentionDays', type: 'number', label: 'Keep on-demand previews (days)', min: 1, when: (c) => !!c.image?.previewOnDemand?.enabled },
];

export default function ImageSettings() {
  return <SchemaFields fields={fields} />;
}
