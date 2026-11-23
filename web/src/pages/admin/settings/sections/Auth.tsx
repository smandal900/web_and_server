import { SchemaFields, type Field } from '../SchemaFields';

const oauth = (c: Record<string, any>) => !!c.oauth?.enabled;

const fields: Field[] = [
  { path: 'passwordLogin.enabled', type: 'switch', label: 'Password login', help: 'Turning this off without another login method locks everyone out.' },
  { path: 'passkey.enabled', type: 'switch', label: 'Passkeys' },
  { path: 'passkey.domain', type: 'text', label: 'Passkey domain', when: (c) => !!c.passkey?.enabled },
  { path: 'passkey.additionalDomains', type: 'lines', label: 'More passkey domains', when: (c) => !!c.passkey?.enabled },
  { path: 'oauth.enabled', type: 'switch', label: 'OAuth login' },
  { path: 'oauth.issuerUrl', type: 'url', label: 'Issuer URL', when: oauth },
  { path: 'oauth.clientId', type: 'text', label: 'Client ID', when: oauth },
  { path: 'oauth.clientSecret', type: 'password', label: 'Client secret', when: oauth },
  { path: 'oauth.scope', type: 'text', label: 'Scope', when: oauth },
  { path: 'oauth.signingAlgorithm', type: 'text', label: 'Signing algorithm', when: oauth },
  { path: 'oauth.profileSigningAlgorithm', type: 'text', label: 'Profile signing algorithm', when: oauth },
  { path: 'oauth.tokenEndpointAuthMethod', type: 'select', label: 'Token endpoint auth', options: [{ value: 'client_secret_post', label: 'client_secret_post' }, { value: 'client_secret_basic', label: 'client_secret_basic' }], when: oauth },
  { path: 'oauth.storageQuotaClaim', type: 'text', label: 'Storage quota claim', when: oauth },
  { path: 'oauth.roleClaim', type: 'text', label: 'Role claim', when: oauth },
  { path: 'oauth.buttonText', type: 'text', label: 'Button text', when: oauth },
  { path: 'oauth.autoRegister', type: 'switch', label: 'Create accounts automatically', when: oauth },
  { path: 'oauth.autoLaunch', type: 'switch', label: 'Go straight to the provider', when: oauth },
  { path: 'oauth.mobileOverrideEnabled', type: 'switch', label: 'Mobile redirect override', when: oauth },
  { path: 'oauth.mobileRedirectUri', type: 'url', label: 'Mobile redirect URI', when: (c) => oauth(c) && !!c.oauth?.mobileOverrideEnabled },
  { path: 'oauth.allowInsecureRequests', type: 'switch', label: 'Allow insecure (http) requests', when: oauth },
  { path: 'oauth.timeout', type: 'number', label: 'Timeout (ms)', min: 1000, when: oauth },
];

export default function Auth() {
  return <SchemaFields fields={fields} />;
}
