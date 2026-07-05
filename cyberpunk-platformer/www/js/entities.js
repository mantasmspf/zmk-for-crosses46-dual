// Simple AABB tile-collision platformer physics.
const GRAVITY = 1500;
const MOVE_SPEED = 150;
const JUMP_VEL = -430;
const MAX_FALL = 620;

function tileSolid(level, tx, ty) {
  // Falling below/beside the map must NOT count as solid ground — it has to
  // stay open air so a missed jump falls all the way to the void-death check
  // instead of landing on an invisible floor.
  if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return false;
  const t = level.grid[ty][tx];
  return t === 1 || t === 2;
}

function tileHazard(level, tx, ty) {
  if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return false;
  return level.grid[ty][tx] === 3;
}

function rectVsLevelSolid(level, x, y, w, h) {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + w - 1) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileSolid(level, tx, ty)) return true;
    }
  }
  return false;
}

function rectVsLevelHazard(level, x, y, w, h) {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + w - 1) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileHazard(level, tx, ty)) return true;
    }
  }
  return false;
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 24;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.anim = "idle";
    this.animFrame = 0;
    this.animTimer = 0;
    this.invuln = 0;
    this.canDouble = true;
    this.usedDouble = false;
    this.dead = false;
  }

  hurtbox() {
    return { x: this.x + 2, y: this.y + 1, w: this.w - 4, h: this.h - 2 };
  }

  update(dt, input, level) {
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;

    // horizontal
    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    this.vx = move * MOVE_SPEED;
    if (move !== 0) this.facing = move;

    // gravity
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);

    // jump / double jump
    if (input.jumpPressed) {
      if (this.onGround) {
        this.vy = JUMP_VEL;
        this.onGround = false;
        this.usedDouble = false;
        Audio2.sfx.jump();
      } else if (this.canDouble && !this.usedDouble) {
        this.vy = JUMP_VEL * 0.85;
        this.usedDouble = true;
        Audio2.sfx.doubleJump();
        Lighting.addFlash(this.x + this.w / 2, this.y + this.h, "#57fff0", 40, 0.2);
      }
    }

    // move + collide X
    let nx = this.x + this.vx * dt;
    if (this.vx !== 0) {
      if (!rectVsLevelSolid(level, this.vx > 0 ? nx + this.w : nx, this.y + 1, 1, this.h - 2)) {
        this.x = nx;
      } else {
        this.x = this.vx > 0 ? Math.floor((nx + this.w) / TILE) * TILE - this.w - 0.01 : Math.ceil(nx / TILE) * TILE + 0.01;
      }
    }

    // move + collide Y
    let ny = this.y + this.vy * dt;
    this.onGround = false;
    if (this.vy !== 0) {
      const checkY = this.vy > 0 ? ny + this.h : ny;
      if (!rectVsLevelSolid(level, this.x, checkY, this.w, 1)) {
        this.y = ny;
      } else {
        if (this.vy > 0) {
          this.y = Math.floor((ny + this.h) / TILE) * TILE - this.h - 0.01;
          this.onGround = true;
          this.usedDouble = false;
        } else {
          this.y = Math.ceil(ny / TILE) * TILE + 0.01;
        }
        this.vy = 0;
      }
    }

    // hazard check
    const hb = this.hurtbox();
    if (rectVsLevelHazard(level, hb.x, hb.y, hb.w, hb.h) && this.invuln <= 0) {
      this.hurt();
    }

    // fell into void
    if (this.y > level.height * TILE + 100) {
      this.hurt(true);
    }

    // animation state
    if (!this.onGround) this.anim = "jump";
    else if (Math.abs(this.vx) > 1) this.anim = "run";
    else this.anim = "idle";

    this.animTimer += dt;
    const frameTime = this.anim === "run" ? 0.09 : 0.35;
    if (this.animTimer >= frameTime) {
      this.animTimer = 0;
      this.animFrame++;
    }
  }

  hurt(fatal = false) {
    if (this.invuln > 0) return;
    Audio2.sfx.hurt();
    Lighting.addFlash(this.x + this.w / 2, this.y + this.h / 2, "#ff3c5a", 70, 0.3);
    this.invuln = 1.4;
    this.onHurt && this.onHurt(fatal);
  }
}

class Enemy {
  constructor(def) {
    this.x0 = def.x;
    this.x = def.x;
    this.y = def.y;
    this.w = 16;
    this.h = 16;
    this.range = def.range;
    this.dir = 1;
    this.speed = 40;
    this.animTimer = 0;
    this.animFrame = 0;
    this.bob = 0;
  }

  update(dt) {
    this.x += this.dir * this.speed * dt;
    if (this.x > this.x0 + this.range) this.dir = -1;
    if (this.x < this.x0 - this.range) this.dir = 1;
    this.bob = Math.sin(performance.now() / 260 + this.x0) * 2;
    this.animTimer += dt;
    if (this.animTimer > 0.25) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }
  }

  hitbox() {
    return { x: this.x + 2, y: this.y + this.bob + 2, w: this.w - 4, h: this.h - 4 };
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
