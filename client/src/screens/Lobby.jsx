import React from 'react';

export default function Lobby({ view }) {
  return (
    <div className="screen">
      <div className="screen-bg" style={{ backgroundImage: "url('/assets/wallpapers/the-main-protagonists.png')" }} />
      <h1 className="title">ABCDEF</h1>
      <p className="subtitle">Waiting for opponent</p>
      <div className="panel" style={{ textAlign: 'center' }}>
        <p>Share this code with your opponent:</p>
        <div className="room-code">{view.code}</div>
        <div className="spinner" />
      </div>
    </div>
  );
}
