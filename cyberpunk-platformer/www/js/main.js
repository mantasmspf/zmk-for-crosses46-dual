(function () {
  // Keep --app-vh pinned to the *visible* viewport height as a fallback for
  // browsers without `dvh` support -- mobile browser chrome (address bar,
  // nav buttons) can show/hide without firing a layout-relevant resize of
  // 100vh, which otherwise leaves the bottom of the screen (touch controls)
  // hidden behind that browser UI.
  function syncViewportHeight() {
    const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
    document.documentElement.style.setProperty("--app-vh", `${h}px`);
  }
  syncViewportHeight();
  window.addEventListener("resize", syncViewportHeight);
  window.addEventListener("orientationchange", syncViewportHeight);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", syncViewportHeight);

  const VIEW_W = 480;
  const VIEW_H = 272;

  const gameCanvas = document.getElementById("game");
  const glCanvas = document.getElementById("glcanvas");
  const ctx = gameCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBtn = document.getElementById("overlay-btn");
  const shardCountEl = document.getElementById("shard-count");
  const shardTotalEl = document.getElementById("shard-total");
  const levelNumEl = document.getElementById("level-num");
  const livesCountEl = document.getElementById("lives-count");

  const glOk = Shader.init(glCanvas);
  if (!glOk) glCanvas.style.display = "none";

  // ---------------------------------------------------------- assets ----
  const IMG = {};
  const ASSET_LIST = [
    "player_idle", "player_run", "player_jump", "enemy_drone", "shard", "tiles", "bg_far", "bg_mid", "rain",
  ];
  let assetsLoaded = 0;

  function loadAssets(cb) {
    ASSET_LIST.forEach((name) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        assetsLoaded++;
        if (assetsLoaded === ASSET_LIST.length) cb();
      };
      img.src = `assets/sprites/${name}.png`;
      IMG[name] = img;
    });
  }

  // ----------------------------------------------------------- input ----
  const input = { left: false, right: false, jump: false, jumpPressed: false };
  let jumpWasDown = false;

  function keydown(e) {
    if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = true;
    if (["ArrowRight", "d", "D"].includes(e.key)) input.right = true;
    if (["ArrowUp", "w", "W", " "].includes(e.key)) input.jump = true;
  }
  function keyup(e) {
    if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = false;
    if (["ArrowRight", "d", "D"].includes(e.key)) input.right = false;
    if (["ArrowUp", "w", "W", " "].includes(e.key)) input.jump = false;
  }
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);

  function bindTouch(id, onDown, onUp) {
    const el = document.getElementById(id);
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { e.preventDefault(); onUp(); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
  }
  bindTouch("touch-left", () => (input.left = true), () => (input.left = false));
  bindTouch("touch-right", () => (input.right = true), () => (input.right = false));
  bindTouch("touch-jump", () => (input.jump = true), () => (input.jump = false));

  window.addEventListener("pointerdown", () => Audio2.unlock(), { once: true });
  window.addEventListener("keydown", () => Audio2.unlock(), { once: true });

  // ------------------------------------------------------------ state ---
  const STATE = { BOOT: 0, STORY: 1, LEVEL_INTRO: 2, PLAYING: 3, LEVEL_OUT: 4, ENDING: 5, GAME_OVER: 6 };
  let state = STATE.BOOT;
  let levelIndex = 0;
  let level = null;
  let player = null;
  let enemies = [];
  let shardsCollected = [];
  let checkpoint = null;
  let lives = 3;
  let totalShards = 0;
  let camX = 0;
  let startTime = performance.now();
  let lastTime = performance.now();

  function totalShardsInLevel(lv) { return lv.shards.length; }

  function loadLevel(idx) {
    level = LEVELS[idx];
    player = new Player(level.spawn.x, level.spawn.y);
    player.onHurt = onPlayerHurt;
    enemies = level.enemies.map((e) => new Enemy(e));
    shardsCollected = new Array(level.shards.length).fill(false);
    checkpoint = { x: level.spawn.x, y: level.spawn.y };
    camX = 0;
    Audio2.playMusic(level.musicTrack);
    levelNumEl.textContent = level.id;
    shardTotalEl.textContent = level.shards.length;
    updateHud();
  }

  function onPlayerHurt(fatal) {
    lives--;
    updateHud();
    if (lives <= 0) {
      Audio2.stopMusic();
      Audio2.sfx.gameOver();
      showOverlay("SIGNAL LOST", Story.gameOver, "RETRY SECTOR", () => {
        lives = 3;
        loadLevel(levelIndex);
        state = STATE.PLAYING;
      });
      state = STATE.GAME_OVER;
    } else {
      player.x = checkpoint.x;
      player.y = checkpoint.y;
      player.vx = 0;
      player.vy = 0;
    }
  }

  function updateHud() {
    const collected = shardsCollected.filter(Boolean).length;
    shardCountEl.textContent = collected;
    livesCountEl.textContent = lives;
  }

  function showOverlay(title, text, btnLabel, onGo) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btnLabel;
    overlay.classList.remove("hidden");
    overlayBtn.onclick = () => {
      overlay.classList.add("hidden");
      Audio2.unlock();
      onGo();
    };
  }

  function beginGame() {
    state = STATE.LEVEL_INTRO;
    levelIndex = 0;
    lives = 3;
    loadLevel(levelIndex);
    showOverlay(level.name + " — " + level.subtitle, Story.levelIntro[levelIndex], "DROP IN", () => {
      state = STATE.PLAYING;
    });
  }

  function finishLevel() {
    Audio2.stopMusic();
    Audio2.sfx.levelComplete();
    state = STATE.LEVEL_OUT;
    const outroText = Story.levelOutro[levelIndex] + "\n\nShards secured: " +
      shardsCollected.filter(Boolean).length + "/" + level.shards.length;
    if (levelIndex < LEVELS.length - 1) {
      showOverlay("SECTOR CLEAR", outroText, "CONTINUE", () => {
        levelIndex++;
        loadLevel(levelIndex);
        showOverlay(level.name + " — " + level.subtitle, Story.levelIntro[levelIndex], "DROP IN", () => {
          state = STATE.PLAYING;
        });
      });
    } else {
      showOverlay("BLACKOUT CITY", Story.ending, "PLAY AGAIN", () => {
        beginGame();
      });
      state = STATE.ENDING;
    }
  }

  // ------------------------------------------------------------ update --
  function updatePlaying(dt) {
    input.jumpPressed = input.jump && !jumpWasDown;
    jumpWasDown = input.jump;

    player.update(dt, input, level);
    enemies.forEach((e) => e.update(dt));
    Lighting.update(dt);

    // collectibles
    const hb = player.hurtbox();
    level.shards.forEach(([tx, ty], i) => {
      if (shardsCollected[i]) return;
      const rect = { x: tx * TILE + 3, y: ty * TILE + 3, w: 10, h: 10 };
      if (aabbOverlap(hb, rect)) {
        shardsCollected[i] = true;
        Audio2.sfx.collect();
        Lighting.addFlash(rect.x, rect.y, "#60dc82", 45, 0.2);
        updateHud();
      }
    });

    // checkpoints
    level.checkpoints.forEach((c) => {
      const rect = { x: c.x, y: c.y - 32, w: 8, h: 64 };
      if (aabbOverlap(hb, rect) && (checkpoint.x !== c.x || checkpoint.y !== c.y)) {
        checkpoint = { x: c.x, y: c.y };
        Audio2.sfx.checkpoint();
      }
    });

    // enemies
    if (player.invuln <= 0) {
      for (const e of enemies) {
        if (aabbOverlap(hb, e.hitbox())) {
          player.hurt();
          break;
        }
      }
    }

    // exit
    const exitRect = { x: level.exit.x, y: level.exit.y - 8, w: 16, h: 48 };
    if (aabbOverlap(hb, exitRect)) finishLevel();

    // camera
    const targetCamX = player.x + player.w / 2 - VIEW_W / 2;
    camX = Math.max(0, Math.min(targetCamX, level.width * TILE - VIEW_W));
  }

  // ------------------------------------------------------------ render --
  function drawParallax(img, speedFactor, alpha) {
    if (!img.complete || img.naturalWidth === 0) return;
    ctx.globalAlpha = alpha;
    const offset = -(camX * speedFactor) % img.width;
    const y = VIEW_H - img.height;
    for (let x = offset - img.width; x < VIEW_W; x += img.width) {
      ctx.drawImage(img, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function drawSpike(x, y) {
    const t = performance.now() / 300;
    ctx.fillStyle = "#160a1e";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#ff2ec8";
    const glow = 0.7 + 0.3 * Math.sin(t + x);
    ctx.globalAlpha = glow;
    for (let i = 0; i < 3; i++) {
      const sx = x + i * (TILE / 3);
      ctx.beginPath();
      ctx.moveTo(sx, y + TILE);
      ctx.lineTo(sx + TILE / 6, y + TILE - 12);
      ctx.lineTo(sx + TILE / 3, y + TILE);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Guards every drawImage() call below -- a broken or not-yet-decoded
  // image throws on draw in some WebViews, which would otherwise kill the
  // rAF loop (and the whole game) on the very first bad frame.
  function imgReady(img) {
    return !!img && img.complete && img.naturalWidth > 0;
  }

  function drawTiles() {
    if (!imgReady(IMG.tiles)) return;
    const x0 = Math.floor(camX / TILE);
    const x1 = Math.ceil((camX + VIEW_W) / TILE);
    for (let ty = 0; ty < level.height; ty++) {
      for (let tx = Math.max(0, x0); tx <= Math.min(level.width - 1, x1); tx++) {
        const t = level.grid[ty][tx];
        if (t === 0) continue;
        const dx = tx * TILE - camX;
        const dy = ty * TILE;
        if (t === 1 || t === 2) {
          const frame = t - 1;
          ctx.drawImage(IMG.tiles, frame * 96, 0, 96, 96, dx, dy, TILE, TILE);
        } else if (t === 3) {
          drawSpike(dx, dy);
        }
      }
    }
  }

  function drawShards() {
    if (!imgReady(IMG.shard)) return;
    level.shards.forEach(([tx, ty], i) => {
      if (shardsCollected[i]) return;
      const frame = Math.floor(performance.now() / 260) % 2;
      const dx = tx * TILE - camX;
      const dy = ty * TILE;
      ctx.drawImage(IMG.shard, frame * 60, 0, 60, 60, dx + 3, dy + 3, 10, 10);
    });
  }

  function drawEnemies() {
    if (!imgReady(IMG.enemy_drone)) return;
    enemies.forEach((e) => {
      const dx = e.x - camX;
      const dy = e.y + e.bob;
      ctx.drawImage(IMG.enemy_drone, e.animFrame * 96, 0, 96, 96, dx, dy, 16, 16);
    });
  }

  function drawExit() {
    const dx = level.exit.x - camX;
    const dy = level.exit.y - 8;
    const t = performance.now() / 260;
    ctx.strokeStyle = "#ffe23c";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t);
    ctx.strokeRect(dx, dy, 16, 48);
    ctx.fillStyle = "rgba(255,226,60,0.15)";
    ctx.fillRect(dx, dy, 16, 48);
    ctx.globalAlpha = 1;
  }

  function drawCheckpoints() {
    level.checkpoints.forEach((c) => {
      const dx = c.x - camX;
      const dy = c.y - 32;
      const active = checkpoint.x === c.x && checkpoint.y === c.y;
      ctx.globalAlpha = active ? 0.8 : 0.35;
      ctx.fillStyle = "#57fff0";
      ctx.fillRect(dx, dy, 4, 64);
      ctx.globalAlpha = 1;
    });
  }

  function drawPlayer() {
    const sheet = IMG["player_" + player.anim];
    if (!imgReady(sheet)) return;
    const frames = player.anim === "run" ? 4 : player.anim === "idle" ? 2 : 1;
    const frame = player.animFrame % frames;
    const dx = player.x - camX;
    const dy = player.y;
    ctx.save();
    if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    if (player.facing < 0) {
      ctx.translate(dx + player.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame * 96, 0, 96, 144, 0, 0, player.w, player.h);
    } else {
      ctx.drawImage(sheet, frame * 96, 0, 96, 144, dx, dy, player.w, player.h);
    }
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = level ? level.bgTint : "#0a0715";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (level) {
      try {
        drawParallax(IMG.bg_far, 0.15, 0.8);
        drawParallax(IMG.bg_mid, 0.35, 0.9);
        drawTiles();
        drawCheckpoints();
        drawShards();
        drawExit();
        drawEnemies();
        drawPlayer();
        drawParallax(IMG.rain, 0.5, 0.35);
        Lighting.render(ctx, VIEW_W, VIEW_H, camX, 0, level, player, 0.5);
      } catch (e) {
        // Never let a single bad frame kill the render loop for the rest
        // of the session -- fall back to the flat background fill above
        // and keep going; the next frame gets a fresh attempt.
        console.error("render error:", e);
      }
    }

    const time = (performance.now() - startTime) / 1000;
    try {
      if (glOk) Shader.render(gameCanvas, VIEW_W, VIEW_H, time);
    } catch (e) {
      console.error("shader render error:", e);
    }
  }

  function loop() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.033);

    try {
      if (state === STATE.PLAYING) updatePlaying(dt);
      render();
    } catch (e) {
      console.error("game loop error:", e);
    }
    requestAnimationFrame(loop);
  }

  // Read-only debug hooks (harmless in an offline single-player game;
  // used by the automated playtest and left in for manual QA on-device).
  window.__game = {
    get player() { return player; },
    get lives() { return lives; },
    get camX() { return camX; },
    get state() { return state; },
    get level() { return level; },
  };

  // -------------------------------------------------------------- boot --
  loadAssets(() => {
    showOverlay(Story.title, Story.intro, "JACK IN", () => {
      beginGame();
    });
    requestAnimationFrame(loop);
  });
})();
