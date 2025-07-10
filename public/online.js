const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const SQUARE_SIZE = 67.5;
const DIMENSION = 8;
const LEFT_MARGIN = 20;
const RIGHT_MARGIN = 20;  
const BOARD_TOP = 120;
const BOARD_BOTTOM = 120;
const BEIGE = "#f0d9b5";
const BROWN = "#b58863";
const socket = io();



const canvasWidth = SQUARE_SIZE * DIMENSION + LEFT_MARGIN + RIGHT_MARGIN;
const canvasHeight = SQUARE_SIZE * DIMENSION + BOARD_TOP + BOARD_BOTTOM;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

const boardOffsetX = LEFT_MARGIN;
const boardOffsetY = BOARD_TOP;

let board = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  ["__", "__", "__", "__", "__", "__", "__", "__"],
  ["__", "__", "__", "__", "__", "__", "__", "__"],
  ["__", "__", "__", "__", "__", "__", "__", "__"],
  ["__", "__", "__", "__", "__", "__", "__", "__"],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
];

let pieceImages = {};  
let selected = null;
let validMoves = [];
let whiteLost = [], blackLost = [];
let moveHistory = [];
let turn = "w";
let moved = {
  wk: false, bk: false,
  wr1: false, wr2: false,
  br1: false, br2: false
};
let gameStarted = false;
let gameOver = false;
let playerColor = null;
let imagesLoaded = false;
let pendingMove = null;
socket.on("playerColor", color => {
  playerColor = color;
  turn = "w";
});

socket.on("opponentMove", data => {
  console.log("📥 opponentMove received", data);
  if (!imagesLoaded) {
    console.log("⏳ Images not loaded, saving to pendingMove");
    pendingMove = data;
  } else {
    console.log("✅ Images loaded, applying move now");
    applyOpponentMove(data);
  }
});


socket.on("startGame", () => {
  gameStarted = true;
  drawBoard();
});

socket.on("opponentLeft", () => {
  restartGame();
});

const moveSound = new Audio('sounds/move.mp3');
const captureSound = new Audio('sounds/capture.mp3');

function loadImages() {
  const types = ["wp", "wr", "wn", "wb", "wq", "wk", "bp", "br", "bn", "bb", "bq", "bk"];
  let count = 0;
  types.forEach(type => {
    const img = new Image();
    img.src = `images/${type}.png`;
    img.onload = () => {
      pieceImages[type] = img;
      if (++count === types.length){
        imagesLoaded = true;
        drawBoard();
        if (pendingMove) {
          applyOpponentMove(pendingMove);
          pendingMove = null;
        }
      } 
    };
  });
}

function applyOpponentMove(data) {
  board = data.board;
  whiteLost = data.whiteLost;
  blackLost = data.blackLost;
  moved = data.moved;
  moveHistory = data.moveHistory;
  turn = data.turn;
  selected = null;
  validMoves = [];
  drawBoard();
  updateSidebar();
  updateMoveHistory();
}

function drawPlayerInfo() {
  const avatarSize = 60;

  // Player 2 (Black) Top
  const blackY = 50;
  const avatarImg2 = new Image();
  avatarImg2.src = 'images/player2.png';
  avatarImg2.onload = () => ctx.drawImage(avatarImg2, 10, blackY - avatarSize / 2, avatarSize, avatarSize);

  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Người chơi 2 (Đen)", 70, blackY);

  let bx = 80;
  // Quân trắng bị ăn (whiteLost) hiện bên Người chơi 2 (Black)
  whiteLost.forEach(piece => {
    if (pieceImages[piece]) {
      ctx.drawImage(pieceImages[piece], bx, blackY + avatarSize / 2 - 10, 25, 25);
      bx += 28;
    }
  });

  // Player 1 (White) Bottom
  const whiteY = canvas.height - 70;
  const avatarImg1 = new Image();
  avatarImg1.src = 'images/player1.png';
  avatarImg1.onload = () => ctx.drawImage(avatarImg1, 10, whiteY - avatarSize / 2, avatarSize, avatarSize);

  ctx.fillStyle = "#333"; // màu chữ dễ đọc hơn trên nền sáng
  ctx.fillText("Người chơi 1 (Trắng)", 70, whiteY);

  let wx = 80;
  // Quân đen bị ăn (blackLost) hiện bên Người chơi 1 (White)
  blackLost.forEach(piece => {
    if (pieceImages[piece]) {
      ctx.drawImage(pieceImages[piece], wx, whiteY + avatarSize / 2 - 10, 25, 25);
      wx += 28;
    }
  });
}


