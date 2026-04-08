export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type Color = 'white' | 'black';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  rotation?: number;
  hasArmor?: boolean;
  willAct?: boolean;
}

export interface GameState {
  board: (Piece | null)[][];
  player: Piece;
  enemies: Piece[];
  turn: 'player' | 'enemy';
  ammo: number;
  maxAmmo: number;
  playerDamage: number;
  playerRange: number;
  floor: number;
  isGameOver: boolean;
  isVictory: boolean;
  showBuffSelection: boolean;
  availableBuffs: BuffCard[];
  activeBuffs: BuffCard[];
  message: string;
  enemyHpBonus: number;
  enemyCountBonus: number;
  hoveredPiece: Piece | null;
  // New Buff/Nerf properties
  actionsPerTurn: number;
  currentActions: number;
  hasExtraLife: number;
  turnCounter: number;
  moatSquares: { x: number, y: number }[];
  isGrenadeLauncher: boolean;
  isMartyrdom: boolean;
  isPikemen: boolean;
  wingsCooldown: number;
  isSniperScoop: boolean;
  isBuckshot: boolean;
  isSawedOff: boolean;
  isFullHouse: boolean;
  isConscription: boolean;
  isArmoredVest: boolean;
  isHighCouncil: boolean;
  ammoOnMove: boolean;
  difficulty: Difficulty;
  isBossNerf: boolean;
  isSniperGun: boolean;
  isMuted: boolean;
}

export interface BuffCard {
  id: string;
  title: string;
  description: string;
  playerEffect: (state: GameState) => Partial<GameState>;
  enemyEffect: (state: GameState) => Partial<GameState>;
}

export const BOARD_SIZE = 8;
