import { SchemaFields, type Field } from '../SchemaFields';

const fields: Field[] = [{ path: 'metadata.faces.import', type: 'switch', label: 'Import faces from metadata', help: 'Read face regions that other programs wrote into the files.' }];

export default function Metadata() {
  return <SchemaFields fields={fields} />;
}
