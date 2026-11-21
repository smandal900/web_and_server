import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'newVersionCheck.enabled', type: 'switch', label: 'Check for new versions', help: 'Contacts the release server now and then.' },
  { path: 'newVersionCheck.channel', type: 'select', label: 'Release channel', options: [{ value: 'stable', label: 'Stable' }, { value: 'prerelease', label: 'Pre-release' }], when: (c) => !!c.newVersionCheck?.enabled },
];

export default function VersionCheck() {
  return <SchemaFields fields={fields} />;
}
