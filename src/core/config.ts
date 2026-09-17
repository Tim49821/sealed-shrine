// M1 temp balance (§4). ALL tentative; actual values recorded in
// docs/implementation-report.md. Gameplay code must read from here.
export const BALANCE = {
  canvasW: 640,
  canvasH: 480,
  fieldX: 24,
  fieldY: 16,
  fieldW: 384,
  fieldH: 448,

  // px per tick at 60Hz
  speedHi: 3.8,
  speedLo: 1.65,

  hitRadius: 2.5,
  grazeRadius: 18,

  livesStart: 3, // includes current life
  bombsStart: 3,
  maxLives: 6,

  deathbombWindow: 8, // ticks; 8th post-hit input still allowed
  respawnInvuln: 180, // ticks
  bombInvuln: 180, // ticks

  powerMax: 4.0,
  powerSmallItem: 0.05,

  collectLineY: 112, // field coords
  collectMinPower: 2.0,

  extendThresholds: [100000, 300000, 600000],

  grazeScore: 100,

  enemyBulletPool: 8192,
  playerShotPool: 512,
  enemyPool: 64,
  itemPool: 256,

  // player shots
  shotInterval: 6, // ticks between volleys while holding Z
  shotSpeed: 11,
  shotDamage: 1,
  // bomb deals heavy damage over its duration
  bombDamagePerTick: 6,
  bombDuration: 120, // visual + damage ticks (invuln lasts bombInvuln)

  // death penalty
  powerLossOnDeath: 1.0,

  // point item base by height fraction (top -> bottom)
  pointTop: 10000,
  pointBottom: 1000,

  // enemy contact damage uses same deathbomb rules
  enemyContactRadius: 10,

  // enemy lifetime: retreat then flee so stage waves can never stall (§review 2)
  enemyTtl: 3600, // ticks for drift/sine movers
  hoverTtl: 2700, // ticks for hover movers
  retreatTicks: 150, // upward retreat before fleeing
  stageFailsafeTicks: 3600, // past wavesEndTick: force midboss, leftovers flee
} as const;
