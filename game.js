import { db, ref, get, set, update, onValue } from "./firebase-config.js";
import { extensionRules, canPlayCardWithExtensions, isRainbow11 } from "./extension.js";

let lastDiscardColor = null;
let selectedCardIndex = null;

let lastUsed = null;

const colors = ['red', 'green', 'gray', 'blue', 'yellow'];
const roomId = localStorage.getItem("roomId");
const playerId = localStorage.getItem("playerId");

let currentTurn = null;
let hasPlayed = false;
let hasDrawn = false;

const modalRainbow11 = document.getElementById("rainbow11-modal");
const rainbow11ColorList = document.getElementById("rainbow11-color-list");
const rainbow11Cancel = document.getElementById("rainbow11-cancel");

const modalDiscardRainbow = document.getElementById("modal-discard-rainbow");
const discardRainbowColorList = document.getElementById("discard-rainbow-color-list");
const discardRainbowCancel = document.getElementById("discard-rainbow-cancel");

if (!roomId || !playerId) {
  alert("방 정보가 없습니다.");
  location.href = "index.html";
}

let hand = [];
let expeditions = Object.fromEntries(colors.map(c => [c, []]));
let opponentExpeditions = Object.fromEntries(colors.map(c => [c, []]));
let discardPiles = Object.fromEntries(colors.map(c => [c, []]));

const gameRef = ref(db, `games/${roomId}`);
const stateRef = ref(db, `games/${roomId}/state`);

window.addEventListener("beforeunload", function (e) {
  e.preventDefault();
  e.returnValue = "";
});

function cardToText(card) {
  return card.value === 'INVEST' ? '🤝' : card.value;
}

function createCardDiv(card) {
  const div = document.createElement('div');
  div.className = `card ${card.color}` + (card.value === 'INVEST' ? ' invest' : '');
  div.innerHTML = `
    <div class="corner top-left">${cardToText(card)}</div>
    <div class="corner bottom-right">${cardToText(card)}</div>
  `;
  return div;
}

function renderStack(containerId, stacks, isDiscard = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  colors.forEach(color => {
    const stackDiv = document.createElement('div');
    stackDiv.className = `card-stack${isDiscard ? ` discard-zone ${color}` : ''}`;
    const cards = stacks[color] || [];
    if (cards.length > 0) {
      const displayCards = isDiscard ? [cards.at(-1)] : cards;
      displayCards.forEach((card, idx) => {
        const div = createCardDiv(card);

        if (
          lastUsed &&
          card.color === lastUsed.color &&
          card.value === lastUsed.value &&
          (
            (isDiscard && lastUsed.type === 'discard') ||
            (!isDiscard && lastUsed.type === 'expedition')
          ) &&
          idx === displayCards.length - 1 // 마지막 카드만 하이라이트
        ) {
          div.classList.add("highlight");
        }

        if (isDiscard) div.onclick = () => drawFromDiscard(color);
        stackDiv.appendChild(div);
      });
    }
    container.appendChild(stackDiv);
  });
}


function renderScores(scoreContainerId, stacks) {
  const container = document.getElementById(scoreContainerId);
  container.innerHTML = '';
  colors.forEach(color => {
    const score = calculateExpeditionScore(stacks[color]);
    const el = document.createElement('div');
    el.textContent = score;
    container.appendChild(el);
  });
}

function renderHand() {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  hand.forEach((card, index) => {
    const div = createCardDiv(card);
    div.onclick = () => playCard(index);
    handDiv.appendChild(div);
  });
}

function calculateExpeditionScore(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  let invest = 0, sum = 0, cardCount = 0;
  for (const c of cards) {
    if (c.value === 'INVEST') invest++;
    else { sum += c.value; cardCount++; }
  }
  if (cardCount === 0) return 0;
  let score = sum - 20;
  score *= (invest + 1);
  if (cardCount + invest >= 8) score += 20;
  return score;
}

