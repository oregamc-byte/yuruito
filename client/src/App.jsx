import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';

function App() {
  const [isJoined, setIsJoined] = useState(false);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    // Check URL for room ID
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');
    if (urlRoomId) {
      setRoomId(urlRoomId);
    } else {
      // Generate random room ID if not present
      const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?room=' + newRoomId;
      window.history.pushState({ path: newUrl }, '', newUrl);
      setRoomId(newRoomId);
    }

    // Try auto-reconnect from saved session
    const savedRoomId = localStorage.getItem('ito_roomId');
    const savedName = localStorage.getItem('ito_username');
    const savedIcon = localStorage.getItem('ito_icon');
    const savedSession = localStorage.getItem('ito_session_active');
    const currentRoomId = urlRoomId || roomId;

    if (savedSession && savedName && savedRoomId && savedRoomId === (urlRoomId || '')) {
      // Auto-reconnect
      socket.auth = { username: savedName, icon: savedIcon };
      socket.connect();
      socket.emit('join_room', {
        roomId: savedRoomId,
        username: savedName,
        icon: savedIcon,
        reconnect: true
      });
      setIsJoined(true);
    }

    // Handle disconnect: DON'T go back to lobby, let reconnection happen
    function onDisconnect(reason) {
      console.log('Disconnected:', reason);
      // Only go back to lobby if manually disconnected or server shutdown
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setIsJoined(false);
        localStorage.removeItem('ito_session_active');
      }
      // For other reasons (transport close, ping timeout), socket.io will auto-reconnect
    }

    function onReconnect() {
      console.log('Reconnected!');
      const rId = localStorage.getItem('ito_roomId');
      const uName = localStorage.getItem('ito_username');
      const uIcon = localStorage.getItem('ito_icon');
      if (rId && uName) {
        socket.emit('join_room', {
          roomId: rId,
          username: uName,
          icon: uIcon,
          reconnect: true
        });
        setIsJoined(true);
      }
    }

    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  const handleJoin = (joined) => {
    setIsJoined(joined);
    if (joined) {
      localStorage.setItem('ito_session_active', 'true');
      localStorage.setItem('ito_roomId', roomId);
    }
  };

  return (
    <div className="App">
      {!isJoined ? (
        <Lobby onJoin={handleJoin} roomId={roomId} />
      ) : (
        <GameRoom roomId={roomId} />
      )}
    </div>
  );
}

export default App;
