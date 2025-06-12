// join.js
import { joinRoom, initGameState } from "./room.js";
import { db, ref, get } from "./firebase-config.js";

// 모달 엘리먼트
const modalCreate = document.getElementById("modal-create-room");
const modalJoin = document.getElementById("modal-join-room");

// UI 버튼들
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const btnCreateSubmit = document.getElementById("create-room-submit");
const btnCreateCancel = document.getElementById("create-room-cancel");
const btnJoinCancel = document.getElementById("join-room-cancel");
const btnRefreshRoomList = document.getElementById("refresh-room-list");

// 입력 필드들
const inputPlayerName = document.getElementById("player-name");
const inputCreateRoomName = document.getElementById("create-room-name");
const checkboxRainbow11 = document.getElementById("use-rainbow11");
const roomListDiv = document.getElementById("room-list");

// 닉네임 저장 key
const playerName = "닉네임";

// 페이지 로드 시 닉네임 불러오기
window.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem(playerName);
  if (savedName) {
    inputPlayerName.value = savedName;
  }
});

// 닉네임 입력 시 저장
inputPlayerName.addEventListener("input", () => {
  localStorage.setItem(playerName, inputPlayerName.value.trim());
});

// 모달 열기/닫기 함수
btnCreateRoom.onclick = () => {
  modalCreate.style.display = "flex";
};
btnJoinRoom.onclick = () => {
  modalJoin.style.display = "flex";
  loadRoomList();
};
btnCreateCancel.onclick = () => {
  modalCreate.style.display = "none";
};
btnJoinCancel.onclick = () => {
  modalJoin.style.display = "none";
};
btnRefreshRoomList.onclick = () => {
  loadRoomList();
};

// 방 생성
btnCreateSubmit.onclick = async () => {
  const roomName = inputCreateRoomName.value.trim();
  const playerName = inputPlayerName.value.trim();
  const useRainbow11 = checkboxRainbow11.checked;

  if (!roomName || !playerName) {
    alert("방 이름과 닉네임을 입력하세요.");
    return;
  }
  // 로그
  const extensionOptions = { useRainbow11 };
  console.log("joinRoom 호출 직전 extensionOptions:", extensionOptions);

  const playerId = await joinRoom(roomName, playerName, { useRainbow11 });
  console.log("joinRoom 호출 결과 playerId:", playerId);
  if (!playerId) return;

  localStorage.setItem("roomId", roomName);
  localStorage.setItem("playerId", playerId);

  // 초기 덱 세팅은 방 생성자가 담당
  if (playerId === "player1") {
    const deckSnap = await get(ref(db, `games/${roomName}/state/deck`));
    const deck = deckSnap.val();
    if (!Array.isArray(deck) || deck.length === 0) {
      await initGameState(roomName);
    }
  }

  modalCreate.style.display = "none";
  location.href = "game.html";
};

// 방 목록 불러오기
async function loadRoomList() {
  roomListDiv.innerHTML = "방 목록을 불러오는 중...";

  const snapshot = await get(ref(db, "games"));
  const games = snapshot.val() || {};

  roomListDiv.innerHTML = "";

  Object.entries(games).forEach(([roomId, roomData]) => {
    const createdAtTimestamp = roomData.players?.player1?.joinedAt;
    if (!createdAtTimestamp) return; // 생성일 없으면 표시 안 함
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    const SIX_HOUR = 6 * ONE_HOUR;

    const players = roomData.players || {};
    const player1Exists = !!players.player1;
    const player2Exists = !!players.player2;
    const deck = roomData.state?.deck;

    // 상태 판별
    let statusText = "대기 중";
    if (player1Exists && player2Exists) {
      if (deck && deck.length > 0) statusText = "게임 중";
      else statusText = "게임 종료";
    }

    // 상태별 표시 조건
    if (statusText === "대기 중" && now - createdAtTimestamp > SIX_HOUR) return;
    if (statusText === "게임 중" && now - createdAtTimestamp > ONE_HOUR) return;
    if (statusText === "게임 종료") return;

    const roomDiv = document.createElement("div");
    roomDiv.className = "modal-content";
    if (player1Exists && !player2Exists) {
      roomDiv.classList.remove("disabled");
      roomDiv.style.cursor = "pointer";
      roomDiv.onclick = () => joinExistingRoom(roomId);
    } else {
      roomDiv.classList.add("disabled");
    }

    // 방 제목
    const title = document.createElement("div");
    title.className = "room-title";
    title.textContent = `${roomId} (${player2Exists ? "2/2" : "1/2"})`;
    roomDiv.appendChild(title);

    // 특수 규칙
    const extRules = roomData.state?.extensionRules || {};
    const modes = [];
    if (extRules.useRainbow11) modes.push("무지개 11");
    const modeDiv = document.createElement("div");
    modeDiv.className = "room-mode";
    modeDiv.textContent = modes.length > 0 ? `모드: ${modes.join(", ")}` : "모드: 없음";
    roomDiv.appendChild(modeDiv);

    // 플레이어 닉네임 (세로 배열)
    const playersDiv = document.createElement("div");
    playersDiv.className = "room-players";
    const p1Name = players.player1 ? players.player1.name : "";
    const p2Name = players.player2 ? players.player2.name : "";
    playersDiv.innerHTML = `${p1Name}<br>${p2Name}`;
    roomDiv.appendChild(playersDiv);

    // 상태
    const statusDiv = document.createElement("div");
    statusDiv.className = "room-status";
    statusDiv.textContent = `상태: ${statusText}`;
    roomDiv.appendChild(statusDiv);

    // 개설 날짜
    if (createdAtTimestamp) {
      const date = new Date(createdAtTimestamp);
      const dateStr = date.toLocaleString();
      const dateDiv = document.createElement("div");
      dateDiv.className = "room-date";
      dateDiv.textContent = dateStr;
      roomDiv.appendChild(dateDiv);
    }

    roomListDiv.appendChild(roomDiv);
  });
}

// 기존 방 입장 시도
async function joinExistingRoom(roomId) {
  const playerName = inputPlayerName.value.trim();
  if (!playerName) {
    alert("닉네임을 입력하세요.");
    return;
  }

  const playerId = await joinRoom(roomId, playerName);
  if (!playerId) return;

  localStorage.setItem("roomId", roomId);
  localStorage.setItem("playerId", playerId);

  modalJoin.style.display = "none";
  location.href = "game.html";
}
