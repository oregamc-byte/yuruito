import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

const ANIMAL_ICONS = [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐴", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆"
];

export function GameRoom({ roomId }) {
    const [gameState, setGameState] = useState(null);
    const [myHand, setMyHand] = useState([]);
    const [copyMsg, setCopyMsg] = useState('');
    const [showIconSelector, setShowIconSelector] = useState(false);
    const [comment, setComment] = useState('');
    const [ranking, setRanking] = useState({});
    const [isEditingComment, setIsEditingComment] = useState(false);

    useEffect(() => {
        socket.on('update_gamestate', (state) => {
            setGameState(state);
            const me = state.players.find(p => p.id === socket.id);
            if (me) setMyHand(me.hand);
        });
        socket.on('kicked', () => {
            alert('管理者によって退出させられました。');
            goHome();
        });
        return () => {
            socket.off('update_gamestate');
            socket.off('kicked');
        };
    }, []);

    const startGame = () => socket.emit('start_game', { roomId });
    const drawTheme = () => socket.emit('draw_theme', { roomId });
    const restartGame = () => socket.emit('restart_game', { roomId });
    const goToCommenting = () => socket.emit('go_to_commenting', { roomId });
    const submitComment = () => {
        if (comment.trim()) {
            socket.emit('submit_comment', { roomId, comment: comment.trim() });
            setIsEditingComment(false);
        }
    };
    const editComment = () => {
        setIsEditingComment(true);
    };
    const revealComments = () => socket.emit('reveal_comments', { roomId });
    const goToRanking = () => socket.emit('go_to_ranking', { roomId });
    const submitRanking = () => {
        socket.emit('submit_ranking', { roomId, ranking });
    };
    const revealCard = () => socket.emit('reveal_card', { roomId });
    const updateIcon = (icon) => {
        socket.emit('update_icon', { roomId, icon });
        setShowIconSelector(false);
    };
    const kickPlayer = (playerId) => {
        if (window.confirm('このプレイヤーを退出させますか？')) {
            socket.emit('kick_player', { roomId, playerId });
        }
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
        return themeStr.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
    };

    const goHome = () => {
        localStorage.removeItem('ito_session_active');
        window.location.href = "/";
    };

    const handleRankChange = (playerId, value) => {
        setRanking(prev => ({
            ...prev,
            [playerId]: parseInt(value) || 0
        }));
    };

    if (!gameState) return <div className="loading">通信中... 🍁 (ルーム: {roomId})</div>;

    const { players, table, theme, phase, comments, rankings, revealOrder } = gameState;
    const me = players.find(p => p.id === socket.id) || {};
    const activePlayers = players.filter(p => !p.disconnected);

    const phaseNames = {
        'lobby': 'ロビー',
        'playing': 'カード確認',
        'commenting': 'コメント入力',
        'reveal_comments': 'コメント公開',
        'ranking': '順位付け',
        'revealing': 'カード公開',
        'result': '結果発表',
    };

    return (
        <div className="game-room">
            {/* Icon Selector Modal */}
            {showIconSelector && (
                <div className="modal-overlay" onClick={() => setShowIconSelector(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>🍁 アイコン変更</h3>
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

            {/* Header - Redesigned */}
            <header className="game-header-new">
                {/* Top row: back/refresh left, phase center, share right */}
                <div className="header-top-row">
                    <div className="header-left">
                        <button className="btn-back" onClick={goHome}>← タイトル</button>
                        {me.isHost && (
                            <button className="btn-icon" onClick={restartGame} title="ゲームをリセット">🔄</button>
                        )}
                    </div>
                    <div className="header-phase">
                        <span className="phase-badge">{phaseNames[phase] || phase}</span>
                    </div>
                    <div className="header-right">
                        <button className="btn-share" onClick={copyUrl}>↗ 共有</button>
                        {copyMsg && <span className="copy-toast">{copyMsg}</span>}
                    </div>
                </div>
                {/* Bottom row: theme centered, change button below */}
                <div className="header-theme-row">
                    <div className="theme-display">
                        <span className="theme-label-text">🍁 お題：</span>
                        <span className="theme-value">{formatTheme(theme)}</span>
                    </div>
                </div>
                {me.isHost && (
                    <div className="header-theme-action">
                        <button className="btn-xs-theme" onClick={drawTheme}>🔄 お題を変更</button>
                    </div>
                )}
            </header>

            <main className="game-main-new">
                <div className="table-area-new">

                    {/* LOBBY Phase */}
                    {phase === 'lobby' && (
                        <div className="phase-content">
                            <div className="waiting-emoji">🍂</div>
                            <div className="waiting-text">プレイヤーが揃ったらゲーム開始！</div>
                        </div>
                    )}

                    {/* PLAYING Phase */}
                    {phase === 'playing' && (
                        <div className="phase-content">
                            <div className="phase-instruction">あなたのカード</div>
                            {myHand.length > 0 && (
                                <div className="card-display">
                                    <div className="card main-card">
                                        <div className="card-val">{myHand[0]}</div>
                                    </div>
                                    <div className="card-hint">この数字は秘密です。コメントでヒントを出しましょう！</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* COMMENTING Phase */}
                    {phase === 'commenting' && (
                        <div className="phase-content">
                            <div className="phase-instruction">
                                「{formatTheme(theme)}」について<br />あなたの数字をヒントにコメントしてください
                            </div>
                            {(!me.commentSubmitted || isEditingComment) ? (
                                <div className="comment-input-area">
                                    <input
                                        type="text"
                                        className="comment-input"
                                        placeholder="コメントを入力..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        maxLength={50}
                                    />
                                    <button
                                        className="btn-primary comment-submit-btn"
                                        onClick={submitComment}
                                        disabled={!comment.trim()}
                                    >
                                        {me.commentSubmitted ? '修正する' : '送信'}
                                    </button>
                                </div>
                            ) : (
                                <div className="comment-submitted-msg">
                                    <div className="waiting-emoji">✅</div>
                                    <div className="submitted-text">コメント送信済み！</div>
                                    <div className="my-comment-preview">「{me.comment}」</div>
                                    <button className="btn-edit-comment" onClick={editComment}>✏️ 修正する</button>
                                    <div className="waiting-text">
                                        他のプレイヤーを待っています...
                                        ({activePlayers.filter(p => p.commentSubmitted).length}/{activePlayers.length})
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REVEAL COMMENTS Phase */}
                    {phase === 'reveal_comments' && (
                        <div className="phase-content">
                            <div className="phase-instruction">全員のコメント</div>
                            <div className="comments-list">
                                {comments.map((c, i) => (
                                    <div key={i} className="comment-card">
                                        <span className="comment-icon">{c.icon}</span>
                                        <span className="comment-name">{c.playerName}</span>
                                        <span className="comment-text">「{c.comment}」</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RANKING Phase */}
                    {phase === 'ranking' && (
                        <div className="phase-content">
                            <div className="phase-instruction">
                                順番をつけてください
                            </div>
                            {!me.rankingSubmitted ? (
                                <div className="ranking-area">
                                    {comments.map((c, i) => (
                                        <div key={i} className="ranking-row">
                                            <div className="ranking-comment">
                                                <span className="comment-icon">{c.icon}</span>
                                                <span className="comment-name">{c.playerName}</span>
                                                <span className="comment-text">「{c.comment}」</span>
                                            </div>
                                            <select
                                                className="ranking-select"
                                                value={ranking[c.playerId] || ''}
                                                onChange={(e) => handleRankChange(c.playerId, e.target.value)}
                                            >
                                                <option value="">-</option>
                                                {activePlayers.map((_, idx) => (
                                                    <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                    <button
                                        className="btn-primary"
                                        onClick={submitRanking}
                                        disabled={Object.keys(ranking).length !== comments.length}
                                        style={{ marginTop: '0.5rem', maxWidth: '200px' }}
                                    >
                                        順位を確定
                                    </button>
                                </div>
                            ) : (
                                <div className="comment-submitted-msg">
                                    <div className="waiting-emoji">✅</div>
                                    <div className="submitted-text">順位提出済み！</div>
                                    <div className="waiting-text">
                                        他のプレイヤーを待っています...
                                        ({activePlayers.filter(p => p.rankingSubmitted).length}/{activePlayers.length})
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REVEALING Phase */}
                    {phase === 'revealing' && (
                        <div className="phase-content">
                            <div className="phase-instruction">カードを公開しましょう！</div>
                            <div className="reveal-board">
                                {comments.map((c, i) => {
                                    const revealed = revealOrder.find(r => r.playerId === c.playerId);
                                    return (
                                        <div key={i} className={`reveal-row ${revealed ? 'revealed' : ''}`}>
                                            <span className="reveal-icon">{c.icon}</span>
                                            <span className="reveal-name">{c.playerName}</span>
                                            <span className="reveal-comment">「{c.comment}」</span>
                                            <span className="reveal-card-num">
                                                {revealed ? revealed.card : '❓'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {!me.cardRevealed && (
                                <button className="btn-play-card" onClick={revealCard}>
                                    🍁 カードを出す（{myHand[0]}）
                                </button>
                            )}
                            {me.cardRevealed && (
                                <div className="waiting-text" style={{ marginTop: '0.5rem' }}>
                                    カード公開済み！（{activePlayers.filter(p => p.cardRevealed).length}/{activePlayers.length}）
                                </div>
                            )}
                        </div>
                    )}

                    {/* RESULT Phase */}
                    {phase === 'result' && (
                        <div className="phase-content">
                            <div className="result-msg">🎉 結果発表！</div>
                            <div className="result-board">
                                {revealOrder.map((r, i) => (
                                    <div key={i} className="result-row">
                                        <span className="result-rank">#{i + 1}</span>
                                        <span className="result-icon">{r.icon}</span>
                                        <span className="result-name">{r.playerName}</span>
                                        <span className="result-card-num">{r.card}</span>
                                        <span className="result-comment">
                                            {comments.find(c => c.playerId === r.playerId)?.comment || ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Player List */}
                <div className="player-list-side">
                    <h3>参加者</h3>
                    <div className="player-list-vertical">
                        {players.map(p => (
                            <div key={p.id} className={`player-row ${p.id === socket.id ? 'me' : ''} ${p.disconnected ? 'disconnected' : ''}`}>
                                <span
                                    className={`p-icon ${p.id === socket.id ? 'clickable' : ''}`}
                                    onClick={() => p.id === socket.id && setShowIconSelector(true)}
                                    title={p.id === socket.id ? "アイコンを変更" : ""}
                                >
                                    {p.icon || "👤"}
                                </span>
                                <div className="p-info">
                                    <div className="p-name">
                                        {p.username} {p.isHost && '👑'}
                                        {p.disconnected && ' 💤'}
                                    </div>
                                    {phase === 'commenting' && (
                                        <div className="p-status">{p.commentSubmitted ? '✅' : '✏️'}</div>
                                    )}
                                    {phase === 'ranking' && (
                                        <div className="p-status">{p.rankingSubmitted ? '✅' : '🔢'}</div>
                                    )}
                                    {phase === 'revealing' && (
                                        <div className="p-status">{p.cardRevealed ? '✅' : '🃏'}</div>
                                    )}
                                </div>
                                {me.isHost && p.id !== socket.id && (
                                    <button
                                        className="btn-kick"
                                        onClick={() => kickPlayer(p.id)}
                                        title="この人を退出させる"
                                    >
                                        ❌
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="game-footer">
                {phase === 'lobby' && me.isHost && (
                    <button className="btn-primary footer-btn" onClick={startGame}>🍁 ゲーム開始</button>
                )}
                {phase === 'playing' && me.isHost && (
                    <button className="btn-primary footer-btn" onClick={goToCommenting}>コメント入力へ →</button>
                )}
                {phase === 'commenting' && me.isHost && activePlayers.every(p => p.commentSubmitted) && (
                    <button className="btn-primary footer-btn" onClick={revealComments}>🔓 コメントを公開</button>
                )}
                {phase === 'reveal_comments' && me.isHost && (
                    <button className="btn-primary footer-btn" onClick={goToRanking}>順位付けへ →</button>
                )}
                {phase === 'result' && me.isHost && (
                    <button className="btn-primary footer-btn" onClick={restartGame}>もう一度遊ぶ 🔄</button>
                )}
                <div className="footer-room-id">🏠 ルームID: {roomId}</div>
            </footer>
        </div>
    );
}
