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
  Move,
  X,
  Castle,
  Wand2,
  UserRound,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Piece, PieceType, GameState, BOARD_SIZE, BuffCard, Difficulty } from './types';
import { isValidMove, getInitialEnemies, getPieceMoves } from './gameLogic';
import { cn } from './lib/utils';
import { translations, Language } from './translations';

const INITIAL_PLAYER: Piece = {
  id: 'player',
  type: 'king',
  color: 'black',
  x: 4,
  y: 7,
  hp: 3,
  maxHp: 3,
};

const BUFF_CARDS: BuffCard[] = [
  {
    id: 'buckshot-conscription',
    title: 'Buckshot & Conscription',
    description: 'Buff: +2 Pellets, +15% Spread. Nerf: +4 Pawns in front line.',
    playerEffect: (s) => ({ isBuckshot: true }),
    enemyEffect: (s) => ({ isConscription: true }),
  },
  {
    id: 'wings-moat',
    title: 'Wings & The Moat',
    description: 'Buff: L-jump every 3 turns. Nerf: Remove 8 corner squares.',
    playerEffect: (s) => ({ 
      wingsCooldown: 0,
      moatSquares: [
        {x:0, y:0}, {x:1, y:0}, {x:0, y:1},
        {x:7, y:0}, {x:6, y:0}, {x:7, y:1},
        {x:0, y:7}, {x:7, y:7}
      ]
    }),
    enemyEffect: (s) => ({ }),
  },
  {
    id: 'sniper-armored',
    title: 'Sniper & Armored Vest',
    description: 'Buff: +2 Range, -20% Spread. Nerf: 50% enemies get Armor.',
    playerEffect: (s) => ({ playerRange: s.playerRange + 2, isSniperScoop: true }),
    enemyEffect: (s) => ({ isArmoredVest: true }),
  },
  {
    id: 'smg-fullhouse',
    title: 'SMG & Full House',
    description: 'Buff: +2 Max Ammo, +1 Action/turn, -1 Damage. Nerf: Replace 4 Pawns with Rook/Bishop/Knight.',
    playerEffect: (s) => ({ 
      maxAmmo: s.maxAmmo + 2, 
      actionsPerTurn: s.actionsPerTurn + 1,
      playerDamage: Math.max(1, s.playerDamage - 1)
    }),
    enemyEffect: (s) => ({ isFullHouse: true }),
  },
  {
    id: 'grenade-martyrdom',
    title: 'Grenade & Martyrdom',
    description: 'Buff: 3x3 Explosion damage. Nerf: Enemies explode on death.',
    playerEffect: (s) => ({ isGrenadeLauncher: true }),
    enemyEffect: (s) => ({ isMartyrdom: true }),
  },
  {
    id: 'extra-life-council',
    title: 'Extra Life & High Council',
    description: 'Buff: +1 Respawn. Nerf: Promote 1 Pawn to Queen every 5 turns.',
    playerEffect: (s) => ({ hasExtraLife: s.hasExtraLife + 1 }),
    enemyEffect: (s) => ({ isHighCouncil: true }),
  },
  {
    id: 'sawed-off-pikemen',
    title: 'Sawed-off & Pikemen',
    description: 'Buff: +3 Damage at dist 1-2, Max Range = 3. Nerf: Pawns move faster.',
    playerEffect: (s) => ({ isSawedOff: true, playerRange: 3 }),
    enemyEffect: (s) => ({ isPikemen: true }),
  },
  {
    id: 'scavenger-reinforcements',
    title: 'Scavenger & Reinforcements',
    description: 'Buff: +1 Ammo when moving. Nerf: +1 Enemy count bonus.',
    playerEffect: (s) => ({ ammoOnMove: true }),
    enemyEffect: (s) => ({ enemyCountBonus: s.enemyCountBonus + 1 }),
  },
  {
    id: 'boss-queen',
    title: 'Boss & Royal Guard',
    description: 'Buff: +2 Damage. Nerf: Add 1 Queen to the white army.',
    playerEffect: (s) => ({ playerDamage: s.playerDamage + 2 }),
    enemyEffect: (s) => ({ isBossNerf: true }),
  },
  {
    id: 'sniper-gun',
    title: 'Sniper Gun',
    description: 'Buff: +50% Range, +1 Damage, 0 Spread. Nerf: -1 Max Ammo.',
    playerEffect: (s) => ({ 
      isSniperGun: true, 
      playerRange: Math.floor(s.playerRange * 1.5),
      playerDamage: s.playerDamage + 1,
      maxAmmo: Math.max(1, s.maxAmmo - 1)
    }),
    enemyEffect: (s) => ({ }),
  },
  {
    id: 'vitality-sacrifice',
    title: 'Vitality & Sacrifice',
    description: 'Buff: +1 Max HP. Nerf: -1 Max Ammo.',
    playerEffect: (s) => ({ 
      player: { ...s.player, maxHp: s.player.maxHp + 1, hp: s.player.hp + 1 },
      maxAmmo: Math.max(1, s.maxAmmo - 1)
    }),
    enemyEffect: (s) => ({ }),
  }
];

const SOUNDS = {
  MOVE: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-piece-move-2057.mp3',
  SHOOT: 'https://assets.mixkit.co/sfx/preview/mixkit-shotgun-firing-gunshot-1661.mp3',
  HIT: 'https://assets.mixkit.co/sfx/preview/mixkit-heavy-impact-3011.mp3',
  VICTORY: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
  GAMEOVER: 'https://assets.mixkit.co/sfx/preview/mixkit-lose-orchestra-music-2083.mp3',
};

const playSound = (url: string, isMuted: boolean = false) => {
  if (isMuted) return;
  const audio = new Audio(url);
  audio.volume = 0.4;
  audio.play().catch(() => {});
};

const PIECE_ICONS: Record<PieceType, React.ElementType> = {
  king: Crown,
  queen: UserRound,
  rook: Castle,
  bishop: Wand2,
  knight: Zap,
  pawn: Shield,
};

const HP_COLORS = [
  "#dc2626", // Red (Layer 1: 1-7)
  "#eab308", // Yellow (Layer 2: 8-14)
  "#2563eb", // Blue (Layer 3: 15-21)
  "#9333ea", // Purple (Layer 4: 22-28)
  "#16a34a", // Green (Layer 5: 29-35)
  "#ea580c", // Orange (Layer 6: 36-42)
  "#06b6d4", // Cyan (Layer 7: 43-49)
  "#ec4899", // Pink (Layer 8: 50-56)
];

