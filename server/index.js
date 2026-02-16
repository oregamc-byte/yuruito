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
    }
});

// Game State Management
const rooms = {};

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    // Serve any static files
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Join Room
    socket.on('join_room', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                deck: [],
                table: [],
                theme: "",
                phase: "lobby"
            };
        }

        const isHost = rooms[roomId].players.length === 0;
        const player = {
            id: socket.id,
            username,
            hand: [],
            isHost
        };

        rooms[roomId].players.push(player);

        // Notify room of updated state
        io.to(roomId).emit('update_gamestate', rooms[roomId]);
        console.log(`User ${username} joined room ${roomId}`);
    });

    // Start Game
    socket.on('start_game', ({ roomId }) => {
        if (rooms[roomId]) {
            initGame(rooms[roomId]);
            io.to(roomId).emit('update_gamestate', rooms[roomId]);
        }
    });

    // Submits a card
    socket.on('play_card', ({ roomId, card }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player && player.hand.includes(card)) {
            // Remove from hand
            player.hand = player.hand.filter(c => c !== card);
            // Add to table
            room.table.push({
                card,
                playerId: player.id,
                playerName: player.username
            });

            io.to(roomId).emit('update_gamestate', room);

            // Check if game ended (all hands empty)
            const allHandsEmpty = room.players.every(p => p.hand.length === 0);
            if (allHandsEmpty) {
                room.phase = 'result';
                io.to(roomId).emit('update_gamestate', room);
            }
        }
    });

    // Update Theme (Manual)
    socket.on('update_theme', ({ roomId, theme }) => {
        if (rooms[roomId]) {
            rooms[roomId].theme = theme;
            io.to(roomId).emit('update_gamestate', rooms[roomId]);
        }
    });

    // Update Player Icon
    socket.on('update_icon', ({ roomId, icon }) => {
        const room = rooms[roomId];
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.icon = icon;
                io.to(roomId).emit('update_gamestate', room);
            }
        }
    });

    // Draw Random Theme
    socket.on('draw_theme', ({ roomId }) => {
        if (rooms[roomId]) {
            rooms[roomId].theme = getRandomTheme();
            io.to(roomId).emit('update_gamestate', rooms[roomId]);
        }
    });

    // Restart Game
    socket.on('restart_game', ({ roomId }) => {
        if (rooms[roomId]) {
            rooms[roomId].phase = 'lobby';
            rooms[roomId].table = [];
            rooms[roomId].deck = [];
            rooms[roomId].players.forEach(p => p.hand = []);
            io.to(roomId).emit('update_gamestate', rooms[roomId]);
        }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
        // Remove player from all rooms they are in
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                // If room empty, delete it
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    // Update host if needed
                    if (room.players.length > 0 && !room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                    }
                    io.to(roomId).emit('update_gamestate', room);
                }
            }
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