function drawBoard() {
  console.log("🔁 Drawing board:", board);
  if (!imagesLoaded) return;
  ctx.fillStyle = "#a89c90"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const files = ['a','b','c','d','e','f','g','h'];

  for (let r = 0; r < DIMENSION; r++) {
    for (let c = 0; c < DIMENSION; c++) {
      const x = boardOffsetX + c * SQUARE_SIZE;
      const y = boardOffsetY + r * SQUARE_SIZE;

      const color = (r + c) % 2 === 0 ? BEIGE : BROWN;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);

      if (selected && validMoves.some(m => m[0] === r && m[1] === c)) {
        ctx.fillStyle = "rgba(0,255,0,0.3)";
        ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
      }

      const piece = board[r][c];
      if (piece !== "__") {
        ctx.drawImage(pieceImages[piece], x, y, SQUARE_SIZE, SQUARE_SIZE);
      }
    }
  }

  // Draw files (a-h)
  ctx.fillStyle = "black";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let c = 0; c < DIMENSION; c++) {
    const x = boardOffsetX + c * SQUARE_SIZE + SQUARE_SIZE / 2;
    const y = boardOffsetY + DIMENSION * SQUARE_SIZE + 10;
    ctx.fillText(files[c], x, y);
  }

  // Draw ranks (8-1)
  for (let r = 0; r < DIMENSION; r++) {
    const y = boardOffsetY + r * SQUARE_SIZE + SQUARE_SIZE / 2;
    const x = LEFT_MARGIN / 2;
    ctx.fillText(8 - r, x, y);
  }

  drawPlayerInfo();
}


function getSquare(x, y) {
  return [
    Math.floor((y - boardOffsetY) / SQUARE_SIZE),
    Math.floor((x - boardOffsetX) / SQUARE_SIZE)
  ];
}


function getMoves(piece, r, c) {
  const type = piece[1];
  const color = piece[0];
  const moves = [];

  const isEnemy = (row, col) => board[row][col] !== "__" && board[row][col][0] !== color;
  const isEmpty = (row, col) => board[row][col] === "__";

  const add = (dr, dc, repeat = false) => {
    let row = r + dr, col = c + dc;
    while (row >= 0 && row < 8 && col >= 0 && col < 8) {
      if (isEmpty(row, col)) {
        moves.push([row, col]);
      } else {
        if (isEnemy(row, col)) moves.push([row, col]);
        break;
      }
      if (!repeat) break;
      row += dr;
      col += dc;
    }
  };

  switch (type) {
    case "p": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      if (isEmpty(r + dir, c)) {
        moves.push([r + dir, c]);
        if (r === startRow && isEmpty(r + 2 * dir, c)) {
          moves.push([r + 2 * dir, c]);
        }
      }
      [-1, 1].forEach(dc => {
        const nr = r + dir, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && isEnemy(nr, nc)) {
          moves.push([nr, nc]);
        }
      });
      break;
    }

    case "r":
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => add(dr, dc, true));
      break;

    case "b":
      [[1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([dr, dc]) => add(dr, dc, true));
      break;

    case "q":
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([dr, dc]) => add(dr, dc, true));
      break;

    case "k":
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([dr, dc]) => add(dr, dc, false));
      if (canCastle(r, 'kingside')) moves.push([r, 6]);
      if (canCastle(r, 'queenside')) moves.push([r, 2]);
      break;

    case "n":
      [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && (isEmpty(nr, nc) || isEnemy(nr, nc))) {
          moves.push([nr, nc]);
        }
      });
      break;
  }

  return moves;
}


