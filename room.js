import { db, ref, get, set, update, onValue } from "./firebase-config.js";

const colors = ['red', 'green', 'gray', 'blue', 'yellow'];
const emptyExpedition = Object.fromEntries(colors.map(c => [c, []]));

export function createRoom(roomId, playerName, extensionOptions = { useRainbow11: false }) {
  const playerId = "player1";

  const initialData = {
    players: {
      [playerId]: {
        name: playerName,
        joinedAt: Date.now()
      }
    },
    state: {
      turn: playerId,
      deck: [],
      hands: {
        [playerId]: []
      },
      expeditions: {
        [playerId]: { ...emptyExpedition }
      },
      discards: { ...emptyExpedition },
      hasPlayed: false,
      hasDrawn: false,
      extensionRules: {
        useRainbow11: extensionOptions.useRainbow11 || false
      }
    }
  };

  return set(ref(db, `games/${roomId}`), initialData).then(() => {
    console.log(`방 ${roomId} 생성 완료 (무지개 11: ${initialData.state.extensionRules.useRainbow11})`);
    return playerId;
  });
}


export async function joinRoom(roomId, playerName, extensionOptions = { useRainbow11: false }) {
  const roomRef = ref(db, `games/${roomId}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    return await createRoom(roomId, playerName, extensionOptions);
  }

  const data = snapshot.val();
  const players = data.players || {};
  const playerId = !players.player1 ? "player1" : (!players.player2 ? "player2" : null);

  if (!playerId) {
    alert("이미 두 명이 참가한 방입니다.");
    return null;
  }

  await update(ref(db, `games/${roomId}/players/${playerId}`), {
    name: playerName,
    joinedAt: Date.now()
  });

  const deckSnap = await get(ref(db, `games/${roomId}/state/deck`));
  const deck = deckSnap.val();

  // 덱이 비어 있거나 undefined일 때만 hands/expeditions 초기화
  if (!Array.isArray(deck) || deck.length === 0) {
    await set(ref(db, `games/${roomId}/state/hands/${playerId}`), []);
    await set(
      ref(db, `games/${roomId}/state/expeditions/${playerId}`),
      { ...emptyExpedition }
    );
  }

  return playerId;
}

export async function initGameState(roomId) {
  const deck = [];
  for (const color of colors) {
    for (let i = 2; i <= 10; i++) deck.push({ color, value: i });
    for (let i = 0; i < 3; i++) deck.push({ color, value: 'INVEST' });
  }

  // 확장 룰 상태 불러오기
  const stateRef = ref(db, `games/${roomId}/state`);
  const snapshot = await get(stateRef);
  const currentState = snapshot.val() || {};
  const extRules = currentState.extensionRules || { useRainbow11: false };

  // useRainbow11 이 true일 때만 무지개 11 카드 3장 추가
  if (extRules.useRainbow11) {
    for (let i = 0; i < 3; i++) {
      deck.push({ color: 'rainbow', value: 11 });
    }
  }

  // 덱 섞기
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const hands = {
    player1: deck.splice(0, 8),
    player2: deck.splice(0, 8)
  };

  await set(stateRef, {
    deck,
    hands,
    expeditions: {
      player1: Object.fromEntries(colors.map(c => [c, []])),
      player2: Object.fromEntries(colors.map(c => [c, []]))
    },
    discards: Object.fromEntries(colors.map(c => [c, []])),
    turn: "player1",
    hasPlayed: false,
    hasDrawn: false,
    extensionRules: extRules // 확장 룰 유지
  });
}
