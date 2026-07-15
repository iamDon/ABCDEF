import React, { useState } from 'react';
import { cardImg, wallpaperUrl, CARD_BACK } from '../img.js';

function Bar({ value, max, className }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar-track">
      <div className={`bar-fill ${className || ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Chips({ items, tone }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="chip-row">
      {items.map((c, i) => (
        <span key={i} className={`chip ${tone || ''}`}>
          {c}
        </span>
      ))}
    </div>
  );
}

function ActiveCardPanel({ label, cardId, state, card, effectiveDefense, statuses, pending }) {
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
  const defBoosted = effectiveDefense != null && effectiveDefense !== state.defense;
  return (
    <div className="active-card-display">
      <img src={cardImg(card)} alt={card.name} />
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
            {defBoosted ? `${effectiveDefense} (${state.defense})` : `${state.defense}/${state.maxDefense}`}
          </span>
        </div>
        <Bar value={state.defense} max={state.maxDefense} className="defense" />
        <Chips items={statuses} />
        <Chips items={(pending || []).map((p) => `⏳ ${p.label} in ${p.turnsLeft}`)} tone="pending" />
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
          <img key={i} className="thumb back" src={CARD_BACK} alt="hidden card" />
        ) : (
          <img
            key={it.cardId}
            className={`thumb ${it.dead ? 'dead' : ''}`}
            src={cardImg(cardsById.get(it.cardId))}
            alt={cardsById.get(it.cardId)?.name}
            title={cardsById.get(it.cardId)?.name}
          />
        )
      )}
    </div>
  );
}

function ResultsBanner({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="results-banner">
      {events.map((e, i) => {
        if (e.kind === 'coins') {
          return (
            <div key={i} className="roll-results">
              {e.results.map((r, j) => (
                <span key={j} className={`roll-chip ${r === 'Heads' ? 'heads' : 'tails'}`}>
                  {r === 'Heads' ? 'H' : 'T'}
                </span>
              ))}
            </div>
          );
        }
        if (e.kind === 'die') {
          return (
            <span key={i} className="roll-chip die">
              d{e.sides}: {e.roll}
            </span>
          );
        }
        if (e.kind === 'damage' || e.kind === 'heal') {
          return (
            <span key={i} className={`result-text ${e.kind}`}>
              {e.text}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function Battle({ view, cardsById, onAction }) {
  const [busy, setBusy] = useState(false);
  const [confirmSlot, setConfirmSlot] = useState(null); // slot being confirmed
  const [needsDice, setNeedsDice] = useState(false);
  const [lastEvents, setLastEvents] = useState(null);
  const [revealedCards, setRevealedCards] = useState(null); // card ids from May's Scout Ahead

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
  const canAct = isMyTurn && !you?.actedThisTurn && !view.offer && !needsRedeploy;

  async function quickRoll(kind, sides) {
    setBusy(true);
    try {
      const res = await onAction('roll', { kind, count: 1, sides });
      setLastEvents(
        kind === 'coin'
          ? [{ kind: 'coins', results: res.results }]
          : [{ kind: 'die', sides, roll: res.results[0] }]
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmMove(slot, diceSides) {
    setBusy(true);
    try {
      const inputs = diceSides ? { sides: diceSides } : {};
      const res = await onAction('use-move', { slot, inputs });
      setLastEvents(res.events);
      const reveal = (res.events || []).find((e) => e.kind === 'reveal');
      if (reveal) setRevealedCards(reveal.cards);
      setConfirmSlot(null);
      setNeedsDice(false);
    } catch (err) {
      if (err.needsInput === 'diceChoice') {
        setNeedsDice(true); // keep the sheet open, show dice choice
      } else {
        setConfirmSlot(null);
        setNeedsDice(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function doEndTurn() {
    setBusy(true);
    try {
      await onAction('end-turn', {});
      setLastEvents(null);
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

  async function doRespondOffer(accept) {
    setBusy(true);
    try {
      await onAction('respond-offer', { accept });
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
          style={{ backgroundImage: `url('${wallpaperUrl(won ? 'the-main-protagonists' : 'the-vix')}')` }}
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

  const confirmMoveData = confirmSlot != null ? youActiveCard?.moves.find((m) => m.slot === confirmSlot) : null;

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

        {/* Opponent */}
        <div className="player-zone">
          <ActiveCardPanel
            label={opp?.name || 'Opponent'}
            cardId={opp?.activeCardId}
            state={oppActiveState}
            card={oppActiveCard}
            effectiveDefense={opp?.effectiveDefense}
            statuses={opp?.statuses}
            pending={opp?.pending}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <ZoneStrip
              label={`${opp?.name || 'Opponent'}'s Hand (hidden)`}
              items={Array.from({ length: opp?.handCount || 0 })}
              cardsById={cardsById}
              faceDown
            />
            <ZoneStrip label="Graveyard" items={oppGrave} cardsById={cardsById} />
          </div>
        </div>

        <ResultsBanner events={lastEvents} />

        {needsRedeploy && (
          <div className="panel">
            <h3>Your active card was defeated. Send out a new one:</h3>
            <div className="card-grid">
              {yourHand.map((c) => {
                const card = cardsById.get(c.cardId);
                return (
                  <div key={c.cardId} className="mini-card" onClick={() => !busy && doRedeploy(c.cardId)}>
                    <img src={cardImg(card)} alt={card.name} />
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

        {/* Moves — tap to use */}
        {!needsRedeploy && youActiveCard && (
          <div className="moves-panel">
            <div className="moves-hint">
              {canAct ? 'Tap a move to use it (this uses your turn)' : isMyTurn ? 'Turn used' : `Waiting for ${opp?.name}...`}
            </div>
            {youActiveCard.moves.map((m) => {
              const remaining = you.movesRemaining?.[m.slot];
              const exhausted = remaining === 0;
              return (
                <button
                  key={m.slot}
                  className={`move-btn ${!canAct || exhausted ? 'disabled' : ''}`}
                  disabled={!canAct || exhausted || busy}
                  onClick={() => {
                    setConfirmSlot(m.slot);
                    // "Roll a d6 or d10" moves need the player to pick a die up front
                    setNeedsDice(/d6 or a?\s*d10/i.test(m.text));
                  }}
                >
                  <div className="move-head">
                    <span>
                      <span className={`move-color-dot ${m.color || 'unknown'}`} />
                      <strong>{m.name}</strong>
                    </span>
                    <span className="move-uses">
                      {m.usesLimit ? (exhausted ? 'Used up' : `${remaining} left`) : ''}
                    </span>
                  </div>
                  <div className="move-text">{m.text}</div>
                </button>
              );
            })}
            {youActiveCard.ability && (
              <div className="ability-box">
                {youActiveCard.name}'s Ability: {youActiveCard.ability}
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="quick-bar">
          <button className="btn small secondary" disabled={busy || view.phase !== 'battle'} onClick={() => quickRoll('coin')}>
            🪙 Flip Coin
          </button>
          <button className="btn small secondary" disabled={busy || view.phase !== 'battle'} onClick={() => quickRoll('dice', 6)}>
            🎲 Roll d6
          </button>
          <button className="btn small secondary" disabled={busy || view.phase !== 'battle'} onClick={() => quickRoll('dice', 10)}>
            🎲 Roll d10
          </button>
          <button className="btn small" disabled={!canAct || busy} onClick={doEndTurn}>
            Pass Turn
          </button>
        </div>

        {/* You */}
        <div className="player-zone">
          <ActiveCardPanel
            label={you?.name || 'You'}
            cardId={you?.activeCardId}
            state={youActiveState}
            card={youActiveCard}
            effectiveDefense={you?.effectiveDefense}
            statuses={you?.statuses}
            pending={you?.pending}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <ZoneStrip label="Your Hand (only you see these)" items={yourHand} cardsById={cardsById} />
            <ZoneStrip label="Graveyard" items={yourGrave} cardsById={cardsById} />
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

      {/* Move confirm sheet */}
      {confirmMoveData && (
        <div className="modal-overlay" onClick={() => !busy && setConfirmSlot(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>
              <span className={`move-color-dot ${confirmMoveData.color || 'unknown'}`} />
              {confirmMoveData.name}
            </h3>
            <p className="move-text">{confirmMoveData.text}</p>
            {needsDice ? (
              <>
                <p style={{ color: 'var(--gold)' }}>This move needs a die. Choose one:</p>
                <div className="modal-actions">
                  <button className="btn" disabled={busy} onClick={() => confirmMove(confirmSlot, 6)}>
                    Roll d6
                  </button>
                  <button className="btn" disabled={busy} onClick={() => confirmMove(confirmSlot, 10)}>
                    Roll d10
                  </button>
                </div>
              </>
            ) : (
              <div className="modal-actions">
                <button className="btn" disabled={busy} onClick={() => confirmMove(confirmSlot)}>
                  Use Move
                </button>
                <button className="btn secondary" disabled={busy} onClick={() => setConfirmSlot(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Xinyu offer */}
      {view.offer && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <h3>{view.offer.fromName} offers peace!</h3>
            <p className="move-text">
              {view.offer.moveName}: Accept, and all battlefield cards return to hand (both sides redeploy). Refuse, and your
              active card takes a {view.offer.refuseDamage}-damage attack.
            </p>
            <div className="modal-actions">
              <button className="btn" disabled={busy} onClick={() => doRespondOffer(true)}>
                Accept — return to hand
              </button>
              <button className="btn secondary" disabled={busy} onClick={() => doRespondOffer(false)}>
                Refuse — take the blast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* May's Scout Ahead reveal */}
      {revealedCards && (
        <div className="modal-overlay" onClick={() => setRevealedCards(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Opponent's hand revealed!</h3>
            <div className="reveal-grid">
              {revealedCards.map((id) => {
                const card = cardsById.get(id);
                return (
                  <div key={id} className="reveal-card">
                    <img src={cardImg(card)} alt={card.name} />
                    <span>{card.displayName || card.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setRevealedCards(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
