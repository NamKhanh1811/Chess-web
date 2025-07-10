const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const INITIAL_BOARD_STATE = {
  board: [
    ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
    ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
    ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
  ],
  whiteLost: [],
  blackLost: [],
  moved: { wk: false, bk: false, wr1: false, wr2: false, br1: false, br2: false },
  moveHistory: [],
  turn: "w"
};

app.use(express.static('public'));

let rooms = {};
let gameStates = {}; // Lưu trạng thái bàn cờ

function sendGameStateTo(socket, state) {
  socket.emit("opponentMove", {
    board: state.board,
    whiteLost: state.whiteLost,
    blackLost: state.blackLost,
    moved: state.moved,
    moveHistory: state.moveHistory,
    turn: state.turn
  });
}


io.on("connection", (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on("joinGame", () => {
    let roomId = null;

    for (const id in rooms) {
      if (rooms[id].length === 1) {
        roomId = id;
        break;
      }
    }

    if (!roomId) {
      roomId = socket.id;
      rooms[roomId] = [];
      gameStates[roomId] = JSON.parse(JSON.stringify(INITIAL_BOARD_STATE));
    }

    if (!rooms[roomId].includes(socket.id)) {
      rooms[roomId].push(socket.id);
      socket.join(roomId);
      socket.data.roomId = roomId;
      console.log(`📥 ${socket.id} joined room ${roomId}`);
    }

    const playerColor = rooms[roomId].length === 1 ? "w" : "b";
    socket.emit("playerColor", playerColor);

    if (rooms[roomId].length === 2) {
      io.to(roomId).emit("startGame");
      io.to(roomId).emit("opponentMove", gameStates[roomId]);
    }
  });

  // ✅ LUÔN đặt ngoài joinGame
  socket.on("move", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const newData = {
      board: JSON.parse(JSON.stringify(data.board)),
      whiteLost: [...data.whiteLost],
      blackLost: [...data.blackLost],
      moved: { ...data.moved },
      moveHistory: [...data.moveHistory],
      turn: data.turn
    };
    gameStates[roomId] = newData;
    socket.to(roomId).emit("opponentMove", newData);
  });

  // ✅ LUÔN đặt ngoài joinGame
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    console.log(`❌ ${socket.id} disconnected`);
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        delete gameStates[roomId];
      } else {
        socket.to(roomId).emit("opponentLeft");
      }
    }
  });
});


// ✅ KHÔNG ĐƯỢC QUÊN DÒNG NÀY
server.listen(3000, () => {
  console.log('🚀 Server is running at http://localhost:3000');
});
