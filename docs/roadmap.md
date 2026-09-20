# 🗺️ Roadmap di Sviluppo di ZeroAuth

Questa roadmap delinea i passaggi sequenziali per portare ZeroAuth da concetto ad architettura produttiva completa e adottata dalla community open source.

---

## Milestone 1: Architettura, Analisi & Scaffolding (Completato)
- [x] Definizione della visione, posizionamento di mercato (Indie Hacker & Zero Cost) e principi di decentralizzazione.
- [x] Redazione specifiche di protocollo WebAuthn / FIDO2 Level 3 (`docs/architecture/02-webauthn-spec.md`).
- [x] Redazione Threat Model e mitigazioni anti-phishing (`docs/architecture/03-threat-model.md`).
- [x] Definizione dell'interfaccia `ZeroAuthStorageAdapter` (`docs/architecture/04-storage-adapters.md`).
- [x] Inizializzazione monorepo TypeScript (`packages/*`), tooling e configurazione git.
- [x] Creazione della repository remota privata su GitHub (`MRJonam91/ZeroAuth`).

---

## Milestone 2: `@zeroauth/core` (Motore Crittografico)
- [ ] Implementazione parser/encoder Base64URL e CBOR compatto (zero runtime dependencies pesanti).
- [ ] Generazione challenge crittografiche sicure con `crypto.subtle` / WebCrypto.
- [ ] Validazione `authenticatorData`, flag `UP`, `UV`, `AT`, `ED`.
- [ ] Verifica firme digitali per curve crittografiche standard (ES256, Ed25519, RS256).
- [ ] Suite di test unitari con fixture ufficiali FIDO2 / WebAuthn.

---

## Milestone 3: `@zeroauth/server` (Relying Party Server & Sessioni)
- [ ] Implementazione della classe `ZeroAuthServer` (`registerOptions`, `verifyRegistration`, `loginOptions`, `verifyAuthentication`).
- [ ] Implementazione del `MemoryStorageAdapter` per sviluppo/test.
- [ ] Implementazione dello `SqliteStorageAdapter` (supporto SQLite3 nativo / LibSQL).
- [ ] Adapter per framework web:
  - Adapter generico Request/Response (Web Standard `fetch`).
  - Middleware per **Hono**.
  - Middleware per **Express** / **Fastify**.
  - Route Handlers per **Next.js** (App Router).
- [ ] Gestione delle sessioni (JWT crittografati / cookie firmati HttpOnly).

---

## Milestone 4: `@zeroauth/client` (Browser SDK)
- [ ] Wrapper per `navigator.credentials.create()` e `navigator.credentials.get()`.
- [ ] Rilevamento automatico delle capacità del dispositivo (`PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable`).
- [ ] Supporto a **Conditional UI** (Passkeys Autofill) per suggerire la passkey direttamente nel form.
- [ ] Gestione standardizzata dei codici di errore del browser (annullamento utente, timeout, credenziale non trovata).

---

## Milestone 5: `@zeroauth/react` (Hooks & Componenti UI)
- [ ] Hook `useZeroAuth` per lo stato dell'autenticazione.
- [ ] Hook `usePasskey` per avviare la registrazione/login con 1 riga di codice.
- [ ] Componente modale headless o styled per la registrazione di passkeys secondarie (backup).
- [ ] Documentazione Storybook o playground interattivo.

---

## Milestone 6: Community, Esempi & Trazione
- [ ] Creazione di una demo full-stack funzionante (`examples/nextjs-passkey-demo`).
- [ ] Rilascio su npm sotto lo scope `@zeroauth/*`.
- [ ] Configurazione GitHub Sponsors, Buy Me a Coffee e badge donazioni per gli indie hacker.
- [ ] Apertura pubblica della repository per contributi e fork.
