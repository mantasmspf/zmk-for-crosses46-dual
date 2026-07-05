// Screen-space dynamic lighting: darkens the whole scene then punches
// additive glow circles back in at neon-sign / player / impact positions.
const Lighting = (() => {
  let flashes = []; // transient light bursts: {x,y,color,r,life,maxLife}

  function addFlash(x, y, color, r, life = 0.25) {
    flashes.push({ x, y, color, r, life, maxLife: life });
  }

  function update(dt) {
    flashes.forEach((f) => (f.life -= dt));
    flashes = flashes.filter((f) => f.life > 0);
  }

  function drawLight(ctx, sx, sy, radius, color, alpha = 1) {
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0, hexToRgba(color, 0.85 * alpha));
    grad.addColorStop(0.4, hexToRgba(color, 0.35 * alpha));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function render(ctx, canvasW, canvasH, camX, camY, level, player, ambient) {
    // 1. darken scene for night atmosphere
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(3,2,10,${ambient})`;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. additive light punches
    ctx.globalCompositeOperation = "lighter";
    level.lights.forEach((l) => {
      const sx = l.x - camX;
      const sy = l.y - camY;
      if (sx < -l.r || sx > canvasW + l.r || sy < -l.r || sy > canvasH + l.r) return;
      const flicker = 0.85 + 0.15 * Math.sin(performance.now() / 220 + l.x);
      drawLight(ctx, sx, sy, l.r, l.color, flicker);
    });

    // player glow follows the runner's chest light
    if (player) {
      drawLight(ctx, player.x - camX + player.w / 2, player.y - camY + player.h / 2, 55, "#ff2ec8", 0.9);
    }

    flashes.forEach((f) => {
      const a = f.life / f.maxLife;
      drawLight(ctx, f.x - camX, f.y - camY, f.r * (1.4 - a * 0.4), f.color, a);
    });

    ctx.restore();
  }

  return { addFlash, update, render };
})();
