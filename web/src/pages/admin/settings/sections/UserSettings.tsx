import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'user.deleteDelay', type: 'number', label: 'Delay before deleting a removed user (days)', help: 'A deleted account can be restored until this time passes.', min: 0 },
];

export default function UserSettings() {
  return <SchemaFields fields={fields} />;
}
