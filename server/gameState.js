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

const INITIAL_HAND_SIZE = 1; // Start with 1 card usually, or configurable

const initGame = (roomState) => {
    roomState.deck = shuffle(generateDeck());
    roomState.table = [];
    roomState.phase = 'playing';

    // Deal cards
    roomState.players.forEach(player => {
        player.hand = [];
        for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
            if (roomState.deck.length > 0) {
                player.hand.push(roomState.deck.pop());
            }
        }
        player.hand.sort((a, b) => a - b); // Keep hand sorted for convenience
    });

    return roomState;
};

module.exports = {
    generateDeck,
    shuffle,
    initGame
};
