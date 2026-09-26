-- ZeroAuth Production PostgreSQL Schema

CREATE TABLE IF NOT EXISTS zeroauth_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zeroauth_credentials (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES zeroauth_users(id) ON DELETE CASCADE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports JSONB,
  device_type VARCHAR(32),
  backed_up BOOLEAN DEFAULT FALSE,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_zeroauth_credentials_user ON zeroauth_credentials(user_id);

CREATE TABLE IF NOT EXISTS zeroauth_challenges (
  challenge VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(64),
  type VARCHAR(32) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zeroauth_challenges_expires ON zeroauth_challenges(expires_at);

CREATE TABLE IF NOT EXISTS zeroauth_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES zeroauth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zeroauth_sessions_expires ON zeroauth_sessions(expires_at);
