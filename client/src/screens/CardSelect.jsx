import React, { useState } from 'react';
import { cardImg, wallpaperUrl } from '../img.js';

const HAND_SIZE = 5;

export default function CardSelect({ view, playableCards, onAction }) {
  const [selected, setSelected] = useState([]);
  const [confirmed, setConfirmed] = useState(false);

  function toggle(id) {
    if (confirmed) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= HAND_SIZE) return prev;
      return [...prev, id];
    });
  }

  async function confirm() {
    await onAction('select-cards', { cardIds: selected });
    setConfirmed(true);
  }

  const waitingOnOpponent = confirmed && !view.opponent?.ready;

  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <div className="screen-bg" style={{ backgroundImage: `url('${wallpaperUrl('the-full-vix')}')` }} />
      <h1 className="title" style={{ fontSize: '2.2rem' }}>
        Choose Your Hand
      </h1>
      <p className="select-hint">
        Pick exactly {HAND_SIZE} cards ({selected.length}/{HAND_SIZE} selected)
      </p>

      <div className="card-grid">
        {playableCards.map((card) => (
          <div
            key={card.id}
            className={`mini-card ${selected.includes(card.id) ? 'selected' : ''}`}
            onClick={() => toggle(card.id)}
          >
            <img src={cardImg(card)} alt={card.name} loading="lazy" />
            <div className="mini-info">
              <div className="name">{card.displayName || card.name}</div>
              <div className="stats">
                Life {card.life} · Def {card.defense}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {!confirmed ? (
          <button className="btn" disabled={selected.length !== HAND_SIZE} onClick={confirm}>
            Confirm Hand
          </button>
        ) : waitingOnOpponent ? (
          <div className="panel" style={{ textAlign: 'center' }}>
            <p>Waiting for opponent to choose their hand...</p>
            <div className="spinner" />
          </div>
        ) : (
          <p>Both players ready. Starting deployment...</p>
        )}
      </div>
    </div>
  );
}
