# 02. Specifiche WebAuthn & Protocollo di Scambio

WebAuthn (Web Authentication API) è una specifica W3C che consente alle applicazioni web di autenticare gli utenti sfruttando la crittografia asimmetrica a chiave pubblica e l'hardware dell'utente (Authenticator).

ZeroAuth implementa il ruolo di **Relying Party (RP)** in conformità con WebAuthn Level 3.

---

## 1. Algoritmi Crittografici Supportati

Per garantire la massima compatibilità e sicurezza, ZeroAuth supporta i seguenti algoritmi COSE (`COSEAlgorithmIdentifier`):

| Algoritmo | Identificatore COSE | Descrizione | Supporto Dispositivi |
| :--- | :--- | :--- | :--- |
| **ES256** | `-7` | ECDSA con curva P-256 e SHA-256 | Universale (Apple Touch/Face ID, Windows Hello, Android, YubiKey) |
| **EdDSA (Ed25519)**| `-8` | Crittografia Edwards-curve moderna e ultra-veloce | Hardware Keys recenti, WebCrypto moderno |
| **RS256** | `-257` | RSA Signature con SHA-256 | Legacy / Alcuni moduli TPM aziendali |

La preferenza predefinita negoziata da `@zeroauth/core` è `[-7, -8, -257]`.

---

## 2. Flusso di Registrazione (Attestation)

La registrazione associa una nuova chiave pubblica hardware a un account utente.

1. **Richiesta Opzioni (`generateRegistrationOptions`)**:
   - Il client invia il nome utente / identifier.
   - Il server genera:
     - Una `challenge` crittograficamente casuale (minimo 16-32 byte, base64url-encoded).
     - Informazioni sul Relying Party (`rp: { name, id }`).
     - Informazioni sull'utente (`user: { id, name, displayName }`).
     - Parametri di crittografia supportati (`pubKeyCredParams`).
     - `authenticatorSelection`:
       - `residentKey: "preferred"` o `"required"` (abilita le Discoverable Credentials / Passkeys).
       - `userVerification: "preferred"` (biometria o PIN di sblocco dispositivo).
   - Il server memorizza temporaneamente la `challenge` associata alla sessione dell'utente (con un TTL tipico di 60-120 secondi).

2. **Creazione Credenziale nel Browser (`navigator.credentials.create`)**:
   - Il client passa le opzioni alla WebAuthn API del browser.
   - L'Authenticator genera una nuova coppia di chiavi (privata e pubblica).
   - L'Authenticator restituisce:
     - `rawId`: ID univoco della credenziale.
     - `response.clientDataJSON`: Contiene `challenge`, `origin`, `type: "webauthn.create"`.
     - `response.attestationObject`: Contiene `authData` (flag, counter, AAGUID, public key codificata in CBOR/COSE) e la dichiarazione di attestazione.

3. **Verifica sul Server (`verifyRegistrationResponse`)**:
   - Decodifica del `clientDataJSON`.
   - Verifica che `type === "webauthn.create"`.
   - Verifica che la `challenge` corrisponda a quella attesa in memoria/sessione e non sia scaduta.
   - Verifica che l'`origin` coincida esattamente con l'URL dell'applicazione (protezione essenziale contro il phishing).
   - Decodifica del CBOR `attestationObject` ed estrazione di `authData`.
   - Verifica del flag `UP` (User Present) e opzionalmente `UV` (User Verified).
   - Estrazione e serializzazione della chiave pubblica e del `credentialId`.
   - Salvataggio nello storage adapter: `{ userId, credentialId, publicKey, counter, transports }`.

---

## 3. Flusso di Autenticazione (Assertion)

L'autenticazione verifica che il client possieda la chiave privata corrispondente alla chiave pubblica registrata.

1. **Richiesta Opzioni (`generateAuthenticationOptions`)**:
   - Il client richiede una challenge.
   - Se l'utente usa Conditional UI (Discoverable Passkey), `allowCredentials` può essere vuoto: il dispositivo proporrà la chiave corretta in base al dominio (`rpId`).
   - Se l'utente ha già indicato lo username, il server include in `allowCredentials` la lista dei `credentialId` noti per quell'utente.
   - Il server genera una `challenge` crittografica e la salva per la verifica successiva.

2. **Firma nel Browser (`navigator.credentials.get`)**:
   - L'utente fornisce biometria / PIN dispositivo.
   - L'Authenticator firma la challenge e i dati di contesto con la chiave privata.
   - Restituisce:
     - `id`: Credential ID utilizzato.
     - `response.authenticatorData`: Dati autenticatore e counter.
     - `response.clientDataJSON`: Contesto client e challenge.
     - `response.signature`: Firma crittografica (formato ASN.1 DER o raw WebCrypto).
     - `response.userHandle`: ID utente associato alla passkey.

3. **Verifica sul Server (`verifyAuthenticationResponse`)**:
   - Recupero della chiave pubblica registrata nel database tramite `credentialId`.
   - Verifica `type === "webauthn.get"`.
   - Verifica della `challenge` e dell'`origin`.
   - Verifica del `signCount` (signature counter): se il counter ricevuto è minore o uguale a quello salvato (a meno che non sia 0), potrebbe indicare una credenziale clonata.
   - Verifica crittografica della firma con la chiave pubblica:  
     `verify(publicKey, signature, sha256(authenticatorData + sha256(clientDataJSON)))`.
   - Aggiornamento del nuovo `signCount` a database.
   - Emissione del token di sessione (JWT, opaque session token o cookie HttpOnly firmato).
