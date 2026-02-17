import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

const ANIMAL_ICONS = [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐴", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆"
];

export function Lobby({ onJoin, roomId, onRoomIdChange }) {
    const [username, setUsername] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(ANIMAL_ICONS[0]);

    useEffect(() => {
        const savedName = localStorage.getItem('ito_username');
        const savedIcon = localStorage.getItem('ito_icon');
        if (savedName) setUsername(savedName);
        if (savedIcon && ANIMAL_ICONS.includes(savedIcon)) setSelectedIcon(savedIcon);
    }, []);

    const handleRoomIdInput = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        onRoomIdChange(val);
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (username.trim() && roomId && roomId.length === 4) {
            localStorage.setItem('ito_username', username);
            localStorage.setItem('ito_icon', selectedIcon);

            socket.auth = { username, icon: selectedIcon };
            socket.connect();
            socket.emit('join_room', { roomId, username, icon: selectedIcon });
            onJoin(true);
        }
    };

    return (
        <div className="lobby-container">
            <div className="lobby-card">
                <h1>ito Online</h1>

                <form onSubmit={handleJoin} className="join-form">
                    <div className="input-group">
                        <label>ルームナンバー (4桁)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="例: 1234"
                            value={roomId || ''}
                            onChange={handleRoomIdInput}
                            className="room-input"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>ニックネーム</label>
                        <input
                            type="text"
                            placeholder="名前を入力"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <label>アイコン選択</label>
                        <div className="icon-grid">
                            {ANIMAL_ICONS.map(icon => (
                                <button
                                    key={icon}
                                    type="button"
                                    className={`icon-btn ${selectedIcon === icon ? 'selected' : ''}`}
                                    onClick={() => setSelectedIcon(icon)}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={!roomId || roomId.length !== 4}>参加する</button>
                </form>
            </div>
        </div>
    );
}
