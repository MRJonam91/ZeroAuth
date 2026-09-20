# 04. Storage Adapters & Persistenza Agnostica

Per garantire che ZeroAuth possa essere utilizzato in qualsiasi stack senza vendor lock-in o costi di licenza database, il server delega la persistenza a un'interfaccia unificata: `ZeroAuthStorageAdapter`.

---

## Interfaccia Fondamentale

```typescript
export interface ZeroAuthUser {
  id: string;
  username: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZeroAuthCredential {
  id: string; // Base64URL credential ID
  userId: string;
  publicKey: Uint8Array; // Public key raw bytes or COSE format
  counter: number; // Signature counter
  transports?: Array<"usb" | "nfc" | "ble" | "internal" | "hybrid">;
  deviceType?: "singleDevice" | "multiDevice";
  backedUp?: boolean;
  name?: string; // Optional user label (es. "MacBook Pro Touch ID")
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ZeroAuthChallenge {
  challenge: string;
  userId?: string;
  type: "registration" | "authentication";
  expiresAt: Date;
}

export interface ZeroAuthStorageAdapter {
  // Gestione Utenti
  getUserById(id: string): Promise<ZeroAuthUser | null>;
  getUserByUsername(username: string): Promise<ZeroAuthUser | null>;
  createUser(user: Omit<ZeroAuthUser, "createdAt" | "updatedAt">): Promise<ZeroAuthUser>;

  // Gestione Credenziali Passkey
  getCredentialById(credentialId: string): Promise<ZeroAuthCredential | null>;
  listCredentialsByUserId(userId: string): Promise<ZeroAuthCredential[]>;
  saveCredential(credential: ZeroAuthCredential): Promise<void>;
  updateCredentialCounter(credentialId: string, counter: number): Promise<void>;
  deleteCredential(credentialId: string): Promise<void>;

  // Gestione Challenge Temporanee (TTL)
  saveChallenge(challenge: ZeroAuthChallenge): Promise<void>;
  getChallenge(challenge: string): Promise<ZeroAuthChallenge | null>;
  deleteChallenge(challenge: string): Promise<void>;
}
```

---

## Implementazioni Previste

1. **`MemoryStorageAdapter`**:
   - Ideale per test unitari, sviluppo locale istantaneo e prototipi. Nessuna installazione richiesta.
2. **`SqliteStorageAdapter`**:
   - Zero-configuration, file singolo su disco (`zeroauth.db`).
   - Perfetto per server VPS a basso costo (Hetzner, DigitalOcean da 4$/mese), Raspberry Pi, home server.
   - Compatibile con LibSQL / Turso per edge computing.
3. **`PostgresStorageAdapter`**:
   - Per applicazioni scalabili o infrastrutture cloud esistenti (Supabase Self-hosted, AWS RDS, Neon, self-hosted Docker PostgreSQL).
4. **`RedisStorageAdapter` (Opzionale)**:
   - Specifico per il caching e la validazione ad altissima velocità delle `challenges` e delle sessioni.
