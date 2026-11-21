import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [
  { path: 'server.externalDomain', type: 'url', label: 'External domain', help: 'Used in links to shared albums and in emails.' },
  { path: 'server.loginPageMessage', type: 'textarea', label: 'Login page message', help: 'Shown above the login form.' },
  { path: 'server.publicUsers', type: 'switch', label: 'Show users to each other', help: 'Let users see everyone when choosing who to share with.' },
];

export default function Server() {
  return <SchemaFields fields={fields} />;
}
