# 03. Threat Model & Analisi di Sicurezza

La sicurezza in ZeroAuth è progettata secondo il principio di "difesa in profondità" (Defense in Depth) e "Zero Trust". L'eliminazione delle password tradizionali e dei token inviati via e-mail o SMS azzera intere categorie di vettori d'attacco. Di seguito viene presentata la matrice di analisi delle minacce e le rispettive contromisure.

---

## Matrice delle Minacce

| Minaccia | Rischio Password Tradizionali | Mitigazione in ZeroAuth | Livello Residuo |
| :--- | :--- | :--- | :--- |
| **Phishing / Fake Domains** | **Critico** (l'utente inserisce la password su un sito clone) | **Azzerato**: La WebAuthn API del browser impone crittograficamente che la firma sia calcolata sull'effettivo `rpId` e `origin`. Il browser rifiuterà la chiave su un dominio clone (es. `zeroauth-fake.com`). | 🟢 Nullo |
| **Credential Stuffing & Brute Force** | **Critico** (attacchi su endpoint di login con dizionari) | **Azzerato**: Non esistono credenziali indovinabili; ogni autenticazione richiede una firma crittografica a 256 o 384 bit. | 🟢 Nullo |
| **Data Breach del Server** | **Grave** (tabelle hash di password compromesse) | **Minimo**: Il server memorizza solo chiavi **pubbliche**. Anche se il database viene sottratto integralmente, l'attaccante non può generare firme valide senza le chiavi private fisiche. | 🟢 Trascurabile |
| **Man-in-the-Middle (MitM)** | **Alto** (intercettazione cookie/password in transito) | **Azzerato**: I dati client (`clientDataJSON`) includono l'origin HTTPS e la challenge casuale firmata crittograficamente con il canale TLS vincolato. | 🟢 Nullo (su HTTPS) |
| **Replay Attacks** | **Alto** (riutilizzo di pacchetti di autenticazione intercettati) | **Azzerato**: Ogni challenge generata da ZeroAuth è monouso (nonce crittografico a 128 bit) con scadenza temporale (TTL < 2 minuti). La firma include la challenge. | 🟢 Nullo |
| **Clonazione Credenziali Hardware** | **Medio** | **Monitorato**: ZeroAuth verifica il `signCount` (contatore incrementale dell'authenticator). Se viene rilevato un contatore inferiore al valore memorizzato, l'accesso viene bloccato e l'account alertato. | 🟡 Basso |
| **Perdita del Dispositivo Fisico** | **Medio** (l'utente smarrisce il telefono/laptop) | **Gestito**: Supporto Passkeys sincronizzate (iCloud Keychain, Google Password Manager, Bitwarden, 1Password) e meccanismi decentralizzati di recovery. | 🟡 Basso |

---

## Strategie di Recovery Decentralizzate

Uno dei dilemmi più comuni nell'adozione passwordless è: *Cosa succede se l'utente perde il dispositivo fisico e non ha la sincronizzazione cloud delle Passkeys?*

ZeroAuth adotta un approccio a più livelli, senza obbligare all'uso di e-mail o SMS:

1. **Multi-Passkey First (Consigliato)**:
   - In fase di onboarding o impostazioni profilo, l'interfaccia sollecita l'utente a registrare un secondo dispositivo (es. smartphone + laptop, oppure YubiKey fisica).
2. **Deterministic Recovery Code (Decentralizzato)**:
   - Al momento della registrazione iniziale, ZeroAuth può generare una sequenza di parole mnemoniche (BIP-39 style) o un codice hardware di emergenza a 256-bit (visualizzato una sola volta).
   - L'hash crittografico di tale codice viene salvato come credenziale di fallback per autorizzare una nuova registrazione Passkey in caso di emergenza.
3. **Backup Flags FIDO2**:
   - ZeroAuth ispeziona i flag `BE` (Backup Eligibility) e `BS` (Backup State) restituiti dall'Authenticator per verificare se la passkey dell'utente è sincronizzata in un cloud keychain sicuro.
