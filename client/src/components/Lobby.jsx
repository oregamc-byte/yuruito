import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

const ANIMAL_ICONS = [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆"
];

export function Lobby({ onJoin, roomId }) {
    const [username, setUsername] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(ANIMAL_ICONS[0]);

    useEffect(() => {
        const savedName = localStorage.getItem('ito_username');
        const savedIcon = localStorage.getItem('ito_icon');
        if (savedName) setUsername(savedName);
        if (savedIcon && ANIMAL_ICONS.includes(savedIcon)) setSelectedIcon(savedIcon);
    }, []);

    const handleJoin = (e) => {
        e.preventDefault();
        if (username.trim()) {
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
                <div className="room-info">ルーム: {roomId}</div>

                <form onSubmit={handleJoin} className="join-form">
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

                    <button type="submit" className="btn-primary">参加する</button>
                </form>
            </div>
        </div>
    );
}
