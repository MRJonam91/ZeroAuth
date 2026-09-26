# 🗺️ Roadmap di Sviluppo di ZeroAuth

Questa roadmap delinea i passaggi dello sviluppo di ZeroAuth, dal concept iniziale al rilascio di **ZeroAuth 1.0.0 (General Availability)**.

---

## Milestone 1: Architettura, Analisi & Scaffolding (✅ Completato)
- [x] Definizione della visione, posizionamento di mercato (Indie Hacker & Zero Cost) e principi di decentralizzazione.
- [x] Redazione specifiche di protocollo WebAuthn / FIDO2 Level 3 (`docs/architecture/02-webauthn-spec.md`).
- [x] Redazione Threat Model e mitigazioni anti-phishing (`docs/architecture/03-threat-model.md`).
- [x] Definizione dell'interfaccia `ZeroAuthStorageAdapter` (`docs/architecture/04-storage-adapters.md`).
- [x] Inizializzazione monorepo TypeScript (`packages/*`), tooling e configurazione git.
- [x] Creazione della repository su GitHub (`MRJonam91/ZeroAuth`).

---

## Milestone 2: `@zeroauth/core` (Motore Crittografico) (✅ Completato)
- [x] Implementazione parser/encoder Base64URL e CBOR compatto (zero dipendenze esterne, < 150 LOC).
- [x] Generazione challenge crittografiche sicure con WebCrypto nativa (`crypto.subtle`).
- [x] Validazione `authData`, flag `UP`, `UV`, `BE`, `BS`, `AT`.
- [x] Riconoscimento hardware e modelli di authenticator via AAGUID (`lookupAAGUID`).
- [x] Verifica firme digitali per curve crittografiche standard (ES256 P-256 ed Ed25519 EdDSA).
- [x] Suite di test unitari completa su parsing CBOR ed edge cases crittografici.
- [x] Rispetto rigoroso della regola architetturale **Core < 1.500 LOC** (833 LOC totali).

---

## Milestone 3: `@zeroauth/server` (Relying Party Server & Sessioni) (✅ Completato)
- [x] Implementazione della classe `ZeroAuthServer` (`createRegistrationOptions`, `verifyRegistration`, `createAuthenticationOptions`, `verifyAuthentication`).
- [x] Implementazione del `MemoryStorageAdapter` per sviluppo e test rapidi.
- [x] Implementazione dello `SqliteStorageAdapter` con il modulo nativo `node:sqlite` di Node 24 (zero-dependency).
- [x] Implementazione del `PostgresStorageAdapter` per ambienti di produzione scalabili (`docs/postgres-schema.sql`).
- [x] Gestione crittografica delle sessioni (`SessionManager`) con token opachi a 256-bit e sliding expiration.
- [x] Universal Web Handler (`createZeroAuthHandler`) per Next.js App Router, Hono, SvelteKit, Astro, Express, Fastify.
- [x] Rate Limiter scorrevole per proteggere gli endpoint challenge contro tentativi DoS e brute-force.
- [x] API Multi-Passkey per associare più chiavi di backup allo stesso utente con rinomina e revoca.

---

## Milestone 4: `@zeroauth/client` (Browser SDK) (✅ Completato)
- [x] Wrapper per `navigator.credentials.create()` e `navigator.credentials.get()`.
- [x] Rilevamento automatico delle capacità del dispositivo (`isWebAuthnSupported`, `isConditionalUIAvailable`).
- [x] Supporto a **Conditional UI** (Passkeys Autofill) e gestione cancellazione con `AbortSignal`.
- [x] Gestione e normalizzazione standardizzata dei codici di errore del browser (`ZeroAuthClientError`).

---

## Milestone 5: `@zeroauth/react` (Hooks & Componenti UI) (✅ Completato)
- [x] Hook low-level `usePasskey()` per integrazioni personalizzate.
- [x] Context Provider globale `<ZeroAuthProvider>` e hook `useZeroAuth()` per stato utente reattivo.
- [x] Componenti UI pre-costruiti: `<PasskeyButton>` e `<PasskeyList>`.

---

## Milestone 6: v1.0.0 General Availability & Community (✅ Completato)
- [x] Demo standalone interattiva full-stack (`examples/standalone-demo`).
- [x] Bilinguismo completo in documentazione e README (Italiano e Inglese).
- [x] Configurazione canali sponsor e donazioni (.github/FUNDING.yml: GitHub Sponsors, Ko-fi, Buy Me a Coffee, PayPal).
- [x] Modello Dual-Licensing (AGPLv3 per open-source, Licenza Commerciale Proprietaria per SaaS closed-source e cessione IP).
- [x] Rilascio v1.0.0 stabile e passaggio a repository **pubblica**.

---

## 🔮 Futuro (v1.x+)
- [ ] Webhook per eventi di login / alert su nuove passkey registrate.
- [ ] Supporto PRF (Pseudo-Random Function) WebAuthn per crittografia end-to-end client-side zero-knowledge dei dati utente.
- [ ] Pacchetto per Vue / Nuxt (`@zeroauth/vue`).
