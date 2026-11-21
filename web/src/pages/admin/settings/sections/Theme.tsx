import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [{ path: 'theme.customCss', type: 'textarea', label: 'Custom CSS', help: 'Style rules added to every page. Use with care.' }];

export default function Theme() {
  return <SchemaFields fields={fields} />;
}
