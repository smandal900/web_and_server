import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'trash.enabled', type: 'switch', label: 'Trash', help: 'Deleted pictures wait in the trash instead of disappearing at once.' },
  { path: 'trash.days', type: 'number', label: 'Days to keep', help: 'After this many days, trashed pictures are deleted for good.', min: 0, when: (c) => !!c.trash?.enabled },
];

export default function Trash() {
  return <SchemaFields fields={fields} />;
}
