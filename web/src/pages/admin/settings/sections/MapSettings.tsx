import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'map.enabled', type: 'switch', label: 'Map', help: 'Show the Map page and location pickers.' },
  { path: 'map.lightStyle', type: 'url', label: 'Light theme style URL', help: 'A MapLibre style.json address.', when: (c) => !!c.map?.enabled },
  { path: 'map.darkStyle', type: 'url', label: 'Dark theme style URL', when: (c) => !!c.map?.enabled },
  { path: 'reverseGeocoding.enabled', type: 'switch', label: 'Reverse geocoding', help: 'Turn coordinates into city and country names.' },
];

export default function MapSettings() {
  return <SchemaFields fields={fields} />;
}
