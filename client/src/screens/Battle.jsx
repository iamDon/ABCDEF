import React, { useMemo, useState } from 'react';

function Bar({ value, max, className }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar-track">
      <div className={`bar-fill ${className || ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ActiveCardPanel({ label, cardId, state, card }) {
  if (!cardId || !card) {
    return (
      <div className="active-card-display">
        <div>
          <div className="stat-line">
            <strong>{label}</strong>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No active card</p>
        </div>
      </div>
    );
  }
  return (
    <div className="active-card-display">
      <img src={`/${card.image}`} alt={card.name} />
      <div style={{ flex: 1 }}>
        <div className="stat-line">
          <strong>{card.displayName || card.name}</strong>
          <span>{label}</span>
        </div>
        <div className="stat-line">
          <span>Life</span>
          <span>
            {state.life}/{state.maxLife}
          </span>
        </div>
        <Bar value={state.life} max={state.maxLife} />
        <div className="stat-line">
          <span>Defense</span>
          <span>
            {state.defense}/{state.maxDefense}
          </span>
        </div>
        <Bar value={state.defense} max={state.maxDefense} className="defense" />
      </div>
    </div>
  );
}

function ZoneStrip({ label, items, cardsById, faceDown }) {
  return (
    <div className="zone-strip">
      <span className="zone-label">{label}</span>
      {items.length === 0 && <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>—</span>}
      {items.map((it, i) =>
        faceDown ? (
          <img key={i} className="thumb back" src="/assets/cards/card-back.png" alt="face-down" />
        ) : (
          <img
            key={it.cardId}
            className={`thumb ${it.dead ? 'dead' : ''}`}
            src={`/${cardsById.get(it.cardId)?.image}`}
            alt={cardsById.get(it.cardId)?.name}
            title={cardsById.get(it.cardId)?.name}
          />
        )
      )}
    </div>
  );
}

export default function Battle({ view, cardsById, onAction }) {
  const [rollKind, setRollKind] = useState('coin');
  const [rollCount, setRollCount] = useState(1);
  const [diceSides, setDiceSides] = useState(6);
  const [rollResults, setRollResults] = useState(null);

  const [target, setTarget] = useState('opponent'); // 'opponent' | 'mine'
  const [amount, setAmount] = useState(0);
  const [ignoreDefense, setIgnoreDefense] = useState(false);
  const [defenseDelta, setDefenseDelta] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isMyTurn = view.turnPlayerIndex === view.you?.index;
  const you = view.you;
  const opp = view.opponent;

  const youActiveCard = you?.activeCardId ? cardsById.get(you.activeCardId) : null;
  const youActiveState = you?.cards.find((c) => c.cardId === you.activeCardId);
  const oppActiveCard = opp?.activeCardId ? cardsById.get(opp.activeCardId) : null;
  const oppActiveState = opp?.cards.find((c) => c.cardId === opp.activeCardId);

  const yourHand = (you?.cards || []).filter((c) => c.zone === 'hand');
  const yourGrave = (you?.cards || []).filter((c) => c.zone === 'graveyard').map((c) => ({ cardId: c.cardId, dead: true }));
  const oppGrave = (opp?.cards || []).filter((c) => c.zone === 'graveyard').map((c) => ({ cardId: c.cardId, dead: true }));

  const needsRedeploy = view.phase === 'battle' && you && !you.activeCardId && yourHand.length > 0;

  const targetPlayerIndex = target === 'opponent' ? opp?.index : you?.index;
  const targetCardId = target === 'opponent' ? opp?.activeCardId : you?.activeCardId;

  async function doRoll() {
    setBusy(true);
    try {
      const res = await onAction('roll', { kind: rollKind, count: rollCount, sides: diceSides });
      setRollResults(res.results);
    } finally {
      setBusy(false);
    }
  }

  async function doDamage() {
    setBusy(true);
    try {
      await onAction('apply-damage', { targetPlayerIndex, targetCardId, amount: Number(amount), ignoreDefense });
    } finally {
      setBusy(false);
    }
  }

  async function doHeal() {
    setBusy(true);
    try {
      await onAction('apply-heal', { targetPlayerIndex, targetCardId, amount: Number(amount) });
    } finally {
      setBusy(false);
    }
  }

  async function doDefense(sign) {
    setBusy(true);
    try {
      await onAction('adjust-defense', { targetPlayerIndex, targetCardId, delta: sign * Number(defenseDelta) });
    } finally {
      setBusy(false);
    }
  }

  async function doSkip() {
    setBusy(true);
    try {
      await onAction('set-skip-next-turn', { targetPlayerIndex });
    } finally {
      setBusy(false);
    }
  }

  async function doNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await onAction('log-note', { text: note });
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  async function doEndTurn() {
    setBusy(true);
    try {
      await onAction('end-turn', {});
    } finally {
      setBusy(false);
    }
  }

  async function doRedeploy(cardId) {
    setBusy(true);
    try {
      await onAction('select-next-active', { cardId });
    } finally {
      setBusy(false);
    }
  }

  if (view.phase === 'game-over') {
    const won = view.winnerIndex === you?.index;
    return (
      <div className="screen">
        <div
          className="screen-bg"
          style={{ backgroundImage: `url('/assets/wallpapers/${won ? 'the-main-protagonists' : 'the-vix'}.png')` }}
        />
        <div className="panel game-over-panel">
          <h1 className="title" style={{ fontSize: '2.5rem' }}>
            {won ? 'Victory!' : 'Defeat'}
          </h1>
          <p>{view.log[view.log.length - 1]?.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', alignItems: 'stretch' }}>
      <div className="battle-layout">
        <div className="top-bar">
          <span>
            Room <strong>{view.code}</strong>
          </span>
          <span className={`myst-badge ${view.mystLevel}`}>{view.mystLevel} Myst</span>
          <span className={`turn-indicator ${isMyTurn ? 'mine' : ''}`}>{isMyTurn ? 'Your Turn' : `${opp?.name}'s Turn`}</span>
        </div>

        <div className="player-zone">
          <ActiveCardPanel label={opp?.name || 'Opponent'} cardId={opp?.activeCardId} state={oppActiveState} card={oppActiveCard} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <ZoneStrip label="Hand" items={Array.from({ length: opp?.handCount || 0 })} cardsById={cardsById} faceDown />
            <ZoneStrip label="Graveyard" items={oppGrave} cardsById={cardsById} />
            {opp?.skipNextTurn && <span style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>Will lose next turn</span>}
          </div>
        </div>

        {oppActiveCard?.ability && <div className="ability-box">{oppActiveCard.name}'s Ability: {oppActiveCard.ability}</div>}

        {needsRedeploy && (
          <div className="panel">
            <h3>Your active card was defeated. Send out a new one:</h3>
            <div className="card-grid">
              {yourHand.map((c) => {
                const card = cardsById.get(c.cardId);
                return (
                  <div key={c.cardId} className="mini-card" onClick={() => !busy && doRedeploy(c.cardId)}>
                    <img src={`/${card.image}`} alt={card.name} />
                    <div className="mini-info">
                      <div className="name">{card.displayName || card.name}</div>
                      <div className="stats">
                        Life {c.life} · Def {c.defense}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!needsRedeploy && youActiveCard && (
          <>
            <div className="moves-panel">
              {youActiveCard.moves.map((m) => (
                <div key={m.slot} className="move-card">
                  <div className="move-head">
                    <span>
                      <span className={`move-color-dot ${m.color || 'unknown'}`} />
                      <strong>{m.name}</strong>
                      {m.usesLimit ? ` (Use ${m.usesLimit}x)` : ''}
                    </span>
                    <button
                      className="btn small secondary"
                      disabled={!isMyTurn || busy}
                      onClick={() => onAction('log-note', { text: `used ${m.name}` })}
                    >
                      Announce Move
                    </button>
                  </div>
                  <div className="move-text">{m.text}</div>
                </div>
              ))}
              {youActiveCard.ability && <div className="ability-box">{youActiveCard.name}'s Ability: {youActiveCard.ability}</div>}
            </div>

            <div className="tool-panel">
              <strong>Resolution Tools</strong>
              <div className="tool-row">
                <select value={rollKind} onChange={(e) => setRollKind(e.target.value)}>
                  <option value="coin">Coin</option>
                  <option value="dice">Dice</option>
                </select>
                {rollKind === 'dice' && (
                  <select value={diceSides} onChange={(e) => setDiceSides(Number(e.target.value))}>
                    <option value={6}>d6</option>
                    <option value={10}>d10</option>
                  </select>
                )}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rollCount}
                  onChange={(e) => setRollCount(e.target.value)}
                  style={{ width: '4rem' }}
                />
                <button className="btn small" disabled={!isMyTurn || busy} onClick={doRoll}>
                  Roll
                </button>
                {rollResults && (
                  <div className="roll-results">
                    {rollResults.map((r, i) => (
                      <span key={i} className="roll-chip">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="tool-row">
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="opponent">Target: {opp?.name || 'Opponent'}</option>
                  <option value="mine">Target: {you?.name || 'Me'}</option>
                </select>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '5rem' }} />
                <label style={{ fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={ignoreDefense} onChange={(e) => setIgnoreDefense(e.target.checked)} /> Ignore Defense
                </label>
                <button className="btn small" disabled={!isMyTurn || busy} onClick={doDamage}>
                  Apply Damage
                </button>
                <button className="btn small secondary" disabled={!isMyTurn || busy} onClick={doHeal}>
                  Apply Heal
                </button>
              </div>

              <div className="tool-row">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Defense change for target above:</span>
                <input
                  type="number"
                  value={defenseDelta}
                  onChange={(e) => setDefenseDelta(e.target.value)}
                  style={{ width: '5rem' }}
                />
                <button className="btn small secondary" disabled={!isMyTurn || busy} onClick={() => doDefense(1)}>
                  +Defense
                </button>
                <button className="btn small secondary" disabled={!isMyTurn || busy} onClick={() => doDefense(-1)}>
                  -Defense
                </button>
                <button className="btn small secondary" disabled={!isMyTurn || busy} onClick={doSkip}>
                  Target Loses Next Turn
                </button>
              </div>

              <div className="tool-row">
                <input
                  type="text"
                  placeholder="Log a note for anything else this move does..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn small secondary" disabled={busy} onClick={doNote}>
                  Add Note
                </button>
              </div>

              <div className="tool-row">
                <button className="btn" disabled={!isMyTurn || busy} onClick={doEndTurn}>
                  End Turn
                </button>
              </div>
            </div>
          </>
        )}

        <div className="player-zone">
          <ActiveCardPanel label={you?.name || 'You'} cardId={you?.activeCardId} state={youActiveState} card={youActiveCard} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <ZoneStrip label="Hand" items={yourHand} cardsById={cardsById} />
            <ZoneStrip label="Graveyard" items={yourGrave} cardsById={cardsById} />
            {you?.skipNextTurn && <span style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>You'll lose your next turn</span>}
          </div>
        </div>

        <div className="log-panel">
          {view.log.map((l, i) => (
            <div key={i} className="log-line">
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
