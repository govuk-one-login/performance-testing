declare module 'k6/x/passkeys' {
  type RelyingParty = {
    ID: string
    Name: string
    Origin: string
  }
  type Credential = Record<string, never>
  function newRelyingParty(name: string, id: string, origin: string): RelyingParty
  function newCredential(): Credential
  function createAttestationResponse(rp: RelyingParty, credential: Credential, attestationOptions: string): string
  export default { newRelyingParty, newCredential, createAttestationResponse }
}
