import React, { useState } from 'react';

export interface PasskeyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  loadingText?: string;
  icon?: boolean;
}

/**
 * Modern, styled Passkey Button with built-in biometric icon
 */
export function PasskeyButton({
  children = 'Sign in with Passkey',
  variant = 'primary',
  loadingText = 'Authenticating...',
  icon = true,
  disabled,
  style,
  ...props
}: PasskeyButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 18px',
    fontSize: '0.95rem',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease-in-out',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    ...(variant === 'primary' && {
      backgroundColor: '#10b981',
      color: '#ffffff',
    }),
    ...(variant === 'secondary' && {
      backgroundColor: '#1f2937',
      color: '#f9fafb',
    }),
    ...(variant === 'outline' && {
      backgroundColor: 'transparent',
      border: '1px solid #374151',
      color: '#f3f4f6',
    }),
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled} {...props}>
      {icon && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 0 0-10 10c0 3.2 1.5 6 3.8 8" />
          <path d="M12 6a6 6 0 0 0-6 6c0 1.8.8 3.5 2.1 4.6" />
          <path d="M12 10a2 2 0 0 0-2 2c0 .9.4 1.7 1 2.2" />
          <path d="M16 12a4 4 0 0 1-.8 2.4" />
          <path d="M19 12a7 7 0 0 1-1.8 4.7" />
          <path d="M22 12c0 2.5-1 4.8-2.6 6.5" />
        </svg>
      )}
      {children}
    </button>
  );
}

export interface PasskeyItem {
  id: string;
  name?: string;
  deviceType?: string;
  backedUp?: boolean;
  aaguid?: string;
  createdAt: string | Date;
  lastUsedAt?: string | Date;
}

export interface PasskeyListProps {
  credentials: PasskeyItem[];
  onRename?: (credentialId: string, newName: string) => Promise<void>;
  onDelete?: (credentialId: string) => Promise<void>;
}

/**
 * Interactive list displaying an account's registered Passkeys with rename and delete options
 */
export function PasskeyList({ credentials, onRename, onDelete }: PasskeyListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleStartEdit = (cred: PasskeyItem) => {
    setEditingId(cred.id);
    setEditName(cred.name || 'Passkey Device');
  };

  const handleSaveEdit = async (id: string) => {
    if (onRename && editName.trim()) {
      await onRename(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {credentials.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No passkeys registered yet.
        </div>
      ) : (
        credentials.map((cred) => (
          <div
            key={cred.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '8px',
            }}
          >
            <div>
              {editingId === cred.id ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      background: '#0b1120',
                      border: '1px solid #374151',
                      color: '#fff',
                      borderRadius: '4px',
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(cred.id)}
                    style={{ padding: '4px 10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ padding: '4px 10px', background: '#374151', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, color: '#f3f4f6' }}>
                    {cred.name || 'Passkey Device'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>
                    Added {new Date(cred.createdAt).toLocaleDateString()}
                    {cred.backedUp ? ' • Synced Cloud Keychain' : ' • Device-bound'}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {editingId !== cred.id && onRename && (
                <button
                  onClick={() => handleStartEdit(cred)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Rename
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(cred.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
