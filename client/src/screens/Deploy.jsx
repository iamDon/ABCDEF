import React, { useState } from 'react';

export default function Deploy({ view, cardsById, onAction }) {
  const [busy, setBusy] = useState(false);
  const handCards = (view.you?.cards || []).filter((c) => c.zone === 'hand');
  const alreadyDeployed = !!view.you?.activeCardId;

  async function deploy(cardId) {
    setBusy(true);
    try {
      await onAction('deploy-active', { cardId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <div className="screen-bg" style={{ backgroundImage: "url('/assets/wallpapers/the-vix-upsidedown.png')" }} />
      <h1 className="title" style={{ fontSize: '2.2rem' }}>
        Send Out Your First Card
      </h1>
      <p className="select-hint">This will be your active card on the Battlefield when the fight begins.</p>

      {alreadyDeployed ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p>Waiting for opponent to deploy...</p>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card-grid">
          {handCards.map((c) => {
            const card = cardsById.get(c.cardId);
            return (
              <div key={c.cardId} className="mini-card" onClick={() => !busy && deploy(c.cardId)}>
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
      )}
    </div>
  );
}
