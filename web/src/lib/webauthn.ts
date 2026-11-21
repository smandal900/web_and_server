// Passkey registration through the browser's WebAuthn API. The server sends options as JSON with base64url
// text where the browser needs binary data, and wants the answer back in the same style.

const toBuffer = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
};
const toBase64Url = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Ask the browser/OS to create a passkey. Returns the JSON the server expects. */
export async function createPasskey(options: Record<string, any>): Promise<Record<string, unknown>> {
  if (!('credentials' in navigator) || !window.PublicKeyCredential) throw new Error('Passkeys are not supported by this browser.');
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: toBuffer(options.challenge),
    user: { ...options.user, id: toBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map((c: { id: string }) => ({ ...c, id: toBuffer(c.id) })),
  };
  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error('No passkey was created.');
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      attestationObject: toBase64Url(response.attestationObject),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      transports: response.getTransports?.() ?? [],
    },
  };
}
