const generateDeck = () => Array.from({ length: 100 }, (_, i) => i + 1);

const shuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

const INITIAL_HAND_SIZE = 1;

const initGame = (roomState) => {
    roomState.deck = shuffle(generateDeck());
    roomState.table = [];
    roomState.phase = 'playing'; // Card viewing phase
    roomState.comments = []; // Will hold { playerId, playerName, icon, comment }
    roomState.rankings = {}; // { playerId: { comment1PlayerId: rank, ... } }
    roomState.revealOrder = []; // Order of card reveals

    // Deal cards
    roomState.players.forEach(player => {
        player.hand = [];
        player.comment = '';
        player.commentSubmitted = false;
        player.rankingSubmitted = false;
        player.cardRevealed = false;
        for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
            if (roomState.deck.length > 0) {
                player.hand.push(roomState.deck.pop());
            }
        }
        player.hand.sort((a, b) => a - b);
    });

    return roomState;
};

module.exports = {
    generateDeck,
    shuffle,
    initGame
};
