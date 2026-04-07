import { PieceType, BOARD_SIZE, Piece } from './types';

export function isValidMove(type: PieceType, fromX: number, fromY: number, toX: number, toY: number, board: (Piece | null)[][]): boolean {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);

  if (toX < 0 || toX >= BOARD_SIZE || toY < 0 || toY >= BOARD_SIZE) return false;
  if (fromX === toX && fromY === toY) return false;

  switch (type) {
    case 'king':
      return dx <= 1 && dy <= 1;
    case 'rook':
      if (fromX !== toX && fromY !== toY) return false;
      return isPathClear(fromX, fromY, toX, toY, board);
    case 'bishop':
      if (dx !== dy) return false;
      return isPathClear(fromX, fromY, toX, toY, board);
    case 'queen':
      if (dx !== dy && fromX !== toX && fromY !== toY) return false;
      return isPathClear(fromX, fromY, toX, toY, board);
    case 'knight':
      return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    case 'pawn':
      // Simplified pawn: move 1 forward towards player's Y, capture diagonal
      const direction = toY > fromY ? 1 : -1; 
      if (toX === fromX && toY === fromY + direction) {
        return !board[toY][toX];
      }
      if (Math.abs(toX - fromX) === 1 && toY === fromY + direction) {
        return !!board[toY][toX] && board[toY][toX]?.color === 'black';
      }
      return false;
    default:
      return false;
  }
}

function isPathClear(fromX: number, fromY: number, toX: number, toY: number, board: (Piece | null)[][]): boolean {
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  let x = fromX + dx;
  let y = fromY + dy;

  while (x !== toX || y !== toY) {
    if (board[y][x]) return false;
    x += dx;
    y += dy;
  }
  return true;
}

export function getPieceMoves(piece: Piece, board: (Piece | null)[][]): { x: number, y: number }[] {
  const moves = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (isValidMove(piece.type, piece.x, piece.y, x, y, board)) {
        moves.push({ x, y });
      }
    }
  }
  return moves;
}

export function getInitialEnemies(floor: number): Piece[] {
  const enemies: Piece[] = [];
  const enemyTypes: PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
  
  // Basic setup: a few pawns and one stronger piece
  const count = Math.min(3 + floor, 10);
  for (let i = 0; i < count; i++) {
    const type = i === 0 && floor > 1 ? enemyTypes[Math.floor(Math.random() * (enemyTypes.length - 1)) + 1] : 'pawn';
    enemies.push({
      id: `enemy-${i}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      color: 'white',
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * 3), // Top 3 rows
      hp: type === 'pawn' ? 1 : 2,
      maxHp: type === 'pawn' ? 1 : 2,
    });
  }
  return enemies;
}
