import React from 'react';
import { wallpaperUrl } from '../img.js';

export default function Lobby({ view }) {
  return (
    <div className="screen">
      <div className="screen-bg" style={{ backgroundImage: `url('${wallpaperUrl('the-main-protagonists')}')` }} />
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
