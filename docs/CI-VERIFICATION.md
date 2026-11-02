# CI build order / Ordine di compilazione CI

## English

Review date: 2026-11-02. A fresh checkout with `npm ci --ignore-scripts` followed by `npm run typecheck` reproduced TS2307 for `@zeroauth/core` and `@zeroauth/client`: consumers resolve types from `dist/`, which does not exist before building workspace dependencies.

The workflow now runs the root `npm run build` in its existing dependency order before typecheck and tests. Required root scripts are invoked without `--if-present`; missing scripts must fail the job. Manual workflow dispatch allows checking the current default-branch commit.

Local Windows verification on Node 24.14.0: build and typecheck passed; 34 tests passed (5 client, 12 core, 3 React, 14 server). The expected invalid-hook diagnostic is emitted by a passing negative test. This verifies the documented local build sequence, not browser authenticator compatibility, a security audit or production readiness. The remote Node 20/22/24 matrix must be checked separately after publication.

## Italiano

Revisione: 2 novembre 2026. Su una copia pulita, `npm ci --ignore-scripts` e poi `npm run typecheck` riproducono TS2307 per `@zeroauth/core` e `@zeroauth/client`: i pacchetti cercano i tipi in `dist/`, prima che esista.

La CI esegue ora `npm run build` nell'ordine delle dipendenze già previsto dal progetto, poi typecheck e test. Gli script obbligatori non usano `--if-present`: la loro assenza deve far fallire il job. Il dispatch manuale permette di verificare il commit corrente.

Prova locale Windows con Node 24.14.0: build e typecheck riusciti; 34 test passati (5 client, 12 core, 3 React, 14 server). Il messaggio invalid-hook è atteso da un test negativo che passa. Non dimostra compatibilità con autenticatori reali, audit di sicurezza o prontezza produttiva. La matrice remota Node 20/22/24 richiede controllo separato dopo la pubblicazione.

## Current runtime boundary / Requisito runtime aggiornato

EN: The first remote run passed Node 24 but exposed `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` on Node 20. The server imports SQLite directly, so its actual minimum is Node 22.13.0 (SQLite available without an experimental flag). Root/server engines and the lockfile now state that minimum; CI tests 22.13.0, latest 22 and 24 with fail-fast disabled. [Node SQLite history](https://nodejs.org/download/release/v22.23.0/docs/api/sqlite.html).

IT: Il primo run remoto supera Node 24 e fallisce su Node 20 per `node:sqlite` assente. Il server lo importa direttamente: il minimo effettivo e Node 22.13.0, che espone SQLite senza flag sperimentale. Engine, lockfile e README sono allineati; la CI prova 22.13.0, 22 corrente e 24 senza cancellare gli altri job al primo errore.