canvas.addEventListener("click", e => {
  if (gameOver) return;
  if (!gameStarted) return;
  if (turn !== playerColor) return; // Không được đi nếu không đến lượt


  const [row, col] = getSquare(e.offsetX , e.offsetY );
  const piece = board[row][col];

  if (selected) {
    const isValid = validMoves.some(m => m[0] === row && m[1] === col);
    if (isValid) {
      const captured = board[row][col];
      if (captured !== "__") {
        captureSound.play();
        if (captured[0] === "w") whiteLost.push(captured);
        else blackLost.push(captured);
      } else {
        moveSound.play();
      }

      const fromPiece = board[selected[0]][selected[1]];
      moveHistory.push({
        notation: toChessNotation(selected[0], selected[1], row, col, fromPiece, captured),
        color: fromPiece[0] // "w" hoặc "b"
      });
      updateMoveHistory();

      if (fromPiece === "wk") {
        moved.wk = true;
        if (row === 7 && col === 6) { // kingside
            board[7][5] = board[7][7];
            board[7][7] = "__";
            moved.wr2 = true;
        } else if (row === 7 && col === 2) { // queenside
            board[7][3] = board[7][0];
            board[7][0] = "__";
            moved.wr1 = true;
        }
      }
      if (fromPiece === "bk") {
        moved.bk = true;
        if (row === 0 && col === 6) {
            board[0][5] = board[0][7];
            board[0][7] = "__";
            moved.br2 = true;
        } else if (row === 0 && col === 2) {
            board[0][3] = board[0][0];
            board[0][0] = "__";
            moved.br1 = true;
        }
      }

      if (fromPiece === "wr" && selected[1] === 0) moved.wr1 = true;
      if (fromPiece === "wr" && selected[1] === 7) moved.wr2 = true;
      if (fromPiece === "br" && selected[1] === 0) moved.br1 = true;
      if (fromPiece === "br" && selected[1] === 7) moved.br2 = true;

      board[selected[0]][selected[1]] = "__";
      if (captured === "wk" || captured === "bk") {
        board[row][col] = "__"; 
        board[row][col] = fromPiece;
        socket.emit('move', {
          from: selected,
          to: [row, col],
          piece: fromPiece
        });
        drawBoard();            
        setTimeout(() => {
          showGameOver(captured === "wk" ? "Black wins! Game Over." : "White wins! Game Over.");
          gameOver = true;
        }, 100); 
        return;
      }


      board[row][col] = fromPiece;

      board[row][col] = fromPiece;
      checkPromotion(row, col, fromPiece); 
      const selectedFrom = selected;
      selected = null;
      validMoves = [];
      if (!promotionRow) drawBoard();

      turn = turn === "w" ? "b" : "w";

      socket.emit("move", {
        board: JSON.parse(JSON.stringify(board)),
        whiteLost: [...whiteLost],
        blackLost: [...blackLost],
        moved: { ...moved },
        moveHistory: [...moveHistory],
        turn
      });
     
      updateSidebar();

    } else {
      selected = null;
      validMoves = [];
    }
  } else {
    if (piece !== "__" && piece[0] === turn && piece[0] === playerColor) {
      selected = [row, col];
      validMoves = getMoves(piece, row, col);
    }
  }
  drawBoard();
});

let promotionRow = null;
let promotionCol = null;
let promotionColor = null;

function checkPromotion(row, col, piece) {
  if ((piece === 'wp' && row === 0) || (piece === 'bp' && row === 7)) {
    promotionRow = row;
    promotionCol = col;
    promotionColor = piece[0]; 
    document.getElementById('promotion-modal').style.display = 'block';
    document.querySelectorAll('#promotion-modal img').forEach(img => {
      const type = img.alt.toLowerCase().charAt(0); 
      img.src = `images/${promotionColor}${type}.png`;
    });
  }
}

function promote(newPiece) {
  board[promotionRow][promotionCol] = promotionColor + newPiece;
  document.getElementById('promotion-modal').style.display = 'none';
  promotionRow = null;
  promotionCol = null;
  promotionColor = null;
  drawBoard(); 
}


