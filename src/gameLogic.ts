import { PieceType, BOARD_SIZE, Piece, Difficulty } from './types';

export function isValidMove(type: PieceType, fromX: number, fromY: number, toX: number, toY: number, board: (Piece | null)[][], isPikemen: boolean = false, difficulty: Difficulty = 'normal'): boolean {
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
      if (difficulty !== 'hard' && dx > 2) return false;
      return isPathClear(fromX, fromY, toX, toY, board);
    case 'queen':
      if (dx !== dy && fromX !== toX && fromY !== toY) return false;
      return isPathClear(fromX, fromY, toX, toY, board);
    case 'knight':
      return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    case 'pawn':
      const targetPiece = board[toY][toX];
      const pdx = Math.abs(toX - fromX);
      const pdy = Math.abs(toY - fromY);
      
      if (targetPiece) {
        // Attack: must be diagonal 1 (only against player/opponent)
        return targetPiece.color === 'black' && pdx === 1 && pdy === 1;
      } else {
        // Move: must be straight 1 (vertical)
        return pdx === 0 && pdy === 1;
      }
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

export function getPieceMoves(piece: Piece, board: (Piece | null)[][], difficulty: Difficulty = 'normal'): { x: number, y: number }[] {
  const moves = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (isValidMove(piece.type, piece.x, piece.y, x, y, board, false, difficulty)) {
        moves.push({ x, y });
      }
    }
  }
  return moves;
}

export function getInitialEnemies(
  floor: number, 
  hpBonus: number = 0, 
  countBonus: number = 0,
  isConscription: boolean = false,
  isFullHouse: boolean = false,
  isArmoredVest: boolean = false,
  isBossNerf: boolean = false
): Piece[] {
  const enemies: Piece[] = [];
  const occupiedPositions = new Set<string>();

  const addEnemy = (type: PieceType, x: number, y: number, hp: number, hasArmor: boolean = false) => {
    const posKey = `${x},${y}`;
    if (occupiedPositions.has(posKey)) return false;
    
    enemies.push({
      id: `enemy-${type}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      color: 'white',
      x,
      y,
      hp,
      maxHp: hp,
      hasArmor
    });
    occupiedPositions.add(posKey);
    return true;
  };

  // Always add 1 King at the top center
  const kingHp = Math.max(1, 1 + Math.floor(floor / 2) + hpBonus);
  addEnemy('king', 4, 0, kingHp);

  // Boss: Add 1 Queen
  if (isBossNerf) {
    // Try to find a spot for the Queen
    let placed = false;
    for (let y = 0; y < 3 && !placed; y++) {
      for (let x = 0; x < BOARD_SIZE && !placed; x++) {
        if (addEnemy('queen', x, y, 2 + hpBonus)) {
          placed = true;
        }
      }
    }
  }

  // Conscription: +4 Pawns in front line
  if (isConscription) {
    for (let i = 0; i < 4; i++) {
      const x = (i * 2) % BOARD_SIZE;
      addEnemy('pawn', x, 2, 1 + hpBonus);
    }
  }

  // Full House: Replace 4 Pawns with 1 Rook, 1 Bishop, 1 Knight
  let specialPiecesToPlace: PieceType[] = isFullHouse ? ['rook', 'bishop', 'knight'] : [];

  const enemyTypes: PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
  
  // Scaling: more enemies as floors increase
  const count = Math.min(3 + floor + countBonus, 15);
  let attempts = 0;
  while (enemies.length < count && attempts < 100) {
    attempts++;
    let type: PieceType = 'pawn';

    if (specialPiecesToPlace.length > 0) {
      type = specialPiecesToPlace.shift()!;
    } else {
      const typeRoll = Math.random() * (floor + 2);
      if (typeRoll > 10) type = 'queen';
      else if (typeRoll > 8) type = 'rook';
      else if (typeRoll > 6) type = 'bishop';
      else if (typeRoll > 4) type = 'knight';
    }

    const baseHp = type === 'pawn' ? 1 : 2;
    const finalHp = Math.max(1, baseHp + hpBonus);

    const x = Math.floor(Math.random() * BOARD_SIZE);
    const y = Math.floor(Math.random() * 3); // Top 3 rows
    
    // Armored Vest: 50% chance for armor
    const hasArmor = isArmoredVest && Math.random() > 0.5;
    
    addEnemy(type, x, y, finalHp, hasArmor);
  }
  return enemies;
}
