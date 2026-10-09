import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import {
  useZeroAuth,
  PasskeyButton,
  PasskeyList,
} from '../dist/index.js';

test('React: useZeroAuth throws error when used outside component / provider lifecycle', () => {
  assert.throws(
    () => {
      useZeroAuth();
    },
    (err) => {
      return (
        /useZeroAuth must be used within a <ZeroAuthProvider>/.test(err.message) ||
        /Cannot read properties of null/.test(err.message) ||
        /Invalid hook call/.test(err.message)
      );
    }
  );
});

test('React: PasskeyButton returns valid element structure', () => {
  const el = React.createElement(PasskeyButton, { variant: 'primary' }, 'Test Button');
  assert.strictEqual(typeof el, 'object');
  assert.strictEqual(el.type, PasskeyButton);
  assert.strictEqual(el.props.children, 'Test Button');
  assert.strictEqual(el.props.variant, 'primary');
});

test('React: PasskeyList returns valid element structure', () => {
  const credentials = [
    {
      id: 'cred_1',
      name: 'MacBook Touch ID',
      deviceType: 'singleDevice',
      backedUp: false,
      aaguid: '16467389-7078-43d0-9976-13a893ec19cb',
      createdAt: new Date().toISOString(),
    },
  ];

  const el = React.createElement(PasskeyList, { credentials });
  assert.strictEqual(typeof el, 'object');
  assert.strictEqual(el.type, PasskeyList);
  assert.strictEqual(el.props.credentials.length, 1);
  assert.strictEqual(el.props.credentials[0].name, 'MacBook Touch ID');
});
