const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { themes, getRandomTheme } = require('./themes');
const { initGame } = require('./gameState');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 30000,
    pingInterval: 10000,
});

// Game State Management
const rooms = {};
// Track disconnect timers for reconnection grace period
const disconnectTimers = {};

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    app.use(express.static(path.join(__dirname, '../client/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

// Helper: Get safe game state (hide other players' hands and card numbers)
function getSafeState(room) {
    return {
        players: room.players.map(p => ({
            id: p.id,
            username: p.username,
            icon: p.icon,
            hand: p.hand, // Will be filtered per-player on client
            isHost: p.isHost,
            comment: p.commentSubmitted ? p.comment : null,
            commentSubmitted: p.commentSubmitted,
            rankingSubmitted: p.rankingSubmitted,
            cardRevealed: p.cardRevealed,
            disconnected: p.disconnected || false,
        })),
        table: room.table,
        theme: room.theme,
        phase: room.phase,
        comments: room.comments || [],
        rankings: room.rankings || {},
        revealOrder: room.revealOrder || [],
    };
}

// Helper: Send personalized game state to each player (hiding other hands)
function broadcastGameState(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach(p => {
        if (p.disconnected) return;
        const state = getSafeState(room);
        // Only show this player's hand, hide others
        state.players = state.players.map(pl => ({
            ...pl,
            hand: pl.id === p.id ? pl.hand : (pl.hand ? pl.hand.map(() => '?') : []),
        }));
        io.to(p.id).emit('update_gamestate', state);
    });
}

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Join Room (handles both new joins and reconnects)
    socket.on('join_room', (data) => {
        const { roomId, username, icon, reconnect } = data;
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                deck: [],
                table: [],
                theme: "",
                phase: "lobby",
                comments: [],
                rankings: {},
                revealOrder: [],
            };
        }

        const room = rooms[roomId];

        // Check if this is a reconnection (same username in room)
        if (reconnect) {
            const existingPlayer = room.players.find(p =>
                p.username === username && (p.disconnected || p.id === socket.id)
            );
            if (existingPlayer) {
                // Clear any pending disconnect timer
                const timerKey = `${roomId}_${existingPlayer.id}`;
                if (disconnectTimers[timerKey]) {
                    clearTimeout(disconnectTimers[timerKey]);
                    delete disconnectTimers[timerKey];
                    console.log(`Reconnect timer cleared for ${username} in room ${roomId}`);
                }
                // Update socket ID
                existingPlayer.id = socket.id;
                existingPlayer.disconnected = false;
                existingPlayer.icon = icon || existingPlayer.icon;

                broadcastGameState(roomId);
                console.log(`User ${username} reconnected to room ${roomId}`);
                return;
            }
        }

        // Check if player already exists (duplicate join prevention)
        const alreadyInRoom = room.players.find(p => p.id === socket.id);
        if (alreadyInRoom) {
            broadcastGameState(roomId);
            return;
        }

        const isHost = room.players.filter(p => !p.disconnected).length === 0;
        const player = {
            id: socket.id,
            username,
            icon: icon || "👤",
            hand: [],
            isHost,
            comment: '',
            commentSubmitted: false,
            rankingSubmitted: false,
            cardRevealed: false,
            disconnected: false,
        };

        room.players.push(player);
        broadcastGameState(roomId);
        console.log(`User ${username} joined room ${roomId}`);
    });

    // Start Game
    socket.on('start_game', ({ roomId }) => {
        if (rooms[roomId]) {
            initGame(rooms[roomId]);
            broadcastGameState(roomId);
        }
    });

    // Submit Comment (each player sends their comment about the theme)
    socket.on('submit_comment', ({ roomId, comment }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'commenting') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        player.comment = comment;
        player.commentSubmitted = true;

        broadcastGameState(roomId);

        // Check if all players submitted comments
        const activePlayers = room.players.filter(p => !p.disconnected);
        const allSubmitted = activePlayers.every(p => p.commentSubmitted);
        if (allSubmitted) {
            // Build comments array (shuffled so order doesn't give away identity easily)
            room.comments = activePlayers.map(p => ({
                playerId: p.id,
                playerName: p.username,
                icon: p.icon,
                comment: p.comment,
            }));
            // Don't auto-advance — wait for host to reveal
            broadcastGameState(roomId);
        }
    });

    // Move to commenting phase (triggered after players see their cards)
    socket.on('go_to_commenting', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.phase = 'commenting';
        broadcastGameState(roomId);
    });

    // Reveal Comments (host only)
    socket.on('reveal_comments', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.phase = 'reveal_comments';

        // Ensure comments array is built
        if (room.comments.length === 0) {
            const activePlayers = room.players.filter(p => !p.disconnected);
            room.comments = activePlayers.map(p => ({
                playerId: p.id,
                playerName: p.username,
                icon: p.icon,
                comment: p.comment || '(未入力)',
            }));
        }

        broadcastGameState(roomId);
    });

    // Submit Ranking (each player ranks comments)
    socket.on('submit_ranking', ({ roomId, ranking }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'ranking') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.rankingSubmitted) return;

        // ranking is an object: { playerId: rank (1=biggest), ... }
        room.rankings[socket.id] = ranking;
        player.rankingSubmitted = true;

        broadcastGameState(roomId);

        // Check if all active players submitted
        const activePlayers = room.players.filter(p => !p.disconnected);
        const allRanked = activePlayers.every(p => p.rankingSubmitted);
        if (allRanked) {
            room.phase = 'revealing';
            broadcastGameState(roomId);
        }
    });

    // Move to ranking phase (host only, after comments revealed)
    socket.on('go_to_ranking', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.phase = 'ranking';
        broadcastGameState(roomId);
    });

    // Reveal Card (in the revealing phase)
    socket.on('reveal_card', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'revealing') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.cardRevealed) return;

        player.cardRevealed = true;
        // Add to reveal order
        room.revealOrder.push({
            playerId: player.id,
            playerName: player.username,
            icon: player.icon,
            card: player.hand[0],
        });

        // Sort revealOrder by card value for display
        room.revealOrder.sort((a, b) => a.card - b.card);

        broadcastGameState(roomId);

        // Check if all cards revealed
        const activePlayers = room.players.filter(p => !p.disconnected);
        const allRevealed = activePlayers.every(p => p.cardRevealed);
        if (allRevealed) {
            room.phase = 'result';
            // Build final table
            room.table = room.revealOrder.slice();
            broadcastGameState(roomId);
        }
    });

    // Play Card (legacy - kept for compatibility, used in "playing" phase)
    socket.on('play_card', ({ roomId, card }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player && player.hand.includes(card)) {
            player.hand = player.hand.filter(c => c !== card);
            room.table.push({
                card,
                playerId: player.id,
                playerName: player.username
            });

            broadcastGameState(roomId);

            const allHandsEmpty = room.players.every(p => p.hand.length === 0);
            if (allHandsEmpty) {
                room.phase = 'result';
                broadcastGameState(roomId);
            }
        }
    });

    // Update Theme (Manual)
    socket.on('update_theme', ({ roomId, theme }) => {
        if (rooms[roomId]) {
            rooms[roomId].theme = theme;
            broadcastGameState(roomId);
        }
    });

    // Update Player Icon
    socket.on('update_icon', ({ roomId, icon }) => {
        const room = rooms[roomId];
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.icon = icon;
                broadcastGameState(roomId);
            }
        }
    });

    // Draw Random Theme
    socket.on('draw_theme', ({ roomId }) => {
        if (rooms[roomId]) {
            rooms[roomId].theme = getRandomTheme();
            broadcastGameState(roomId);
        }
    });

    // Kick Player (Host only)
    socket.on('kick_player', ({ roomId, playerId }) => {
        const room = rooms[roomId];
        if (!room) return;

        const sender = room.players.find(p => p.id === socket.id);
        if (!sender || !sender.isHost) return;

        const targetIdx = room.players.findIndex(p => p.id === playerId);
        if (targetIdx !== -1) {
            const targetPlayer = room.players[targetIdx];
            // Notify the target player
            io.to(playerId).emit('kicked');

            // Remove the player
            room.players.splice(targetIdx, 1);
            console.log(`Player ${targetPlayer.username} was kicked from room ${roomId} by host`);

            broadcastGameState(roomId);
        }
    });

    // Restart Game
    socket.on('restart_game', ({ roomId }) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            room.phase = 'lobby';
            room.table = [];
            room.deck = [];
            room.comments = [];
            room.rankings = {};
            room.revealOrder = [];
            room.players.forEach(p => {
                p.hand = [];
                p.comment = '';
                p.commentSubmitted = false;
                p.rankingSubmitted = false;
                p.cardRevealed = false;
            });
            broadcastGameState(roomId);
        }
    });

    // Handle Disconnect — 5 minute grace period
    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);

        for (const roomId in rooms) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.id === socket.id);
            if (!player) continue;

            // Mark player as disconnected (don't remove yet)
            player.disconnected = true;
            broadcastGameState(roomId);

            // Set 5 minute timer to remove player
            const timerKey = `${roomId}_${socket.id}`;
            disconnectTimers[timerKey] = setTimeout(() => {
                const currentRoom = rooms[roomId];
                if (!currentRoom) return;

                const idx = currentRoom.players.findIndex(p => p.id === socket.id && p.disconnected);
                if (idx !== -1) {
                    currentRoom.players.splice(idx, 1);
                    console.log(`Player ${player.username} removed from room ${roomId} after timeout`);

                    if (currentRoom.players.length === 0) {
                        delete rooms[roomId];
                    } else {
                        if (!currentRoom.players.some(p => p.isHost && !p.disconnected)) {
                            const activePlayer = currentRoom.players.find(p => !p.disconnected);
                            if (activePlayer) activePlayer.isHost = true;
                        }
                        broadcastGameState(roomId);
                    }
                }

                delete disconnectTimers[timerKey];
            }, 5 * 60 * 1000); // 5 minutes

            console.log(`Player ${player.username} disconnected, 5 min grace period started`);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