function canCastle(row, side) {
  if (turn === 'w' && row === 7) {
    if (side === 'kingside') {
      return !moved.wk && !moved.wr2 &&
        board[7][5] === "__" && board[7][6] === "__";
    } else {
      return !moved.wk && !moved.wr1 &&
        board[7][1] === "__" && board[7][2] === "__" && board[7][3] === "__";
    }
  }

  if (turn === 'b' && row === 0) {
    if (side === 'kingside') {
      return !moved.bk && !moved.br2 &&
        board[0][5] === "__" && board[0][6] === "__";
    } else {
      return !moved.bk && !moved.br1 &&
        board[0][1] === "__" && board[0][2] === "__" && board[0][3] === "__";
    }
  }

  return false;
}

function toChessNotation(fromRow, fromCol, toRow, toCol , piece, captured) {
    const files = ['a','b','c','d','e','f','g','h'];
    const ranks = ['8','7','6','5','4','3','2','1'];
    const to = files[toCol] + ranks[toRow];
    const pieceChar = piece[1].toLowerCase() === 'p' ? '' : piece[1].toUpperCase();
    return pieceChar + to;
}

function updateMoveHistory() {
    const movesList = document.getElementById('moves-list');
    movesList.innerHTML = '';

    for (let i = 0; i < moveHistory.length; i += 2) {
        const whiteMove = moveHistory[i];
        const blackMove = moveHistory[i + 1];
        const li = document.createElement('li');
        li.innerHTML = `
          ${whiteMove ? getMoveIcon(whiteMove.notation, whiteMove.color) : ''}
          ${blackMove ? ' | ' + getMoveIcon(blackMove.notation, blackMove.color) : ''}
        `;

        movesList.appendChild(li);
    }
    movesList.scrollTop = movesList.scrollHeight;    
}

function getMoveIcon(move, color) {
  const pieceMap = {
    R: 'r', N: 'n', B: 'b', Q: 'q', K: 'k',
  };

  const pieceChar = move[0];
  const square = pieceChar.match(/[RNBQK]/) ? move.slice(1) : move;

  const piece = pieceMap[pieceChar] || 'p';
  const imgSrc = `images/${color}${piece}.png`;

  return `
    <img src="${imgSrc}" alt="${piece}" width="20" style="vertical-align:middle;" />
    ${square}
  `;
}

function showGameOver(message) {
  const overlay = document.createElement("div");
  overlay.id = "game-over-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
  overlay.style.color = "#fff";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.fontSize = "36px";
  overlay.style.zIndex = 1000;

  const text = document.createElement("div");
  text.innerText = message;

  const button = document.createElement("button");
  button.innerText = "Chơi lại";
  button.style.marginTop = "20px";
  button.style.fontSize = "20px";
  button.style.padding = "10px 20px";
  button.style.cursor = "pointer";

  button.addEventListener("click", () => {
    document.body.removeChild(overlay);
    setTimeout(() => {
      restartGame();
    }, 0);    
  });

  overlay.appendChild(text);
  overlay.appendChild(button);
  document.body.appendChild(overlay);
}

function updateSidebar() {
  document.getElementById("turn").textContent = `Turn: ${turn === "w" ? "White" : "Black"}`;
  document.getElementById("white-lost").textContent = whiteLost.join(" ");
  document.getElementById("black-lost").textContent = blackLost.join(" ");
}

function startGame() {
  document.getElementById("menu").style.display = "none";
  drawBoard();
}

function quitGame() {
  window.close();
}

function restartGame() {
  board = [
    ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
    ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["__", "__", "__", "__", "__", "__", "__", "__"],
    ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
    ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
  ];
  whiteLost = [];
  blackLost = [];
  selected = null;
  validMoves = [];
  turn = "w";
  gameOver = false;
  moved = { wk: false, bk: false, wr1: false, wr2: false, br1: false, br2: false };
  updateSidebar();
  drawBoard();
}

socket.emit("joinGame");

loadImages();