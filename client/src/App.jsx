import React, { useEffect, useState, useCallback } from 'react';
import { socket, emitAsync } from './socket.js';
import Splash from './screens/Splash.jsx';
import Lobby from './screens/Lobby.jsx';
import CardSelect from './screens/CardSelect.jsx';
import Deploy from './screens/Deploy.jsx';
import Battle from './screens/Battle.jsx';

export default function App() {
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [cardsById, setCardsById] = useState(null);
  const [playableCards, setPlayableCards] = useState(null);

  useEffect(() => {
    fetch('/api/cards')
      .then((r) => r.json())
      .then(({ all, playable }) => {
        const map = new Map(all.map((c) => [c.id, c]));
        setCardsById(map);
        setPlayableCards(playable);
      })
      .catch(() => setError('Could not load card data from the server.'));
  }, []);

  useEffect(() => {
    function onState(v) {
      setView(v);
    }
    function onDisconnect() {
      setError('Disconnected from server. Trying to reconnect...');
    }
    function onConnect() {
      setError((e) => (e.startsWith('Disconnected') ? '' : e));
    }
    socket.on('state-update', onState);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('state-update', onState);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, []);

  const runAction = useCallback(async (event, payload) => {
    try {
      setError('');
      return await emitAsync(event, payload);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  if (!cardsById || !playableCards) {
    return (
      <div className="screen">
        <div className="spinner" />
      </div>
    );
  }

  let screen;
  if (!view) {
    screen = <Splash onAction={runAction} />;
  } else if (view.phase === 'waiting') {
    screen = <Lobby view={view} />;
  } else if (view.phase === 'card-select') {
    screen = <CardSelect view={view} playableCards={playableCards} onAction={runAction} />;
  } else if (view.phase === 'deploy') {
    screen = <Deploy view={view} cardsById={cardsById} onAction={runAction} />;
  } else {
    screen = <Battle view={view} cardsById={cardsById} onAction={runAction} />;
  }

  return (
    <>
      {error && (
        <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <div className="error-banner">{error}</div>
        </div>
      )}
      {screen}
    </>
  );
}
