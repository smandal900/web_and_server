import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'upload.chunkSizeMiB', type: 'number', label: 'Chunk size (MiB)', help: 'Large files are sent in pieces of this size.', min: 1, max: 100 },
  { path: 'upload.resumeWindowMinutes', type: 'number', label: 'Resume window (minutes)', help: 'An interrupted upload can continue within this time.', min: 1 },
];

export default function Upload() {
  return <SchemaFields fields={fields} />;
}
