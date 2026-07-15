import React, { useState } from 'react';
import { wallpaperUrl } from '../img.js';

export default function Splash({ onAction }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('menu'); // menu | create | join
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      await onAction('create-room', { name: name || 'Player 1' });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onAction('join-room', { code: joinCode.trim(), name: name || 'Player 2' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-bg" style={{ backgroundImage: `url('${wallpaperUrl('the-vix-and-the-protagonists')}')` }} />
      <h1 className="title">ABCDEF</h1>
      <p className="subtitle">A Battle Card Duel</p>

      <div className="panel">
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name" maxLength={20} />
        </div>

        {mode === 'menu' && (
          <div className="row" style={{ flexDirection: 'column' }}>
            <button className="btn" disabled={busy} onClick={handleCreate}>
              Create Game
            </button>
            <button className="btn secondary" disabled={busy} onClick={() => setMode('join')}>
              Join Game
            </button>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="row" style={{ flexDirection: 'column' }}>
            <div className="field">
              <label htmlFor="code">Room code</label>
              <input
                id="code"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7QM"
                maxLength={4}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
              />
            </div>
            <button className="btn" type="submit" disabled={busy || joinCode.trim().length !== 4}>
              Join
            </button>
            <button className="btn secondary" type="button" onClick={() => setMode('menu')}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