const MOVEMENT_PATTERNS: Record<PieceType, boolean[][]> = {
  king: [
    [false, false, false, false, false],
    [false, true,  true,  true,  false],
    [false, true,  false, true,  false],
    [false, true,  true,  true,  false],
    [false, false, false, false, false],
  ],
  queen: [
    [true,  false, true,  false, true],
    [false, true,  true,  true,  false],
    [true,  true,  false, true,  true],
    [false, true,  true,  true,  false],
    [true,  false, true,  false, true],
  ],
  rook: [
    [false, false, true,  false, false],
    [false, false, true,  false, false],
    [true,  true,  false, true,  true],
    [false, false, true,  false, false],
    [false, false, true,  false, false],
  ],
  bishop: [
    [true,  false, false, false, true],
    [false, true,  false, true,  false],
    [false, false, false, false, false],
    [false, true,  false, true,  false],
    [true,  false, false, false, true],
  ],
  knight: [
    [false, true,  false, true,  false],
    [true,  false, false, false, true],
    [false, false, false, false, false],
    [true,  false, false, false, true],
    [false, true,  false, true,  false],
  ],
  pawn: [
    [false, false, false, false, false],
    [false, true,  true,  true,  false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
  ],
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    player: { ...INITIAL_PLAYER },
    enemies: getInitialEnemies(1, 0, 0, false, false, false, false),
    turn: 'player',
    ammo: 2,
    maxAmmo: 2,
    playerDamage: 2,
    playerRange: 4,
    floor: 1,
    isGameOver: false,
    isVictory: false,
    showBuffSelection: false,
    availableBuffs: [],
    activeBuffs: [],
    message: '', // Will be set after language selection
    enemyHpBonus: 0,
    enemyCountBonus: 0,
    hoveredPiece: null,
    actionsPerTurn: 1,
    currentActions: 1,
    hasExtraLife: 0,
    turnCounter: 0,
    moatSquares: [],
    isGrenadeLauncher: false,
    isMartyrdom: false,
    isPikemen: false,
    wingsCooldown: 0,
    isSniperScoop: false,
    isBuckshot: false,
    isSawedOff: false,
    isFullHouse: false,
    isConscription: false,
    isArmoredVest: false,
    isHighCouncil: false,
    ammoOnMove: false,
    difficulty: 'normal',
    isBossNerf: false,
    isSniperGun: false,
    isMuted: false,
  });

  const [language, setLanguage] = useState<Language>('en');
  const [showLanguageSelection, setShowLanguageSelection] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const t = translations[language];

  const [selectedCell, setSelectedCell] = useState<{ x: number, y: number } | null>(null);
  const [lastShot, setLastShot] = useState<{ x: number, y: number, time: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [damagedPieceId, setDamagedPieceId] = useState<string | null>(null);
  const [attackingEnemyId, setAttackingEnemyId] = useState<string | null>(null);
  const [movingEnemyIndex, setMovingEnemyIndex] = useState<number>(-1);

  const hoveredAttackSquares = useMemo(() => {
    if (
      !gameState.hoveredPiece || 
      gameState.hoveredPiece.id === 'player' || 
      movingEnemyIndex !== -1 || 
      attackingEnemyId !== null || 
      damagedPieceId !== null ||
      gameState.isVictory ||
      gameState.showBuffSelection ||
      gameState.isGameOver
    ) return [];
    
    // Create a temporary board for move calculation
    const tempBoard: (Piece | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    gameState.enemies.forEach(e => {
      tempBoard[e.y][e.x] = e;
    });
    // Add player to board as a black piece for collision/attack checks
    tempBoard[gameState.player.y][gameState.player.x] = { ...gameState.player, color: 'black', id: 'player' } as any;
    
    return getPieceMoves(gameState.hoveredPiece, tempBoard, gameState.difficulty);
  }, [
    gameState.hoveredPiece, 
    gameState.enemies, 
    gameState.player, 
    gameState.difficulty, 
    movingEnemyIndex, 
    attackingEnemyId, 
    damagedPieceId,
    gameState.isVictory,
    gameState.showBuffSelection,
    gameState.isGameOver
  ]);

  const rollEnemyActions = (enemies: Piece[], difficulty: Difficulty) => {
    return enemies.map(enemy => {
      if (difficulty === 'hard') return { ...enemy, willAct: true };
      let prob = 1.0;
      switch (enemy.type) {
        case 'king': prob = 1.0; break;
        case 'pawn': prob = 0.75; break;
        case 'bishop':
        case 'knight': prob = 0.5; break;
        case 'queen': prob = 0.35; break;
      }
      return { ...enemy, willAct: Math.random() < prob };
    });
  };

  const [activeNeedles, setActiveNeedles] = useState<Array<{ id: string, start: {x: number, y: number}, end: {x: number, y: number}, isExplosive?: boolean }>>([]);
  const [activeExplosions, setActiveExplosions] = useState<Array<{ id: string, x: number, y: number }>>([]);
  const [lastDamageAmount, setLastDamageAmount] = useState<number>(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Clear damage flash after a short delay
  useEffect(() => {
    if (damagedPieceId || attackingEnemyId) {
      const timer = setTimeout(() => {
        setDamagedPieceId(null);
        setAttackingEnemyId(null);
        setLastDamageAmount(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [damagedPieceId, attackingEnemyId]);

  const getDamageAtDistance = useCallback((dist: number, currentGameState: GameState) => {
    let damage = currentGameState.playerDamage;
    if (currentGameState.isSawedOff && dist <= 2.5) damage += 3;
    const maxR = currentGameState.playerRange;
    if (dist > maxR * 0.66) return Math.max(1, Math.floor(damage * 0.5));
    if (dist > maxR * 0.33) return Math.max(1, Math.floor(damage * 0.75));
    return damage;
  }, []);

  const calculateDamage = useCallback((targetX: number, targetY: number, currentGameState: GameState) => {
    const px = currentGameState.player.x;
    const py = currentGameState.player.y;
    const damageMap = new Map<string, number>();
    const hitTargets = new Set<string>();

    if (currentGameState.isGrenadeLauncher) {
      // Find nearest enemy on the line to target
      const angle = Math.atan2(targetY - py, targetX - px);
      const rayDirX = Math.cos(angle);
      const rayDirY = Math.sin(angle);
      
      const enemiesOnRay = currentGameState.enemies.map(enemy => {
        const epx = enemy.x - px;
        const epy = enemy.y - py;
        
        // Projection onto ray
        const dot = epx * rayDirX + epy * rayDirY;
        if (dot <= 0) return { enemy, hit: false, distAlongLine: 0 };
        
        const closestX = px + dot * rayDirX;
        const closestY = py + dot * rayDirY;
        const distToLine = Math.sqrt((enemy.x - closestX)**2 + (enemy.y - closestY)**2);
        const eDist = Math.sqrt(epx * epx + epy * epy);
        
        const hit = distToLine < 0.45 && eDist <= currentGameState.playerRange;
        return { enemy, hit, distAlongLine: dot };
      })
      .filter(e => e.hit)
      .sort((a, b) => a.distAlongLine - b.distAlongLine);

      const firstEnemy = enemiesOnRay[0];
      const explosionCenter = firstEnemy ? { x: firstEnemy.enemy.x, y: firstEnemy.enemy.y } : { x: targetX, y: targetY };
      
      // Explosion area (3x3)
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const ex = explosionCenter.x + ox;
          const ey = explosionCenter.y + oy;
          
          if (ex < 0 || ex >= BOARD_SIZE || ey < 0 || ey >= BOARD_SIZE) continue;
          
          const enemiesAtCell = currentGameState.enemies.filter(e => e.x === ex && e.y === ey);
          enemiesAtCell.forEach(enemy => {
            if (!hitTargets.has(enemy.id)) {
              hitTargets.add(enemy.id);
              const eDist = Math.sqrt((enemy.x - px)**2 + (enemy.y - py)**2);
              damageMap.set(enemy.id, getDamageAtDistance(eDist, currentGameState));
            }
          });
        }
      }
    } else {
      const angle = Math.atan2(targetY - py, targetX - px);
      let spreadAngle = currentGameState.isSniperScoop ? 0.08 : 0.15;
      let numRays = currentGameState.isBuckshot ? 5 : 3;
      
      if (currentGameState.isSniperGun) {
        spreadAngle = 0;
        numRays = 1;
      }

      const angles = [];
      for (let i = 0; i < numRays; i++) {
        angles.push(angle + (i - (numRays - 1) / 2) * spreadAngle);
      }
      
      angles.forEach(a => {
        const rayDirX = Math.cos(a);
        const rayDirY = Math.sin(a);
        
        const enemiesOnRay = currentGameState.enemies.map(enemy => {
          const epx = enemy.x - px;
          const epy = enemy.y - py;
          
          // Projection onto ray
          const dot = epx * rayDirX + epy * rayDirY;
          if (dot <= 0) return { enemy, hit: false, distAlongLine: 0 };
          
          const closestX = px + dot * rayDirX;
          const closestY = py + dot * rayDirY;
          const distToLine = Math.sqrt((enemy.x - closestX)**2 + (enemy.y - closestY)**2);
          const eDist = Math.sqrt(epx * epx + epy * epy);
          
          // A ray hits if the enemy is close to the line and within range
          const hit = distToLine < 0.45 && eDist <= currentGameState.playerRange;
          return { enemy, hit, distAlongLine: dot };
        })
        .filter(e => e.hit)
        .sort((a, b) => a.distAlongLine - b.distAlongLine);

        // Apply damage for this ray
        enemiesOnRay.forEach((e, index) => {
          // Piercing: 1st enemy takes full ray damage, 2nd takes half
          const eDist = Math.sqrt((e.enemy.x - px)**2 + (e.enemy.y - py)**2);
          const baseDmgAtDist = getDamageAtDistance(eDist, currentGameState) / numRays;
          
          let rayDmg = 0;
          if (index === 0) rayDmg = baseDmgAtDist;
          else if (index === 1) rayDmg = baseDmgAtDist * 0.5;
          
          if (rayDmg > 0) {
            const currentDmg = damageMap.get(e.enemy.id) || 0;
            damageMap.set(e.enemy.id, currentDmg + rayDmg);
          }
        });
      });

      // Round up final damages to ensure integer values
      damageMap.forEach((val, key) => {
        damageMap.set(key, Math.ceil(val));
      });
    }

    return damageMap;
  }, [getDamageAtDistance]);

  const potentialDamageMap = useMemo(() => {
    if (!isMouseDown || !mousePos) return new Map<string, number>();
    const targetX = Math.floor(mousePos.x * 8);
    const targetY = Math.floor(mousePos.y * 8);
    return calculateDamage(targetX, targetY, gameState);
  }, [isMouseDown, mousePos, gameState, calculateDamage]);

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
    const whiteKing = enemies.find(e => e.type === 'king');
    if (!whiteKing) return { isVictory: true, message: 'KING DEFEATED. Descending deeper...' };
    return null;
  }, []);

  const handlePlayerMove = (x: number, y: number) => {
    if (gameState.turn !== 'player' || gameState.isGameOver || gameState.isVictory) return;

    // Check for Moat
    if (gameState.moatSquares.some(s => s.x === x && s.y === y)) {
      setGameState(prev => ({ ...prev, message: 'Cannot move into the moat!' }));
      return;
    }

    const dx = Math.abs(x - gameState.player.x);
    const dy = Math.abs(y - gameState.player.y);

    // Normal King move or Wings L-jump
    const isNormalMove = dx <= 1 && dy <= 1;
    const isWingsJump = (gameState.wingsCooldown <= 0) && ((dx === 1 && dy === 2) || (dx === 2 && dy === 1));

    if (isNormalMove || isWingsJump) {
      playSound(SOUNDS.MOVE, gameState.isMuted);
      // Check if square is occupied by enemy
      const enemyAtTarget = gameState.enemies.find(e => e.x === x && e.y === y);
      const isVictory = enemyAtTarget?.type === 'king';
      
      const nextActions = gameState.currentActions - 1;
      const turnEnds = nextActions <= 0 || isVictory;

      if (enemyAtTarget) {
        const newEnemies = gameState.enemies.filter(e => e.id !== enemyAtTarget.id);
        const extraAmmo = gameState.ammoOnMove ? 1 : 0;
        setGameState(prev => ({
          ...prev,
          player: { ...prev.player, x, y },
          ammo: Math.min(prev.ammo + 1 + extraAmmo, prev.maxAmmo),
          currentActions: turnEnds ? prev.actionsPerTurn : nextActions,
          turn: turnEnds ? (isVictory ? 'player' : 'enemy') : 'player',
          isVictory: isVictory,
          wingsCooldown: isWingsJump ? 3 : Math.max(0, prev.wingsCooldown - 1),
          message: isVictory ? (language === 'vi' ? 'VUA TRẮNG ĐÃ BỊ TIÊU DIỆT!' : 'KING DEFEATED!') : `${t.moved} +${1 + extraAmmo} ${t.ammo}.`,
          enemies: turnEnds && !isVictory ? rollEnemyActions(newEnemies, prev.difficulty) : newEnemies,
        }));
      } else {
        const extraAmmo = gameState.ammoOnMove ? 1 : 0;
        setGameState(prev => ({
          ...prev,
          player: { ...prev.player, x, y },
          ammo: Math.min(prev.ammo + 1 + extraAmmo, prev.maxAmmo),
          currentActions: turnEnds ? prev.actionsPerTurn : nextActions,
          turn: turnEnds ? 'enemy' : 'player',
          wingsCooldown: isWingsJump ? 3 : Math.max(0, prev.wingsCooldown - 1),
          message: `${t.moved} +${1 + extraAmmo} ${t.ammo}.`,
          enemies: turnEnds ? rollEnemyActions(prev.enemies, prev.difficulty) : prev.enemies,
        }));
      }
    }
  };

  const handleShoot = (x: number, y: number) => {
    if (gameState.turn !== 'player' || gameState.isGameOver || gameState.isVictory || gameState.ammo <= 0) return;

    const px = gameState.player.x;
    const py = gameState.player.y;
    const dx = x - px;
    const dy = y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > gameState.playerRange) {
      setGameState(prev => ({ ...prev, message: t.outOfRange }));
      return;
    }

    // Calculate actual hit point for Grenade Launcher
    let hitX = x;
    let hitY = y;
    if (gameState.isGrenadeLauncher) {
      const angle = Math.atan2(y - py, x - px);
      const rayDirX = Math.cos(angle);
      const rayDirY = Math.sin(angle);
      const enemiesOnRay = gameState.enemies.map(enemy => {
        const epx = enemy.x - px;
        const epy = enemy.y - py;
        const dot = epx * rayDirX + epy * rayDirY;
        if (dot <= 0) return { enemy, hit: false, distAlongLine: 0 };
        const closestX = px + dot * rayDirX;
        const closestY = py + dot * rayDirY;
        const distToLine = Math.sqrt((enemy.x - closestX)**2 + (enemy.y - closestY)**2);
        const eDist = Math.sqrt(epx * epx + epy * epy);
        const hit = distToLine < 0.45 && eDist <= gameState.playerRange;
        return { enemy, hit, distAlongLine: dot };
      })
      .filter(e => e.hit)
      .sort((a, b) => a.distAlongLine - b.distAlongLine);

      if (enemiesOnRay.length > 0) {
        hitX = enemiesOnRay[0].enemy.x;
        hitY = enemiesOnRay[0].enemy.y;
      }
    }

    setLastShot({ x: hitX, y: hitY, time: Date.now() });
    playSound(SOUNDS.SHOOT, gameState.isMuted);

    // Add projectiles
    const projectileIds: string[] = [];
    if (gameState.isGrenadeLauncher) {
      const id = Math.random().toString(36).substr(2, 9);
      projectileIds.push(id);
      setActiveNeedles(prev => [...prev, { 
        id, 
        start: { x: px, y: py }, 
        end: { x: hitX, y: hitY },
        isExplosive: true 
      }]);
    } else {
      const angle = Math.atan2(y - py, x - px);
      let spreadAngle = gameState.isSniperScoop ? 0.08 : 0.15; // radians
      let numRays = gameState.isBuckshot ? 5 : 3;
      
      if (gameState.isSniperGun) {
        spreadAngle = 0;
        numRays = 1;
      }
      
      const angles = [];
      for (let i = 0; i < numRays; i++) {
        angles.push(angle + (i - (numRays - 1) / 2) * spreadAngle);
      }

      angles.forEach(a => {
        const id = Math.random().toString(36).substr(2, 9);
        projectileIds.push(id);
        setActiveNeedles(prev => [...prev, {
          id,
          start: { x: px, y: py },
          end: { 
            x: px + dist * Math.cos(a), 
            y: py + dist * Math.sin(a) 
          },
          isExplosive: false
        }]);
      });
    }

    setTimeout(() => {
      setActiveNeedles(prev => prev.filter(n => !projectileIds.includes(n.id)));
      
      if (gameState.isGrenadeLauncher) {
        const explosionId = Math.random().toString(36).substr(2, 9);
        setActiveExplosions(prev => [...prev, { id: explosionId, x: hitX, y: hitY }]);
        setTimeout(() => {
          setActiveExplosions(prev => prev.filter(e => e.id !== explosionId));
        }, 500);
      }

      setGameState(prev => {
        const damageMap = calculateDamage(hitX, hitY, prev);
        let hitAny = damageMap.size > 0;
        if (hitAny) playSound(SOUNDS.HIT, prev.isMuted);
        let killedEnemies: Piece[] = [];
        let hitEnemyIds: string[] = [];

        // Calculate knockback for survivors if it was an explosion
        const enemiesAfterDamage = prev.enemies.map(enemy => {
          if (damageMap.has(enemy.id)) {
            hitEnemyIds.push(enemy.id);
            let dmg = damageMap.get(enemy.id)!;
            if (enemy.hasArmor) {
              return { ...enemy, hasArmor: false }; // Break armor
            }
            const newHp = enemy.hp - dmg;
            const updatedEnemy = { ...enemy, hp: newHp };
            if (newHp <= 0) killedEnemies.push(updatedEnemy);
            return updatedEnemy;
          }
          return enemy;
        }).filter(enemy => enemy.hp > 0);

        let finalEnemies = [...enemiesAfterDamage];
        if (prev.isGrenadeLauncher) {
          finalEnemies = enemiesAfterDamage.map(enemy => {
            // Only push if within explosion radius (3x3)
            const dx = Math.abs(enemy.x - hitX);
            const dy = Math.abs(enemy.y - hitY);
            if (dx <= 1 && dy <= 1) {
              // Calculate push direction
              const pushX = Math.sign(enemy.x - hitX);
              const pushY = Math.sign(enemy.y - hitY);
              
              // If at center, no clear direction, so don't push or push randomly
              if (pushX === 0 && pushY === 0) return enemy;

              let targetX = enemy.x + pushX;
              let targetY = enemy.y + pushY;

              // Check board boundaries
              if (targetX < 0 || targetX >= BOARD_SIZE || targetY < 0 || targetY >= BOARD_SIZE) return enemy;

              // Check if target square is occupied by another enemy or player
              const isOccupied = enemiesAfterDamage.some(e => e.id !== enemy.id && e.x === targetX && e.y === targetY) ||
                                (prev.player.x === targetX && prev.player.y === targetY);
              
              if (!isOccupied) {
                return { ...enemy, x: targetX, y: targetY };
              }
            }
            return enemy;
          });
        }

        // Trigger flash for hit enemies
        if (hitEnemyIds.length > 0) {
          setDamagedPieceId(hitEnemyIds[0]);
          setLastDamageAmount(damageMap.get(hitEnemyIds[0]) || 0);
        }

        // Martyrdom: Enemies explode on death
        let playerHpDamage = 0;
        if (prev.isMartyrdom && killedEnemies.length > 0) {
          killedEnemies.forEach(dead => {
            const distToPlayer = Math.max(Math.abs(dead.x - px), Math.abs(dead.y - py));
            if (distToPlayer <= 1) playerHpDamage += 1;
          });
        }

        const isVictory = !finalEnemies.find(e => e.type === 'king');
        const nextActions = prev.currentActions - 1;
        const turnEnds = nextActions <= 0 || isVictory;

        return {
          ...prev,
          enemies: turnEnds && !isVictory ? rollEnemyActions(finalEnemies, prev.difficulty) : finalEnemies,
          player: { ...prev.player, hp: Math.max(0, prev.player.hp - playerHpDamage) },
          ammo: prev.ammo - 1,
          currentActions: turnEnds ? prev.actionsPerTurn : nextActions,
          turn: turnEnds ? (isVictory ? 'player' : 'enemy') : 'player',
          isVictory: isVictory,
          message: isVictory ? (language === 'vi' ? 'VUA TRẮNG ĐÃ BỊ TIÊU DIỆT!' : 'KING DEFEATED!') : (hitAny ? 'BOOM!' : 'Missed!'),
        };
      });
    }, 200);
  };

  // Enemy AI
  useEffect(() => {
    if (gameState.turn === 'enemy' && !gameState.isGameOver && !gameState.isVictory) {
      if (movingEnemyIndex === -1) {
        setMovingEnemyIndex(0);
      } else if (movingEnemyIndex < gameState.enemies.length) {
        const timer = setTimeout(() => {
          const enemy = gameState.enemies[movingEnemyIndex];
          let updatedEnemy = { ...enemy };
          let newPlayer = { ...gameState.player };
          
          // Function to get current board from pieces
          const getCurrentBoard = (player: Piece, currentEnemies: Piece[]) => {
            const newBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
            if (player.y >= 0 && player.y < BOARD_SIZE && player.x >= 0 && player.x < BOARD_SIZE) {
              newBoard[player.y][player.x] = player;
            }
            currentEnemies.forEach(e => {
              if (e.y >= 0 && e.y < BOARD_SIZE && e.x >= 0 && e.x < BOARD_SIZE) {
                newBoard[e.y][e.x] = e;
              }
            });
            return newBoard;
          };

          const currentBoard = getCurrentBoard(newPlayer, gameState.enemies);
          
          const willAct = enemy.willAct;

          if (!willAct) {
            setMovingEnemyIndex(prev => prev + 1);
            return;
          }

          // High Council: Promote 1 Pawn to Queen every 5 turns
          let finalEnemies = [...gameState.enemies];
          if (gameState.isHighCouncil && gameState.turnCounter > 0 && gameState.turnCounter % 5 === 0 && movingEnemyIndex === 0) {
            const pawnIndex = finalEnemies.findIndex(e => e.type === 'pawn');
            if (pawnIndex !== -1) {
              finalEnemies[pawnIndex] = { ...finalEnemies[pawnIndex], type: 'queen' };
            }
          }

          // Try to capture player
          if (isValidMove(enemy.type, enemy.x, enemy.y, newPlayer.x, newPlayer.y, currentBoard, gameState.isPikemen, gameState.difficulty)) {
            // Pre-attack blue flash
            setAttackingEnemyId(enemy.id);
            
            setTimeout(() => {
              newPlayer.hp -= 1;
              setDamagedPieceId('player');
              playSound(SOUNDS.HIT);
              setAttackingEnemyId(null);
              
              // Retreat after attack: piece returns to its previous position
              updatedEnemy = { ...enemy }; 
              // We still update rotation to face the player
              const dx = newPlayer.x - enemy.x;
              const dy = newPlayer.y - enemy.y;
              updatedEnemy.rotation = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

              // Heal 1 HP on action
              updatedEnemy.hp = Math.min(updatedEnemy.hp + 1, updatedEnemy.maxHp);

              const newEnemies = [...finalEnemies];
              newEnemies[movingEnemyIndex] = updatedEnemy;
              
              setGameState(prev => ({
                ...prev,
                player: newPlayer,
                enemies: newEnemies,
              }));
              setMovingEnemyIndex(prev => prev + 1);
            }, 300);
            return;
          } else {
            // Try to move closer to the CURRENT player position
            const possibleMoves = [];
            for (let ty = 0; ty < BOARD_SIZE; ty++) {
              for (let tx = 0; tx < BOARD_SIZE; tx++) {
                if (isValidMove(enemy.type, enemy.x, enemy.y, tx, ty, currentBoard, gameState.isPikemen, gameState.difficulty)) {
                  // Check if any OTHER enemy is already at (tx, ty)
                  const isOccupiedByOtherEnemy = finalEnemies.some(e => e.id !== enemy.id && e.x === tx && e.y === ty);
                  const isOccupiedByPlayer = newPlayer.x === tx && newPlayer.y === ty;
                  
                  if (!isOccupiedByOtherEnemy && !isOccupiedByPlayer) {
                    // Calculate distance to player's current position
                    const dist = Math.sqrt(Math.pow(tx - newPlayer.x, 2) + Math.pow(ty - newPlayer.y, 2));
                    possibleMoves.push({ x: tx, y: ty, dist });
                  }
                }
              }
            }

            if (possibleMoves.length > 0) {
              let bestMove;
              const rand = Math.random();
              
              if (gameState.difficulty === 'easy') {
                if (rand < 0.3) {
                  bestMove = null;
                } else if (rand < 0.7) {
                  bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                } else {
                  possibleMoves.sort((a, b) => a.dist - b.dist);
                  bestMove = possibleMoves[0];
                }
              } else if (gameState.difficulty === 'normal') {
                if (rand < 0.1) {
                  bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                } else {
                  possibleMoves.sort((a, b) => a.dist - b.dist);
                  bestMove = possibleMoves[0];
                }
              } else {
                possibleMoves.sort((a, b) => a.dist - b.dist);
                bestMove = possibleMoves[0];
              }

              if (bestMove) {
                updatedEnemy = { ...enemy, x: bestMove.x, y: bestMove.y };
                playSound(SOUNDS.MOVE);
              }
            }
          }
          
          // Heal 1 HP on action
          updatedEnemy.hp = Math.min(updatedEnemy.hp + 1, updatedEnemy.maxHp);

          // Calculate rotation to face player
          const dx = newPlayer.x - updatedEnemy.x;
          const dy = newPlayer.y - updatedEnemy.y;
          if (dx !== 0 || dy !== 0) {
            updatedEnemy.rotation = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          }
          
          const newEnemies = [...finalEnemies];
          newEnemies[movingEnemyIndex] = updatedEnemy;
          
          setGameState(prev => ({
            ...prev,
            player: newPlayer,
            enemies: newEnemies,
          }));
          setMovingEnemyIndex(prev => prev + 1);
        }, gameState.isPikemen ? 100 : 200);
        return () => clearTimeout(timer);
      } else {
        // Finished moving all enemies
        const status = checkGameOver(gameState.player, gameState.enemies);
        
        // Extra Life logic
        let finalPlayer = { ...gameState.player };
        let finalIsGameOver = status?.isGameOver || false;
        let finalMessage = status?.message || 'Your turn, King.';

        if (finalIsGameOver && gameState.hasExtraLife > 0) {
          finalPlayer.hp = 1;
          finalIsGameOver = false;
          finalMessage = 'EXTRA LIFE! Respawned with 1 HP.';
          // Random respawn
          finalPlayer.x = Math.floor(Math.random() * BOARD_SIZE);
          finalPlayer.y = BOARD_SIZE - 1;
        }

        if (finalIsGameOver) playSound(SOUNDS.GAMEOVER, gameState.isMuted);

        setGameState(prev => ({
          ...prev,
          player: finalPlayer,
          turn: 'player',
          turnCounter: prev.turnCounter + 1,
          hasExtraLife: finalIsGameOver ? prev.hasExtraLife : (status?.isGameOver ? prev.hasExtraLife - 1 : prev.hasExtraLife),
          isGameOver: finalIsGameOver,
          isVictory: status?.isVictory || false,
          message: finalMessage,
        }));
        setMovingEnemyIndex(-1);
      }
    }
  }, [gameState.turn, movingEnemyIndex, gameState.player, gameState.enemies, checkGameOver]);

  const resetGame = () => {
    const initialEnemies = getInitialEnemies(1, 0, 0, false, false, false, false);
    setGameState({
      board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
      player: { ...INITIAL_PLAYER },
      enemies: rollEnemyActions(initialEnemies, gameState.difficulty),
      turn: 'player',
      ammo: 2,
      maxAmmo: 2,
      playerDamage: 2,
      playerRange: 4,
      floor: 1,
      isGameOver: false,
      isVictory: false,
      showBuffSelection: false,
      availableBuffs: [],
      activeBuffs: [],
      message: t.moveReload,
      enemyHpBonus: 0,
      enemyCountBonus: 0,
      hoveredPiece: null,
      actionsPerTurn: 1,
      currentActions: 1,
      hasExtraLife: 0,
      turnCounter: 0,
      moatSquares: [],
      isGrenadeLauncher: false,
      isMartyrdom: false,
      isPikemen: false,
      wingsCooldown: 0,
      isSniperScoop: false,
      isBuckshot: false,
      isSawedOff: false,
      isFullHouse: false,
      isConscription: false,
      isArmoredVest: false,
      isHighCouncil: false,
      ammoOnMove: false,
      difficulty: gameState.difficulty,
      isBossNerf: false,
      isSniperGun: false,
      isMuted: gameState.isMuted,
    });
    setSelectedCell(null);
  };

  const startBuffSelection = () => {
    const shuffled = [...BUFF_CARDS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    setGameState(prev => ({
      ...prev,
      showBuffSelection: true,
      availableBuffs: selected,
      isVictory: false,
    }));
  };

  const applyBuff = (card: BuffCard) => {
    playSound(SOUNDS.VICTORY, gameState.isMuted);
    setGameState(prev => {
      const playerUpdates = card.playerEffect(prev);
      const enemyUpdates = card.enemyEffect(prev);
      const nextFloorNum = prev.floor + 1;
      
      const newState = {
        ...prev,
        ...playerUpdates,
        ...enemyUpdates,
        floor: nextFloorNum,
        showBuffSelection: false,
        activeBuffs: [...prev.activeBuffs, card],
        turn: 'player' as const,
        currentActions: (prev.actionsPerTurn + (playerUpdates.actionsPerTurn || 0)),
        message: `${t.floor} ${nextFloorNum}.`,
      };

      // Easy Mode: Randomly remove 2 nerfs every 5 floors
      if (newState.difficulty === 'easy' && nextFloorNum % 5 === 0) {
        const nerfFlags = [
          'isConscription', 'isFullHouse', 'isArmoredVest', 'isBossNerf', 
          'isMartyrdom', 'isHighCouncil', 'isPikemen'
        ];
        const activeNerfs = nerfFlags.filter(flag => (newState as any)[flag]);
        const shuffled = [...activeNerfs].sort(() => Math.random() - 0.5);
        shuffled.slice(0, 2).forEach(flag => {
          (newState as any)[flag] = false;
        });
      }

      // Safeguards for minimum values
      newState.maxAmmo = Math.max(1, newState.maxAmmo);
      newState.ammo = Math.min(newState.ammo, newState.maxAmmo);
      if (newState.player) {
        newState.player.maxHp = Math.max(1, newState.player.maxHp);
      }

      // Heal player to full HP and reset position to bottom row when passing a level
      newState.player = { 
        ...newState.player, 
        hp: newState.player.maxHp,
        x: 4,
        y: 7
      };

      const initialEnemies = getInitialEnemies(
        nextFloorNum, 
        newState.enemyHpBonus, 
        newState.enemyCountBonus,
        newState.isConscription,
        newState.isFullHouse,
        newState.isArmoredVest,
        newState.isBossNerf
      );
      
      newState.enemies = rollEnemyActions(initialEnemies, newState.difficulty);
      
      return newState;
    });
  };

  // Update victory check
  useEffect(() => {
    if (gameState.enemies.length === 0 && !gameState.isVictory && !gameState.showBuffSelection && !gameState.isGameOver) {
      setGameState(prev => ({ ...prev, isVictory: true, message: 'FLOOR CLEARED. Choose a buff.' }));
    }
  }, [gameState.enemies, gameState.isVictory, gameState.showBuffSelection, gameState.isGameOver]);

  // Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.turn !== 'player' || gameState.isGameOver || gameState.isVictory || showLanguageSelection || gameState.showBuffSelection) return;
      
      let tx = gameState.player.x;
      let ty = gameState.player.y;
      
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup': ty -= 1; break;
        case 's':
        case 'arrowdown': ty += 1; break;
        case 'a':
        case 'arrowleft': tx -= 1; break;
        case 'd':
        case 'arrowright': tx += 1; break;
        default: return;
      }
      
      if (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE) {
        handlePlayerMove(tx, ty);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.player, gameState.turn, gameState.isGameOver, gameState.isVictory, showLanguageSelection, gameState.showBuffSelection]);

  // Prevent context menu on board
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const boardElement = document.getElementById('game-board');
    if (boardElement) {
      boardElement.addEventListener('contextmenu', handleContextMenu);
      return () => boardElement.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);

  return (
    <div className={cn(
      "min-h-screen h-[100dvh] w-full flex flex-col items-center justify-center p-4 font-mono selection:bg-red-500 selection:text-white overflow-hidden transition-colors duration-500 touch-none",
      theme === 'dark' ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-900"
    )}>
      {/* Controls Bar */}
      <div className="fixed top-6 right-6 z-[100] flex gap-2">
        <button 
          onClick={() => setGameState(prev => ({ ...prev, isMuted: !prev.isMuted }))}
          className={cn(
            "p-3 rounded-full border-2 transition-all duration-300",
            theme === 'dark' 
              ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white" 
              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
          )}
          title={gameState.isMuted ? t.unmute : t.mute}
        >
          {gameState.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <button 
          onClick={resetGame}
          className={cn(
            "p-3 rounded-full border-2 transition-all duration-300",
            theme === 'dark' 
              ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white" 
              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
          )}
          title={t.restartGame}
        >
          <RefreshCw size={20} />
        </button>
        <button 
          onClick={toggleFullscreen}
          className={cn(
            "p-3 rounded-full border-2 transition-all duration-300",
            theme === 'dark' 
              ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white" 
              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
          )}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        <button 
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          className={cn(
            "p-3 rounded-full border-2 transition-all duration-300",
            theme === 'dark' 
              ? "bg-neutral-900 border-neutral-800 text-yellow-500 hover:border-yellow-500/50" 
              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
          )}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Top Bar (Ammo, Floor, HP) */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowTutorial(true)}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition-colors flex items-center justify-center"
            title="Tutorial"
          >
            <Info size={18} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Target size={20} className="text-red-600" />
              <div className="flex gap-1">
                {Array(gameState.maxAmmo).fill(null).map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-2 h-5 border border-neutral-800 rounded-sm",
                      i < gameState.ammo ? "bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]" : "bg-neutral-900"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Floor</span>
          <span className="text-3xl font-black text-white italic tracking-tighter leading-none">{gameState.floor}</span>
          <div className="flex gap-1 mt-1">
            {Array(gameState.actionsPerTurn).fill(null).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  i < gameState.currentActions ? "bg-yellow-500" : "bg-neutral-800"
                )} 
              />
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                disabled={gameState.turnCounter > 0}
                onClick={() => setGameState(prev => ({ ...prev, difficulty: d }))}
                className={cn(
                  "px-2 py-0.5 text-[8px] uppercase font-bold border rounded-sm transition-all",
                  gameState.difficulty === d 
                    ? "bg-red-600 border-red-600 text-white" 
                    : "border-neutral-800 text-neutral-500 hover:border-neutral-600",
                  gameState.turnCounter > 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Damage Info Display */}
          <div className="hidden lg:flex flex-col gap-1 text-[10px] font-black uppercase tracking-tighter">
            <div className="flex items-center gap-2 text-green-500">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>{t.green || 'Green'}: {getDamageAtDistance(0, gameState)} ST</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-500">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>{t.yellow || 'Yellow'}: {getDamageAtDistance(gameState.playerRange * 0.5, gameState)} ST</span>
            </div>
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>{t.red || 'Red'}: {getDamageAtDistance(gameState.playerRange, gameState)} ST</span>
            </div>
            {gameState.isSniperGun && (
              <div className="flex items-center gap-2 text-blue-400 animate-pulse">
                <Crosshair size={10} />
                <span>{t.spreadZero}</span>
              </div>
            )}
          </div>

          {/* Segmented Capsule Health UI */}
          <div className="flex items-center bg-neutral-900/50 border-2 border-neutral-800 rounded-full p-1 gap-0.5 overflow-hidden shadow-inner">
            {Array(gameState.player.maxHp).fill(null).map((_, i) => (
              <motion.div 
                key={i}
                initial={false}
                animate={{ 
                  backgroundColor: i < gameState.player.hp ? "#dc2626" : "rgba(23, 23, 23, 0.5)",
                  scale: i < gameState.player.hp ? 1 : 0.95
                }}
                className={cn(
                  "w-6 h-10 transition-colors duration-300",
                  i === 0 && "rounded-l-full",
                  i === gameState.player.maxHp - 1 && "rounded-r-full",
                  "relative overflow-hidden"
                )}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                {/* Segment divider */}
                {i < gameState.player.maxHp - 1 && (
                  <div className="absolute right-0 top-1/4 bottom-1/4 w-px bg-white/5 z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Damage Info */}
      <div className="lg:hidden flex flex-row justify-center gap-4 text-[9px] font-black uppercase tracking-tighter mb-4">
        <div className="flex items-center gap-1 text-green-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>{getDamageAtDistance(0, gameState)} ST</span>
        </div>
        <div className="flex items-center gap-1 text-yellow-500">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <span>{getDamageAtDistance(gameState.playerRange * 0.5, gameState)} ST</span>
        </div>
        <div className="flex items-center gap-1 text-red-500">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>{getDamageAtDistance(gameState.playerRange, gameState)} ST</span>
        </div>
      </div>

      <div className="flex flex-row gap-4 items-center justify-center w-full max-w-[1600px]">
        {/* Left Side (Buffs + Piece Info) */}
        <div className="flex-1 flex flex-row items-center justify-end gap-6">
          {/* Left Buffs */}
          <div className="hidden xl:grid grid-cols-2 gap-2 w-32 shrink-0 content-start">
            {Array(10).fill(null).map((_, i) => {
              const buff = gameState.activeBuffs.filter((_, idx) => idx % 2 === 0)[i];
              return (
                <div 
                  key={`left-slot-${i}`}
                  className={cn(
                    "aspect-square border-2 rounded-sm flex items-center justify-center transition-all duration-300",
                    buff ? "bg-neutral-900 border-red-900/50 hover:border-red-600 shadow-lg shadow-red-900/10" : "border-neutral-900/30 bg-transparent"
                  )}
                >
                  {buff && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} title={buff.title}>
                      <Zap size={16} className="text-red-500" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Piece Info */}
          <div className="w-32 shrink-0 h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {gameState.hoveredPiece ? (
                <motion.div 
                  key={gameState.hoveredPiece.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col items-start"
                >
                  <h4 className="text-sm font-black text-red-500 uppercase italic mb-1 tracking-tighter leading-none">{t.pieces[gameState.hoveredPiece.type as keyof typeof t.pieces]}</h4>
                  
                  <div className="w-14 h-14 bg-neutral-900 border-2 border-neutral-800 flex items-center justify-center mb-3 rounded-sm shadow-xl">
                    {React.createElement(PIECE_ICONS[gameState.hoveredPiece.type], { 
                      size: 28, 
                      className: gameState.hoveredPiece.color === 'black' ? "fill-white" : "fill-red-600"
                    })}
                  </div>

                  <div className="flex flex-wrap gap-0.5 mb-3 max-w-[80px]">
                    {Array(gameState.hoveredPiece.maxHp).fill(null).map((_, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "w-2 h-2 rounded-sm rotate-45",
                          i < (gameState.hoveredPiece?.hp || 0) ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-neutral-800"
                        )}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-5 gap-0.5 w-fit bg-neutral-900 p-1 border-2 border-neutral-800 rounded-sm shadow-inner">
                    {MOVEMENT_PATTERNS[gameState.hoveredPiece.type].map((row, y) => (
                      row.map((active, x) => (
                        <div 
                          key={`${x}-${y}`}
                          className={cn(
                            "w-2.5 h-2.5 rounded-[1px]",
                            x === 2 && y === 2 ? "bg-white" : (active ? "bg-red-500/80" : "bg-neutral-800/30")
                          )}
                        />
                      ))
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="opacity-5 flex flex-col items-center">
                  <Info size={32} />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Side (Board Area) */}
        <div className="relative shrink-0">
          <div 
            id="game-board"
            onMouseDown={() => setIsMouseDown(true)}
            onMouseUp={() => setIsMouseDown(false)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ 
                x: (e.clientX - rect.left) / rect.width, 
                y: (e.clientY - rect.top) / rect.height 
              });
            }}
            onTouchStart={(e) => {
              setIsMouseDown(true);
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ 
                x: (touch.clientX - rect.left) / rect.width, 
                y: (touch.clientY - rect.top) / rect.height 
              });
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ 
                x: (touch.clientX - rect.left) / rect.width, 
                y: (touch.clientY - rect.top) / rect.height 
              });
            }}
            onTouchEnd={() => {
              setIsMouseDown(false);
            }}
            onMouseLeave={() => {
              setMousePos(null);
              setIsMouseDown(false);
              setGameState(prev => ({ ...prev, hoveredPiece: null }));
            }}
            className="grid grid-cols-8 border-4 border-neutral-800 shadow-2xl shadow-red-900/20 bg-neutral-900 relative overflow-hidden"
          >
            {/* Projectiles */}
            <AnimatePresence>
              {activeNeedles.map(needle => {
                const dx = needle.end.x - needle.start.x;
                const dy = needle.end.y - needle.start.y;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                return (
                  <motion.div
                    key={needle.id}
                    initial={{ 
                      left: (needle.start.x + 0.5) * (100 / 8) + "%", 
                      top: (needle.start.y + 0.5) * (100 / 8) + "%",
                      rotate: angle,
                      opacity: 1,
                      scale: 1
                    }}
                    animate={{ 
                      left: (needle.end.x + 0.5) * (100 / 8) + "%", 
                      top: (needle.end.y + 0.5) * (100 / 8) + "%",
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "linear" }}
                    className={cn(
                      "absolute z-[60]",
                      needle.isExplosive 
                        ? "w-6 h-6 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9),0_0_30px_rgba(255,165,0,0.4)] -ml-3 -mt-3" 
                        : "w-8 h-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,1)] origin-left"
                    )}
                  />
                );
              })}
            </AnimatePresence>

            {/* Explosions */}
            <AnimatePresence>
              {activeExplosions.map(exp => (
                <motion.div
                  key={exp.id}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute z-[70] w-[12.5%] h-[12.5%] bg-orange-600 rounded-full shadow-[0_0_50px_rgba(255,69,0,0.9)] pointer-events-none"
                  style={{
                    left: (exp.x + 0.5) * (100 / 8) + "%",
                    top: (exp.y + 0.5) * (100 / 8) + "%",
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              ))}
            </AnimatePresence>

            {/* Aiming UI */}
            {mousePos && gameState.turn === 'player' && !gameState.isGameOver && !gameState.isVictory && (() => {
              const px = (gameState.player.x + 0.5) * (100 / 8);
              const py = (gameState.player.y + 0.5) * (100 / 8);
              const mx = mousePos.x * 100;
              const my = mousePos.y * 100;
              const angle = Math.atan2(my - py, mx - px);
              const maxR = gameState.playerRange * (100 / 8);

              if (gameState.isGrenadeLauncher) {
                // Find nearest enemy on ray
                const rayDirX = Math.cos(angle);
                const rayDirY = Math.sin(angle);
                const enemiesOnRay = gameState.enemies.map(enemy => {
                  const epx = enemy.x - gameState.player.x;
                  const epy = enemy.y - gameState.player.y;
                  const dot = epx * rayDirX + epy * rayDirY;
                  if (dot <= 0) return { enemy, hit: false, distAlongLine: 0 };
                  const closestX = gameState.player.x + dot * rayDirX;
                  const closestY = gameState.player.y + dot * rayDirY;
                  const distToLine = Math.sqrt((enemy.x - closestX)**2 + (enemy.y - closestY)**2);
                  const eDist = Math.sqrt(epx * epx + epy * epy);
                  const hit = distToLine < 0.45 && eDist <= gameState.playerRange;
                  return { enemy, hit, distAlongLine: dot };
                })
                .filter(e => e.hit)
                .sort((a, b) => a.distAlongLine - b.distAlongLine);

                const firstEnemy = enemiesOnRay[0];
                const targetX = firstEnemy ? (firstEnemy.enemy.x + 0.5) * (100 / 8) : mx;
                const targetY = firstEnemy ? (firstEnemy.enemy.y + 0.5) * (100 / 8) : my;
                const explosionR = (1.5 * (100 / 8)); // 3x3 area approx

                const dist = firstEnemy ? firstEnemy.distAlongLine : Math.sqrt((mx - px)**2 + (my - py)**2) / (100 / 8);
                let circleColor = 'rgba(255, 255, 255, 0.4)'; // White (Out of range)
                let fillColor = 'rgba(255, 255, 255, 0.15)';

                if (dist <= gameState.playerRange * 0.33) {
                  circleColor = 'rgba(34, 197, 94, 0.5)'; // Green
                  fillColor = 'rgba(34, 197, 94, 0.15)';
                } else if (dist <= gameState.playerRange * 0.66) {
                  circleColor = 'rgba(234, 179, 8, 0.5)'; // Yellow
                  fillColor = 'rgba(234, 179, 8, 0.15)';
                } else if (dist <= gameState.playerRange) {
                  circleColor = 'rgba(239, 68, 68, 0.5)'; // Red
                  fillColor = 'rgba(239, 68, 68, 0.15)';
                }

                return (
                  <svg viewBox="0 0 100 100" className="absolute inset-0 pointer-events-none z-20 w-full h-full">
                    <line x1={px} y1={py} x2={targetX} y2={targetY} stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.2" strokeDasharray="1 1" />
                    <circle cx={targetX} cy={targetY} r={explosionR} fill={fillColor} stroke={circleColor} strokeWidth="0.3" />
                    <circle cx={targetX} cy={targetY} r="0.5" fill="white" />
                  </svg>
                );
              }

              if (gameState.isSniperGun) {
                const zones = [
                  { r: maxR * 0.33, color: 'rgba(34, 197, 94, 0.5)' },
                  { r: maxR * 0.66, color: 'rgba(234, 179, 8, 0.5)' },
                  { r: maxR, color: 'rgba(239, 68, 68, 0.5)' }
                ];

                return (
                  <svg viewBox="0 0 100 100" className="absolute inset-0 pointer-events-none z-20 w-full h-full">
                    {zones.reverse().map((zone, i) => {
                      const x = px + zone.r * Math.cos(angle);
                      const y = py + zone.r * Math.sin(angle);
                      return (
                        <line 
                          key={i}
                          x1={px} y1={py} x2={x} y2={y}
                          stroke={zone.color}
                          strokeWidth="0.8"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <line x1={px} y1={py} x2={mx} y2={my} stroke="white" strokeWidth="0.1" strokeDasharray="0.5 0.5" />
                  </svg>
                );
              }

              const startAngle = angle - Math.PI / 4;
              const endAngle = angle + Math.PI / 4;

              const zones = [
                { r: maxR * 0.33, color: 'rgba(34, 197, 94, 0.2)', stroke: 'rgba(34, 197, 94, 0.5)' }, // Green
                { r: maxR * 0.66, color: 'rgba(234, 179, 8, 0.15)', stroke: 'rgba(234, 179, 8, 0.4)' }, // Yellow
                { r: maxR, color: 'rgba(239, 68, 68, 0.1)', stroke: 'rgba(239, 68, 68, 0.3)' }      // Red
              ];

              return (
                <svg viewBox="0 0 100 100" className="absolute inset-0 pointer-events-none z-20 w-full h-full">
                  {zones.reverse().map((zone, i) => {
                    const x1 = px + zone.r * Math.cos(startAngle);
                    const y1 = py + zone.r * Math.sin(startAngle);
                    const x2 = px + zone.r * Math.cos(endAngle);
                    const y2 = py + zone.r * Math.sin(endAngle);
                    const pathData = `M ${px} ${py} L ${x1} ${y1} A ${zone.r} ${zone.r} 0 0 1 ${x2} ${y2} Z`;
                    
                    return (
                      <path 
                        key={i}
                        d={pathData}
                        fill={zone.color}
                        stroke={zone.stroke}
                        strokeWidth="0.3"
                      />
                    );
                  })}
                  <line 
                    x1={px} 
                    y1={py} 
                    x2={mx} 
                    y2={my} 
                    stroke="rgba(255, 255, 255, 0.4)" 
                    strokeWidth="0.2" 
                    strokeDasharray="1 1"
                  />
                </svg>
              );
            })()}

            {Array(BOARD_SIZE).fill(null).map((_, y) => (
              Array(BOARD_SIZE).fill(null).map((_, x) => {
                const piece = board[y][x];
                const isPlayer = piece?.id === 'player';
                const isEnemy = piece && !isPlayer;
                const isDark = (x + y) % 2 === 1;
                
                const isMoat = gameState.moatSquares.some(s => s.x === x && s.y === y);
                
                const dx = Math.abs(x - gameState.player.x);
                const dy = Math.abs(y - gameState.player.y);
                const isNormalMove = dx <= 1 && dy <= 1;
                const isWingsJump = (gameState.wingsCooldown <= 0) && ((dx === 1 && dy === 2) || (dx === 2 && dy === 1));

                const canMoveTo = gameState.turn === 'player' && 
                                  !gameState.isGameOver && 
                                  !gameState.isVictory &&
                                  !isMoat &&
                                  (isNormalMove || isWingsJump) &&
                                  !(x === gameState.player.x && y === gameState.player.y);

                const isAttacking = attackingEnemyId === piece?.id;
                const isDamaged = damagedPieceId === piece?.id;
                const isAttackTarget = hoveredAttackSquares.some(s => s.x === x && s.y === y);

                return (
                  <div 
                    key={`${x}-${y}`}
                    onMouseEnter={() => {
                      if (piece) setGameState(prev => ({ ...prev, hoveredPiece: piece }));
                    }}
                    onClick={() => {
                      if (isEnemy) handleShoot(x, y);
                      else if (canMoveTo) handlePlayerMove(x, y);
                    }}
                    className={cn(
                      "w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center relative cursor-pointer transition-all duration-200",
                      isMoat ? "bg-neutral-900" : (isDark ? "bg-neutral-800" : "bg-neutral-700"),
                      canMoveTo && "hover:bg-green-500/30",
                      isEnemy && "hover:bg-red-500/40",
                      isDamaged && piece?.color === 'black' && "bg-red-600/80",
                      isAttacking && "bg-blue-500/80",
                      isAttackTarget && "ring-2 ring-inset ring-red-500/50 bg-red-500/10"
                    )}
                    style={isDamaged && piece?.color === 'white' ? {
                      backgroundColor: `rgba(250, 204, 21, ${Math.min(0.9, lastDamageAmount / 5)})`
                    } : {}}
                  >
                    {isMoat && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <X size={40} className="text-red-600 opacity-60 stroke-[3]" />
                      </div>
                    )}
                    {/* Damage Preview Overlay */}
                    {isMouseDown && piece && potentialDamageMap.has(piece.id) && (
                      <div 
                        className="absolute inset-0 bg-yellow-400 z-30 pointer-events-none" 
                        style={{ opacity: Math.min(0.8, potentialDamageMap.get(piece.id)! / 10) }}
                      />
                    )}

                    {/* Coordinate Labels */}
                    {x === 0 && <span className="absolute left-0.5 top-0.5 text-[8px] text-neutral-500 font-bold opacity-30">{8-y}</span>}
                    {y === 7 && <span className="absolute right-0.5 bottom-0.5 text-[8px] text-neutral-500 font-bold opacity-30">{String.fromCharCode(97 + x)}</span>}

                      {piece && (
                        <motion.div
                          layout
                          initial={{ scale: 0 }}
                          animate={{ 
                            scale: 1,
                            x: isAttacking 
                              ? [0, (gameState.player.x - piece.x) * 100 + "%", 0] 
                              : (isDamaged ? [0, -4, 4, -4, 4, 0] : 0),
                            y: isAttacking 
                              ? [0, (gameState.player.y - piece.y) * 100 + "%", 0] 
                              : 0
                          }}
                          transition={{
                            duration: isAttacking ? 0.3 : 0.2,
                            ease: isAttacking ? "easeInOut" : "linear",
                            layout: { type: "spring", stiffness: 300, damping: 30 }
                          }}
                          className="relative z-10"
                        >
                          <motion.div animate={{ rotate: piece.rotation || 0 }}>
                            {React.createElement(PIECE_ICONS[piece.type], { 
                              size: 28, 
                              className: isPlayer ? "fill-white stroke-neutral-950" : "fill-red-600 stroke-white"
                            })}
                          </motion.div>
                          
                          {/* Armor Indicator */}
                          {piece.hasArmor && (
                            <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-pulse pointer-events-none" />
                          )}
                          
                          {/* HP Bar for enemies */}
                          {isEnemy && piece.maxHp > 1 && (
                            <div className="absolute -bottom-1 left-0 w-full flex justify-center gap-0.5">
                              {Array(piece.maxHp).fill(null).map((_, i) => {
                                const colorIndex = Math.floor(i / 7) % HP_COLORS.length;
                                const segmentColor = HP_COLORS[colorIndex];
                                return (
                                  <div 
                                    key={i} 
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full border border-black/50",
                                      i < piece.hp 
                                        ? (piece.type === 'king' && piece.color === 'white' ? "" : "bg-red-500") 
                                        : "bg-neutral-900"
                                    )}
                                    style={i < piece.hp && piece.type === 'king' && piece.color === 'white' ? { backgroundColor: segmentColor } : {}}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {/* Ammo Indicators for Player */}
                          {isPlayer && (
                            <div className="absolute -right-2 top-0 h-full flex flex-col justify-center gap-0.5">
                              {Array(gameState.maxAmmo).fill(null).map((_, i) => (
                                <div 
                                  key={i} 
                                  className={cn(
                                    "w-1 h-2 rounded-full border border-black/20",
                                    i < gameState.ammo ? "bg-yellow-400 shadow-[0_0_3px_rgba(250,204,21,0.8)]" : "bg-neutral-900/50"
                                  )}
                                />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    
                    {canMoveTo && !piece && (
                      <div className="w-2 h-2 bg-green-500/30 rounded-full" />
                    )}
                  </div>
                );
              })
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="w-full mt-4 flex justify-between items-center px-2 text-[10px] font-black uppercase tracking-tighter italic text-neutral-600">
            <div className="flex gap-4">
              <span>{t.difficulty}: {gameState.difficulty.toUpperCase()}</span>
              <span className="text-white">{t.turn}: {gameState.turn.toUpperCase()}</span>
            </div>
            <span>{t.mode}: {t.throne}</span>
          </div>
        </div>

        {/* Right Side (Buffs + Balanced Placeholder) */}
        <div className="flex-1 flex flex-row items-center justify-start gap-6">
          {/* Balanced Placeholder for Piece Info */}
          <div className="w-32 shrink-0" />

          {/* Right Buffs */}
          <div className="hidden xl:grid grid-cols-2 gap-2 w-32 shrink-0 content-start">
            {Array(10).fill(null).map((_, i) => {
              const buff = gameState.activeBuffs.filter((_, idx) => idx % 2 === 1)[i];
              return (
                <div 
                  key={`right-slot-${i}`}
                  className={cn(
                    "aspect-square border-2 rounded-sm flex items-center justify-center transition-all duration-300",
                    buff ? "bg-neutral-900 border-red-900/50 hover:border-red-600 shadow-lg shadow-red-900/10" : "border-neutral-900/30 bg-transparent"
                  )}
                >
                  {buff && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} title={buff.title}>
                      <Zap size={16} className="text-red-500" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showLanguageSelection && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="max-w-2xl w-full bg-neutral-900/80 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative overflow-hidden my-auto">
              {/* Decorative elements */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/10 rounded-full blur-[100px]" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-yellow-600/10 rounded-full blur-[100px]" />
              
              <div className="relative z-10">
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="mb-12"
                >
                  <h2 className="text-5xl font-black text-white uppercase tracking-tighter italic mb-2 text-center flex items-center justify-center gap-4">
                    <Crown className="text-yellow-500 w-12 h-12 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" /> SHOTGUN KING
                  </h2>
                  <p className="text-neutral-500 text-center text-[10px] uppercase tracking-[0.5em] font-black opacity-80">The Last Stand of the Black King</p>
                </motion.div>
                
                <div className="flex flex-col gap-12 mb-12">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-800" />
                      <h3 className="text-[11px] font-black text-neutral-300 uppercase tracking-[0.3em]">{translations[language].selectLanguage}</h3>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-800" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setLanguage('en')}
                        className={cn(
                          "group relative p-5 rounded-2xl border-2 transition-all duration-500 overflow-hidden text-left",
                          language === 'en' 
                            ? "bg-white border-white text-black scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.3)]" 
                            : "bg-neutral-800/30 border-neutral-800 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        )}
                      >
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="font-black uppercase tracking-widest text-base italic">EN</span>
                          {language === 'en' && <div className="w-2 h-2 bg-black rounded-full" />}
                        </div>
                        {language === 'en' && <motion.div layoutId="lang-active" className="absolute inset-0 bg-white" />}
                      </button>
                      
                      <button 
                        onClick={() => setLanguage('vi')}
                        className={cn(
                          "group relative p-5 rounded-2xl border-2 transition-all duration-500 overflow-hidden text-left",
                          language === 'vi' 
                            ? "bg-white border-white text-black scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.3)]" 
                            : "bg-neutral-800/30 border-neutral-800 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        )}
                      >
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="font-black uppercase tracking-widest text-base italic">VI</span>
                          {language === 'vi' && <div className="w-2 h-2 bg-black rounded-full" />}
                        </div>
                        {language === 'vi' && <motion.div layoutId="lang-active" className="absolute inset-0 bg-white" />}
                      </button>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-800" />
                      <h3 className="text-[11px] font-black text-neutral-300 uppercase tracking-[0.3em]">{translations[language].difficulty}</h3>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-800" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {(['easy', 'normal', 'hard'] as const).map((d) => (
                        <button 
                          key={d}
                          onClick={() => setGameState(prev => ({ ...prev, difficulty: d }))}
                          className={cn(
                            "group relative p-5 rounded-2xl border-2 transition-all duration-500 flex flex-col items-start gap-1 overflow-hidden",
                            gameState.difficulty === d 
                              ? (d === 'hard' ? "bg-red-600 border-red-600 text-white scale-[1.02] shadow-[0_0_30px_rgba(220,38,38,0.4)]" : "bg-white border-white text-black scale-[1.02] shadow-2xl") 
                              : (d === 'hard' 
                                  ? "bg-neutral-800/30 border-neutral-800 text-neutral-300 hover:border-red-900/50 hover:bg-red-950/10 hover:shadow-[0_0_20px_rgba(220,38,38,0.1)]" 
                                  : "bg-neutral-800/30 border-neutral-800 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]")
                          )}
                        >
                          <div className="relative z-10 flex items-center justify-between w-full">
                            <span className="font-black uppercase tracking-widest text-base italic">{translations[language][d]}</span>
                            {gameState.difficulty === d && <div className={cn("w-2 h-2 rounded-full", d === 'hard' ? "bg-white" : "bg-black")} />}
                          </div>
                          <span className="relative z-10 text-[10px] opacity-80 leading-tight text-left font-bold uppercase tracking-tight">{translations[language][`${d}Desc` as keyof typeof t]}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </div>

                <motion.button 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => {
                    setShowLanguageSelection(false);
                    setGameState(prev => ({ 
                      ...prev, 
                      message: translations[language].moveReload,
                      enemies: rollEnemyActions(prev.enemies, prev.difficulty)
                    }));
                  }}
                  className="w-full py-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black uppercase tracking-[0.4em] text-lg rounded-2xl transition-all duration-500 shadow-[0_20px_50px_rgba(220,38,38,0.4)] hover:shadow-[0_25px_60px_rgba(220,38,38,0.5)] hover:-translate-y-1 active:translate-y-0"
                >
                  {translations[language].start}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <Skull className="text-red-600 mb-4" size={64} />
            <h2 className="text-5xl font-black text-red-500 mb-2 uppercase italic tracking-tighter">{t.gameOver}</h2>
            <p className="text-neutral-400 mb-8 uppercase text-xs tracking-widest">{t.floor} {gameState.floor}</p>
            <button onClick={resetGame} className="bg-red-600 hover:bg-red-700 text-white font-black py-3 px-10 rounded-sm uppercase tracking-widest transition-all active:scale-95">{t.restart}</button>
          </motion.div>
        )}
        {gameState.isVictory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <Trophy className="text-yellow-500 mb-4" size={64} />
            <h2 className="text-5xl font-black text-yellow-500 mb-2 uppercase italic tracking-tighter">{t.victory}</h2>
            <p className="text-neutral-400 mb-8 uppercase text-xs tracking-widest">{t.floor} {gameState.floor} COMPLETE</p>
            <button onClick={startBuffSelection} className="bg-yellow-600 hover:bg-yellow-700 text-white font-black py-3 px-10 rounded-sm uppercase tracking-widest transition-all active:scale-95">{t.nextFloor}</button>
          </motion.div>
        )}
        {gameState.showBuffSelection && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
            <h2 className="text-4xl font-black text-white mb-12 uppercase italic tracking-tighter">{t.selectBuff}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
              {gameState.availableBuffs.map((card) => (
                <motion.div key={card.id} whileHover={{ scale: 1.05, translateY: -10 }} onClick={() => applyBuff(card)} className="bg-neutral-900 border-2 border-neutral-800 p-6 rounded-lg cursor-pointer hover:border-red-600 transition-colors flex flex-col items-center text-center group">
                  <Zap className="text-red-500 mb-4" size={32} />
                  <h3 className="text-lg font-black text-white mb-2 uppercase">{t.buffs[card.id as keyof typeof t.buffs]?.title || card.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{t.buffs[card.id as keyof typeof t.buffs]?.description || card.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-neutral-900 border-2 border-neutral-800 p-8 rounded-lg max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black text-white italic tracking-tighter flex items-center gap-3">
                  <Crown className="text-yellow-500" /> {t.howToPlay}
                </h2>
                <button 
                  onClick={() => setShowTutorial(false)}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  <RotateCcw size={24} />
                </button>
              </div>

              <div className="space-y-6 text-neutral-300">
                <section>
                  <h3 className="text-yellow-500 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                    <Move size={14} /> {t.movementReloading}
                  </h3>
                  <p>{t.movementDesc}</p>
                </section>

                <section>
                  <h3 className="text-red-500 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                    <Crosshair size={14} /> {t.shooting}
                  </h3>
                  <p>{t.shootingDesc}</p>
                  <p className="mt-2 text-sm italic text-neutral-500">{t.damagePreview}</p>
                </section>

                <section>
                  <h3 className="text-blue-500 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                    <Zap size={14} /> {t.specialAbilities}
                  </h3>
                  <p>{t.wingsDesc}</p>
                </section>

                <section>
                  <h3 className="text-green-500 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                    <Shield size={14} /> {t.enemies}
                  </h3>
                  <p>{t.enemiesDesc}</p>
                </section>

                <section className="bg-neutral-800/50 p-4 rounded-sm border border-neutral-700">
                  <h3 className="text-white font-bold uppercase text-xs tracking-widest mb-2">{language === 'vi' ? 'Điều kiện chiến thắng' : 'Victory Condition'}</h3>
                  <p>{language === 'vi' ? 'Tìm và tiêu diệt **Vua Trắng**. Hãy cẩn thận: hắn hồi 1 HP mỗi khi di chuyển!' : 'Locate and eliminate the **White King**. Be careful: he heals 1 HP every time he moves!'}</p>
                </section>

                <section className="bg-neutral-800/30 p-4 rounded-sm border border-neutral-700">
                  <h3 className="text-white font-bold uppercase text-xs tracking-widest mb-2">{t.instructions}</h3>
                  <p className="text-sm italic text-neutral-400">{t.holdToPreview}</p>
                </section>

                <div className="pt-4 border-t border-neutral-800">
                  <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] text-center">
                    {language === 'vi' ? 'Dự án được lên ý tưởng và thực hiện bởi Trịnh Khánh' : 'Project conceptualized and executed by Trịnh Khánh'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowTutorial(false)}
                className="w-full mt-8 py-4 bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-widest rounded-sm transition-all"
              >
                {t.start}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
