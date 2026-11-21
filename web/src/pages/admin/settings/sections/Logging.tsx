import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'logging.enabled', type: 'switch', label: 'Logging' },
  {
    path: 'logging.level',
    type: 'select',
    label: 'Level',
    options: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'].map((v) => ({ value: v, label: v })),
    when: (c) => !!c.logging?.enabled,
  },
];

export default function Logging() {
  return <SchemaFields fields={fields} />;
}