function playCard(index) {
  if (currentTurn !== playerId || hasPlayed) return;

  selectedCardIndex = index;
  const card = hand[index];
  const modal = document.getElementById("card-modal");
  const text = document.getElementById("card-modal-text");
  text.textContent = `선택한 카드 : ${card.color.toUpperCase()} ${cardToText(card)}`;
  modal.style.display = "flex";
}

// 모달 버튼 핸들러
document.getElementById("modal-use").onclick = () => {
  if (selectedCardIndex === null) return;
  const card = hand[selectedCardIndex];

  if (isRainbow11(card)) {
    showRainbow11Modal(card);
    return;
  }
  const stack = expeditions[card.color];
  const last = stack.at(-1);

  if (card.value === 'INVEST' && stack.some(c => typeof c.value === 'number')) {
    alert('숫자 카드를 낸 이후에는 투자카드를 낼 수 없습니다.');
    return closeModal();
  }
  if (!canPlayCardWithExtensions(stack, card, extensionRules)) {
    alert('규칙 위반: 이 카드를 낼 수 없습니다.');
    return closeModal();
  }
  if (last && typeof last.value === 'number' && card.value <= last.value) {
    alert('이전에 낸 숫자보다 더 큰 숫자를 내야 합니다.');
    return closeModal();
  }

  stack.push(card);
  set(ref(db, `games/${roomId}/state/expeditions/${playerId}/${card.color}`), stack);

  update(ref(db, `games/${roomId}/state`), {
    hasPlayed: true,
    lastUsed: { ...card, type: 'expedition' }
  });

  finalizePlay(card);
};

document.getElementById("modal-discard").onclick = () => {
  if (selectedCardIndex === null) return;
  const card = hand[selectedCardIndex];

  if (card.color === 'rainbow') {
    showDiscardRainbowModal(card);
    closeModal();
    return;
  }

  discardPiles[card.color].push(card);
  set(ref(db, `games/${roomId}/state/discards/${card.color}`), discardPiles[card.color]);
  lastDiscardColor = card.color;

  update(ref(db, `games/${roomId}/state`), {
    hasPlayed: true,
    lastUsed: { ...card, type: 'discard' }
  });

  finalizePlay(card);
};

document.getElementById("modal-cancel").onclick = () => {
  closeModal();
};

function finalizePlay(card) {
  hand.splice(selectedCardIndex, 1);
  set(ref(db, `games/${roomId}/state/hands/${playerId}`), hand);
  update(ref(db, `games/${roomId}/state`), { hasPlayed: true });
  selectedCardIndex = null;
  closeModal();
  checkEndTurn();
}
// 기본 카드 행동 모달 닫기
function closeModal() {
  document.getElementById("card-modal").style.display = "none";
  selectedCardIndex = null;
}

// 무지개 11 카드 모달 표시
function showRainbow11Modal(card) {
  rainbow11ColorList.innerHTML = '';

  const validColors = colors.filter(color => {
    const stack = expeditions[color];
    const lastCard = stack.at(-1);
    return lastCard && lastCard.value === 10;
  });

  if (validColors.length === 0) {
    alert("무지개 11 카드를 놓을 수 있는 10 카드가 없습니다.");
    closeModal();
    return;
  }

  validColors.forEach(color => {
    const btn = document.createElement("button");
    btn.textContent = color.toUpperCase();

    switch(color) {
      case 'red': btn.style.backgroundColor = '#ff4d4d'; break;
      case 'green': btn.style.backgroundColor = '#4caf50'; break;
      case 'gray': btn.style.backgroundColor = '#9e9e9e'; break;
      case 'blue': btn.style.backgroundColor = '#2196f3'; break;
      case 'yellow': btn.style.backgroundColor = '#ffeb3b'; break;
      default: btn.style.backgroundColor = '#ccc';
    }

    btn.onclick = () => {
      placeRainbow11(card, color);
      modalRainbow11.style.display = "none";
      closeModal();
    };
    rainbow11ColorList.appendChild(btn);
  });

  modalRainbow11.style.display = "flex";
}

