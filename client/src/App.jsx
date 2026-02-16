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

    function onDisconnect() {
      setIsJoined(false);
    }

    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleJoin = (joined) => {
    setIsJoined(joined);
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
