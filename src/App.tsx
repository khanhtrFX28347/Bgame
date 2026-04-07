import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Crown, 
  Shield, 
  Zap, 
  Sword, 
  Flame, 
  Target, 
  Crosshair, 
  RotateCcw, 
  ChevronRight,
  Skull,
  Trophy,
  Info,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Move
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Piece, PieceType, GameState, BOARD_SIZE } from './types';
import { isValidMove, getInitialEnemies } from './gameLogic';
import { cn } from './lib/utils';

const INITIAL_PLAYER: Piece = {
  id: 'player',
  type: 'king',
  color: 'black',
  x: 4,
  y: 7,
  hp: 3,
  maxHp: 3,
};

// Custom Horse icon since lucide might not have it in all versions
const Horse = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3c-4.5 0-8 3.5-8 8v10h16v-10c0-4.5-3.5-8-8-8z" />
    <path d="M12 3v18" />
    <path d="M8 11h8" />
  </svg>
);

const PIECE_ICONS: Record<PieceType, React.ElementType> = {
  king: Crown,
  queen: Flame,
  rook: Shield,
  bishop: Zap,
  knight: Horse,
  pawn: Sword,
};

const PIECE_NAMES: Record<PieceType, string> = {
  king: 'King',
  queen: 'Queen',
  rook: 'Rook',
  bishop: 'Bishop',
  knight: 'Knight',
  pawn: 'Pawn',
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    player: { ...INITIAL_PLAYER },
    enemies: getInitialEnemies(1),
    turn: 'player',
    ammo: 2,
    maxAmmo: 2,
    floor: 1,
    isGameOver: false,
    isVictory: false,
    message: 'Your turn, King. Move to reload, shoot to kill.',
  });

  const [selectedCell, setSelectedCell] = useState<{ x: number, y: number } | null>(null);
  const [lastShot, setLastShot] = useState<{ x: number, y: number, time: number } | null>(null);

  // Update board whenever player or enemies move
  const board = useMemo(() => {
    const newBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    newBoard[gameState.player.y][gameState.player.x] = gameState.player;
    gameState.enemies.forEach(enemy => {
      newBoard[enemy.y][enemy.x] = enemy;
    });
    return newBoard;
  }, [gameState.player, gameState.enemies]);

  const checkGameOver = useCallback((player: Piece, enemies: Piece[]) => {
    if (player.hp <= 0) return { isGameOver: true, message: 'CHECKMATE. The White army has fallen you.' };
    if (enemies.length === 0) return { isVictory: true, message: 'FLOOR CLEARED. Descending deeper...' };
    return null;
  }, []);

  const handlePlayerMove = (x: number, y: number) => {
    if (gameState.turn !== 'player' || gameState.isGameOver || gameState.isVictory) return;

    // Check if it's a valid move for a King
    if (Math.abs(x - gameState.player.x) <= 1 && Math.abs(y - gameState.player.y) <= 1) {
      // Check if square is occupied by enemy
      const enemyAtTarget = gameState.enemies.find(e => e.x === x && e.y === y);
      
      if (enemyAtTarget) {
        // Capture move (if King can capture? In Shotgun King, King can capture by moving onto them)
        const newEnemies = gameState.enemies.filter(e => e.id !== enemyAtTarget.id);
        setGameState(prev => ({
          ...prev,
          player: { ...prev.player, x, y },
          enemies: newEnemies,
          ammo: Math.min(prev.ammo + 1, prev.maxAmmo),
          turn: 'enemy',
          message: 'Captured! +1 Ammo.',
        }));
      } else {
        // Normal move
        setGameState(prev => ({
          ...prev,
          player: { ...prev.player, x, y },
          ammo: Math.min(prev.ammo + 1, prev.maxAmmo),
          turn: 'enemy',
          message: 'Moved. +1 Ammo.',
        }));
      }
    }
  };

  const handleShoot = (x: number, y: number) => {
    if (gameState.turn !== 'player' || gameState.isGameOver || gameState.isVictory || gameState.ammo <= 0) return;

    const dx = x - gameState.player.x;
    const dy = y - gameState.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Shotgun range: 3 squares
    if (dist > 4) {
      setGameState(prev => ({ ...prev, message: 'Out of range!' }));
      return;
    }

    setLastShot({ x, y, time: Date.now() });

    // Damage logic: 1-2 damage depending on distance
    const damage = dist <= 2 ? 2 : 1;
    
    let hitAny = false;
    const newEnemies = gameState.enemies.map(enemy => {
      // Hit logic: direct hit or very close (spread)
      const edx = enemy.x - x;
      const edy = enemy.y - y;
      const hitDist = Math.sqrt(edx * edx + edy * edy);
      
      if (hitDist < 1.1) { // Direct hit or adjacent
        hitAny = true;
        return { ...enemy, hp: enemy.hp - damage };
      }
      return enemy;
    }).filter(enemy => enemy.hp > 0);

    setGameState(prev => ({
      ...prev,
      enemies: newEnemies,
      ammo: prev.ammo - 1,
      turn: 'enemy',
      message: hitAny ? `BOOM! Dealt ${damage} damage.` : 'Missed!',
    }));
  };

  // Enemy AI
  useEffect(() => {
    if (gameState.turn === 'enemy' && !gameState.isGameOver && !gameState.isVictory) {
      const timer = setTimeout(() => {
        let newPlayer = { ...gameState.player };
        let newEnemies = [...gameState.enemies];
        let moved = false;

        // Simple AI: Each enemy tries to move towards player or capture
        newEnemies = newEnemies.map(enemy => {
          if (moved) return enemy; // Only one enemy moves per turn for simplicity/balance? 
          // Actually in Shotgun King, all enemies move if they can.
          
          const dx = Math.sign(gameState.player.x - enemy.x);
          const dy = Math.sign(gameState.player.y - enemy.y);
          
          // Try to capture player
          if (isValidMove(enemy.type, enemy.x, enemy.y, gameState.player.x, gameState.player.y, board)) {
            newPlayer.hp -= 1;
            moved = true;
            return enemy; // Stays in place after "attacking" or moves to player's square?
            // In chess, they move to the square.
          }

          // Try to move closer
          const possibleMoves = [];
          for (let ty = 0; ty < BOARD_SIZE; ty++) {
            for (let tx = 0; tx < BOARD_SIZE; tx++) {
              if (isValidMove(enemy.type, enemy.x, enemy.y, tx, ty, board)) {
                const dist = Math.sqrt(Math.pow(tx - gameState.player.x, 2) + Math.pow(ty - gameState.player.y, 2));
                possibleMoves.push({ x: tx, y: ty, dist });
              }
            }
          }

          if (possibleMoves.length > 0) {
            // Sort by distance to player
            possibleMoves.sort((a, b) => a.dist - b.dist);
            const bestMove = possibleMoves[0];
            moved = true;
            return { ...enemy, x: bestMove.x, y: bestMove.y };
          }

          return enemy;
        });

        const status = checkGameOver(newPlayer, newEnemies);
        setGameState(prev => ({
          ...prev,
          player: newPlayer,
          enemies: newEnemies,
          turn: 'player',
          isGameOver: status?.isGameOver || false,
          isVictory: status?.isVictory || false,
          message: status?.message || 'Your turn, King.',
        }));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [gameState.turn, gameState.player, gameState.enemies, board, checkGameOver]);

  const resetGame = () => {
    setGameState({
      board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
      player: { ...INITIAL_PLAYER },
      enemies: getInitialEnemies(1),
      turn: 'player',
      ammo: 2,
      maxAmmo: 2,
      floor: 1,
      isGameOver: false,
      isVictory: false,
      message: 'Your turn, King. Move to reload, shoot to kill.',
    });
    setSelectedCell(null);
  };

  const nextFloor = () => {
    setGameState(prev => ({
      ...prev,
      enemies: getInitialEnemies(prev.floor + 1),
      floor: prev.floor + 1,
      isVictory: false,
      turn: 'player',
      message: `Floor ${prev.floor + 1}. The army grows stronger.`,
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 font-mono selection:bg-red-500 selection:text-white">
      {/* Header */}
      <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black tracking-tighter text-red-600 uppercase italic">
            Shotgun King
          </h1>
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
            The Final Checkmate Clone
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-sm flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 font-bold uppercase">Floor</span>
            <span className="text-xl font-black text-red-500">{gameState.floor}</span>
          </div>
          <button 
            onClick={resetGame}
            className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white"
            title="Reset Game"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative group">
        {/* Board */}
        <div className="grid grid-cols-8 border-4 border-neutral-800 shadow-2xl shadow-red-900/20 bg-neutral-900">
          {Array(BOARD_SIZE).fill(null).map((_, y) => (
            Array(BOARD_SIZE).fill(null).map((_, x) => {
              const piece = board[y][x];
              const isPlayer = piece?.id === 'player';
              const isEnemy = piece && !isPlayer;
              const isSelected = selectedCell?.x === x && selectedCell?.y === y;
              const isDark = (x + y) % 2 === 1;
              
              // Valid move highlight for player
              const canMoveTo = gameState.turn === 'player' && 
                                !gameState.isGameOver && 
                                Math.abs(x - gameState.player.x) <= 1 && 
                                Math.abs(y - gameState.player.y) <= 1 &&
                                !(x === gameState.player.x && y === gameState.player.y);

              return (
                <div 
                  key={`${x}-${y}`}
                  onClick={() => {
                    if (isEnemy) handleShoot(x, y);
                    else if (canMoveTo) handlePlayerMove(x, y);
                  }}
                  className={cn(
                    "w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center relative cursor-pointer transition-all duration-200",
                    isDark ? "bg-neutral-800" : "bg-neutral-700",
                    canMoveTo && "hover:bg-green-500/30",
                    isEnemy && "hover:bg-red-500/40"
                  )}
                >
                  {/* Coordinate Labels */}
                  {x === 0 && <span className="absolute left-0.5 top-0.5 text-[8px] text-neutral-500 font-bold">{8-y}</span>}
                  {y === 7 && <span className="absolute right-0.5 bottom-0.5 text-[8px] text-neutral-500 font-bold">{String.fromCharCode(97 + x)}</span>}

                  {/* Move Indicator */}
                  {canMoveTo && !piece && (
                    <div className="w-2 h-2 bg-green-500/50 rounded-full" />
                  )}

                  {/* Piece */}
                  <AnimatePresence mode="popLayout">
                    {piece && (
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className={cn(
                          "relative z-10",
                          isPlayer ? "text-neutral-950 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-white drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]"
                        )}
                      >
                        {React.createElement(PIECE_ICONS[piece.type], { 
                          size: 32, 
                          className: cn(
                            isPlayer ? "fill-white stroke-neutral-950" : "fill-red-600 stroke-white",
                            piece.hp < piece.maxHp && "opacity-70"
                          )
                        })}
                        
                        {/* HP Bar for enemies */}
                        {isEnemy && piece.maxHp > 1 && (
                          <div className="absolute -bottom-2 left-0 w-full h-1 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                            <div 
                              className="h-full bg-red-500 transition-all duration-300" 
                              style={{ width: `${(piece.hp / piece.maxHp) * 100}%` }}
                            />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Shot Effect */}
                  {lastShot && lastShot.x === x && lastShot.y === y && Date.now() - lastShot.time < 200 && (
                    <motion.div 
                      initial={{ opacity: 1, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 2 }}
                      className="absolute inset-0 bg-orange-500 z-20 pointer-events-none"
                    />
                  )}
                </div>
              );
            })
          ))}
        </div>

        {/* Game Over Overlays */}
        <AnimatePresence>
          {gameState.isGameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
            >
              <Skull className="text-red-600 mb-4" size={64} />
              <h2 className="text-4xl font-black text-red-500 mb-2 uppercase italic">Game Over</h2>
              <p className="text-neutral-400 mb-8 max-w-xs">{gameState.message}</p>
              <button 
                onClick={resetGame}
                className="bg-red-600 hover:bg-red-700 text-white font-black py-3 px-8 rounded-sm uppercase tracking-widest transition-all active:scale-95"
              >
                Try Again
              </button>
            </motion.div>
          )}

          {gameState.isVictory && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
            >
              <Trophy className="text-yellow-500 mb-4" size={64} />
              <h2 className="text-4xl font-black text-yellow-500 mb-2 uppercase italic">Victory</h2>
              <p className="text-neutral-400 mb-8 max-w-xs">{gameState.message}</p>
              <button 
                onClick={nextFloor}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-black py-3 px-8 rounded-sm uppercase tracking-widest transition-all active:scale-95"
              >
                Next Floor
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* UI Controls & Stats */}
      <div className="w-full max-w-2xl mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stats */}
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</h3>
            <div className="flex gap-1">
              {Array(gameState.player.maxHp).fill(null).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-3 h-3 rounded-full border border-neutral-700",
                    i < gameState.player.hp ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-neutral-800"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-red-500" />
                <span className="text-sm font-bold uppercase">Ammo</span>
              </div>
              <div className="flex gap-1">
                {Array(gameState.maxAmmo).fill(null).map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ 
                      scale: i < gameState.ammo ? 1 : 0.8,
                      opacity: i < gameState.ammo ? 1 : 0.3
                    }}
                    className="w-4 h-6 bg-yellow-600 border border-yellow-800 rounded-sm"
                  />
                ))}
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-sm">
              <p className="text-xs text-neutral-400 leading-relaxed italic">
                "{gameState.message}"
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-sm">
          <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">How to Play</h3>
          <ul className="text-xs space-y-2 text-neutral-400">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Click green dots to <strong className="text-neutral-200">move</strong>.</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
              <span>Moving reloads <strong className="text-neutral-200">+1 Ammo</strong>.</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span>Click white pieces to <strong className="text-neutral-200">shoot</strong>.</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              <span>Shooting costs <strong className="text-neutral-200">1 Ammo</strong>.</span>
            </li>
          </ul>
          
          <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center gap-2 text-[10px] text-neutral-500 font-bold uppercase">
            <Info size={12} />
            <span>Enemies move after your action.</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center opacity-30 hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]">
          Inspired by Shotgun King: The Final Checkmate
        </p>
      </div>
    </div>
  );
}