// 무지개 11 카드 놓기 처리
function placeRainbow11(card, color) {
  expeditions[color].push(card);

  set(ref(db, `games/${roomId}/state/expeditions/${playerId}/${color}`), expeditions[color]);

  hand.splice(selectedCardIndex, 1);
  set(ref(db, `games/${roomId}/state/hands/${playerId}`), hand);

  update(ref(db, `games/${roomId}/state`), {
    hasPlayed: true,
    lastUsed: { ...card, type: 'expedition' }
  });

  selectedCardIndex = null;
  checkEndTurn();
}

// 무지개 11 놓기 모달 닫기
rainbow11Cancel.onclick = () => {
  modalRainbow11.style.display = "none";
  selectedCardIndex = null;
  closeModal();
};

// 무지개 카드 버리기 모달 표시
function showDiscardRainbowModal(card) {
  discardRainbowColorList.innerHTML = '';

  colors.forEach(color => {
    const btn = document.createElement("button");
    btn.textContent = color.toUpperCase();
    switch(color) {
      case 'red': btn.style.backgroundColor = '#ff4d4d'; break;
      case 'green': btn.style.backgroundColor = '#4caf50'; break;
      case 'gray': btn.style.backgroundColor = '#9e9e9e'; break;
      case 'blue': btn.style.backgroundColor = '#2196f3'; break;
      case 'yellow': btn.style.backgroundColor = '#ffeb3b'; break;
      default: btn.style.backgroundColor = '#ccc';
    }
    btn.onclick = () => {
      discardRainbowCardToColor(card, color);
      modalDiscardRainbow.style.display = "none";
    };
    discardRainbowColorList.appendChild(btn);
  });

  modalDiscardRainbow.style.display = "flex";
}

// 무지개 카드 버리기 처리
async function discardRainbowCardToColor(card, color) {
  discardPiles[color].push(card);
  await set(ref(db, `games/${roomId}/state/discards/${color}`), discardPiles[color]);

  // 손패에서 카드 제거 및 상태 업데이트
  const index = hand.findIndex(c => c.color === card.color && c.value === card.value);
  if (index >= 0) {
    hand.splice(index, 1);
    await set(ref(db, `games/${roomId}/state/hands/${playerId}`), hand);
  }

  await update(ref(db, `games/${roomId}/state`), {
    hasPlayed: true,
    lastUsed: { ...card, type: 'discard' }
  });

  checkEndTurn();
}

// 무지개 카드 버리기 모달 닫기
discardRainbowCancel.onclick = () => {
  modalDiscardRainbow.style.display = "none";
};

// 덱에서 카드 뽑기
document.getElementById('draw-btn').onclick = async () => {
  if (currentTurn !== playerId || hasDrawn) return;
  if (!hasPlayed) {
    alert("먼저 카드를 내려놓아야 합니다!");
    return;
  }

  // 1) 손에서 뽑기
  const deckSnap = await get(ref(db, `games/${roomId}/state/deck`));
  const deck = deckSnap.val() || [];
  if (!deck.length) return alert("덱이 비었습니다!");

  const drawnCard = deck.pop();
  hand.push(drawnCard);

  // 2) 한 번의 update() 로 deck, hand, hasDrawn 동시 반영
  await update(ref(db, `games/${roomId}/state`), {
    deck: deck,
    [`hands/${playerId}`]: hand,
    hasDrawn: true
  });

  checkEndTurn();
};

function checkEndTurn() {
  if (hasPlayed && hasDrawn) {
    const nextTurn = playerId === 'player1' ? 'player2' : 'player1';
    update(ref(db, `games/${roomId}/state`), {
      turn: nextTurn,
      hasPlayed: false,
      hasDrawn: false
    });
    lastDiscardColor = null;
  }
}

