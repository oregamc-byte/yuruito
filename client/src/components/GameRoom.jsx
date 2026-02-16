import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

const ANIMAL_ICONS = [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆"
];

export function GameRoom({ roomId }) {
    const [gameState, setGameState] = useState(null);
    const [myHand, setMyHand] = useState([]);
    const [copyMsg, setCopyMsg] = useState('');
    const [showIconSelector, setShowIconSelector] = useState(false);

    useEffect(() => {
        socket.on('update_gamestate', (state) => {
            setGameState(state);
            const me = state.players.find(p => p.id === socket.id);
            if (me) setMyHand(me.hand);
        });
        return () => socket.off('update_gamestate');
    }, []);

    const startGame = () => socket.emit('start_game', { roomId });
    const drawTheme = () => socket.emit('draw_theme', { roomId });
    const playCard = (card) => socket.emit('play_card', { roomId, card });
    const restartGame = () => socket.emit('restart_game', { roomId });
    const updateIcon = (icon) => {
        socket.emit('update_icon', { roomId, icon });
        setShowIconSelector(false);
    };

    const copyUrl = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopyMsg('コピーしました！');
            setTimeout(() => setCopyMsg(''), 2000);
        });
    };

    const formatTheme = (themeStr) => {
        if (!themeStr) return "未設定";
        // Remove text in parentheses including the parentheses
        return themeStr.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
    };

    const goHome = () => {
        window.location.href = "/";
    };

    if (!gameState) return <div className="loading">通信中... (ルーム: {roomId})</div>;

    const { players, table, theme, phase } = gameState;
    const me = players.find(p => p.id === socket.id) || {};

    return (
        <div className="game-room">
            {/* Icon Selector Modal */}
            {showIconSelector && (
                <div className="modal-overlay" onClick={() => setShowIconSelector(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>アイコン変更</h3>
                        <div className="icon-grid-modal">
                            {ANIMAL_ICONS.map(icon => (
                                <button
                                    key={icon}
                                    className={`icon-btn ${me.icon === icon ? 'selected' : ''}`}
                                    onClick={() => updateIcon(icon)}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                        <button className="btn-close" onClick={() => setShowIconSelector(false)}>キャンセル</button>
                    </div>
                </div>
            )}

            {/* New Header Layout */}
            <header className="game-header-new">
                <div className="header-left">
                    <button className="btn-back" onClick={goHome}>
                        ⬅ タイトルへ
                    </button>
                    {me.isHost && (
                        <button className="btn-icon" onClick={restartGame} title="ゲームをリセット">🔄</button>
                    )}
                </div>

                <div className="header-center">
                    <div className="theme-box">
                        <div className="theme-text">{formatTheme(theme)}</div>
                        {me.isHost && (
                            <button className="btn-xs-theme" onClick={drawTheme}>お題変更</button>
                        )}
                    </div>
                </div>

                <div className="header-right">
                    <button className="btn-share" onClick={copyUrl}>
                        🔗 共有
                    </button>
                    {copyMsg && <span className="copy-toast">{copyMsg}</span>}
                </div>
            </header>

            <main className="game-main-new">
                {/* Table Area (Center) */}
                <div className="table-area-new">
                    {table.length === 0 && phase === 'playing' ? (
                        <div className="empty-table-msg">カードを出してください</div>
                    ) : (
                        <div className="cards-row table-cards">
                            {table.map((entry, i) => (
                                <div key={i} className="played-card-container">
                                    <div className="card played-card">
                                        <div className="card-val">{entry.card}</div>
                                    </div>
                                    <div className="card-owner-name">
                                        {/* Find player icon if available, else name */}
                                        {(() => {
                                            const p = players.find(pl => pl.id === entry.playerId);
                                            return p ? `${p.icon || "👤"} ${p.username} ` : entry.playerName;
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Player List (Right Side) */}
                <div className="player-list-side">
                    <h3>参加者</h3>
                    <div className="player-list-vertical">
                        {players.map(p => (
                            <div key={p.id} className={`player - row ${p.id === socket.id ? 'me' : ''} `}>
                                <span
                                    className={`p - icon ${p.id === socket.id ? 'clickable' : ''} `}
                                    onClick={() => p.id === socket.id && setShowIconSelector(true)}
                                    title={p.id === socket.id ? "アイコンを変更" : ""}
                                >
                                    {p.icon || "👤"}
                                </span>
                                <div className="p-info">
                                    <div className="p-name">{p.username} {p.isHost && '👑'}</div>
                                    {p.hand.length > 0 && <div className="p-status">カード: {p.hand.length}枚</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="game-footer">
                {phase === 'lobby' && me.isHost && (
                    <div className="host-controls">
                        <button className="btn-primary" onClick={startGame}>ゲーム開始</button>
                    </div>
                )}

                {phase === 'result' && (
                    <div className="result-msg">
                        ゲーム終了！全員出し切れましたか？
                    </div>
                )}

                {phase === 'result' && me.isHost && (
                    <div className="host-controls">
                        <button className="btn-primary" onClick={restartGame}>もう一度遊ぶ</button>
                    </div>
                )}

                <div className="my-hand">
                    <div className="cards-row">
                        {myHand.map(card => (
                            <button
                                key={card}
                                className="card hand-card"
                                onClick={() => playCard(card)}
                                disabled={phase !== 'playing'}
                            >
                                {card}
                            </button>
                        ))}
                    </div>
                    {myHand.length === 0 && phase === 'playing' && (
                        <div className="waiting-msg">クリア！</div>
                    )}
                </div>
            </footer>
        </div>
    );
}
