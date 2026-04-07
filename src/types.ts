export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type Color = 'white' | 'black';

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  rotation?: number;
}

export interface GameState {
  board: (Piece | null)[][];
  player: Piece;
  enemies: Piece[];
  turn: 'player' | 'enemy';
  ammo: number;
  maxAmmo: number;
  floor: number;
  isGameOver: boolean;
  isVictory: boolean;
  message: string;
}

export const BOARD_SIZE = 8;