async function drawFromDiscard(color) {
  if (currentTurn !== playerId || hasDrawn) return;
  
  if (!hasPlayed) {
    alert("먼저 카드를 내려놓아야 합니다!");
    return;
  }

  if (lastDiscardColor === color) {
    alert("방금 버린 카드는 곧바로 가져올 수 없습니다!");
    return;
  }

  // 1) 버림 더미 가져오기
  const discardRef = ref(db, `games/${roomId}/state/discards/${color}`);
  const snap = await get(discardRef);
  const discardStack = snap.val() || [];

  if (discardStack.length === 0) {
    alert("해당 색상의 버린 카드가 없습니다!");
    return;
  }

  // 2) 마지막 카드 꺼내서 내 손패에 추가
  const card = discardStack.pop();
  hand.push(card);

  // 3) 한 번의 update() 로 discard, hand, hasDrawn 동시 반영
  await update(ref(db, `games/${roomId}/state`), {
    // state/discards/{color} 경로
    [`discards/${color}`]: discardStack,
    // state/hands/{playerId} 경로
    [`hands/${playerId}`]: hand,
    // 턴 내 뽑기 플래그
    hasDrawn: true
  });

  // 4) 턴 끝 검사
  checkEndTurn();
}

function updateUI() {
  const isMyTurn = currentTurn === playerId;
  document.getElementById("draw-btn").disabled = !isMyTurn || hasDrawn || !hasPlayed;
  renderStack('opponent-expeditions', opponentExpeditions);
  renderScores('opponent-scores', opponentExpeditions);
  renderStack('discard-piles', discardPiles, true);
  renderStack('player-expeditions', expeditions);
  renderScores('player-scores', expeditions);
  renderHand();

  document.getElementById("turn-display").textContent =
    isMyTurn ? "당신의 턴입니다" : "상대방의 턴입니다";
}

function startListening() {
  onValue(stateRef, snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // 1) 내 손패
    const rawHand = data.hands?.[playerId] || [];
    hand = Array.isArray(rawHand) ? rawHand : Object.values(rawHand);

    // 2) 내 탐험로: colors 배열을 순회하며 반드시 배열로 초기화
    expeditions = Object.fromEntries(
      colors.map(color => {
        const cards = data.expeditions?.[playerId]?.[color];
        return [
          color,
          Array.isArray(cards)
            ? cards
            : (cards ? Object.values(cards) : [])
        ];
      })
    );

    // 3) 버린 카드 더미도 마찬가지
    discardPiles = Object.fromEntries(
      colors.map(color => {
        const cards = data.discards?.[color];
        return [
          color,
          Array.isArray(cards)
            ? cards
            : (cards ? Object.values(cards) : [])
        ];
      })
    );

    // 4) 상대 탐험로도 동일하게
    const opponentId = playerId === 'player1' ? 'player2' : 'player1';
    opponentExpeditions = Object.fromEntries(
      colors.map(color => {
        const cards = data.expeditions?.[opponentId]?.[color];
        return [
          color,
          Array.isArray(cards)
            ? cards
            : (cards ? Object.values(cards) : [])
        ];
      })
    );

    // 5) 그 외 상태
    currentTurn = data.turn;
    hasPlayed  = data.hasPlayed  || false;
    hasDrawn   = data.hasDrawn   || false;

    lastUsed = data.lastUsed || null;


    updateUI();
  });

  onValue(ref(db, `games/${roomId}/players`), (snapshot) => {
    const players = snapshot.val() || {};
    const opponentId = playerId === 'player1' ? 'player2' : 'player1';

    document.getElementById("my-name").textContent = `나: ${players[playerId]?.name || "나"}`;
    document.getElementById("opponent-name").textContent = `상대: ${players[opponentId]?.name || "상대"}`;
  });
  onValue(ref(db, `games/${roomId}/state/deck`), (snapshot) => {
  const deck = snapshot.val() || [];
  const count = Array.isArray(deck) ? deck.length : Object.keys(deck).length;
  document.getElementById("deck-count").textContent = `남은 카드: ${count}장`;
});

}

startListening();
