figma.showUI(__html__, { width: 960, height: 800, themeColors: true });

let cachedParticles = [];

// --- HELPERS ---
function validateNum(val, min, max, def) {
  const num = parseFloat(val);
  if (isNaN(num) || num < min || num > max) return def;
  return num;
}

function hslToRgba(h, s, l, a) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a_hsl = s * Math.min(l, 1 - l);
  const f = (n) => l - a_hsl * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0), g: f(8), b: f(4), a: a !== undefined ? a : 1.0 };
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}

function setScaleConstraints(node) {
    if ("constraints" in node) {
        node.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    }
    if ("children" in node) {
        for (const child of node.children) {
            setScaleConstraints(child);
        }
    }
}

// --- PALETTE GENERATOR ---
function getColorPalette(settings) {
    if (settings.shapeTab === 'emoji' || settings.shapeTab === 'flag') return [];
    if (settings.colorData.isMultiColor) {
        return [
          { type: 'solid', r: 1, g: 0.2, b: 0.2, a: 1 },
          { type: 'solid', r: 1, g: 0.6, b: 0, a: 1 },
          { type: 'solid', r: 1, g: 0.9, b: 0, a: 1 },
          { type: 'solid', r: 0.2, g: 0.8, b: 0.2, a: 1 },
          { type: 'solid', r: 0.2, g: 0.6, b: 1, a: 1 },
          { type: 'solid', r: 0.6, g: 0.2, b: 0.8, a: 1 },
        ];
    } else {
        return settings.colorData.customColors.map((c) => {
            if (c.type === 'linear') {
                const figmaStops = c.stops.map(stop => {
                    const rgb = hexToRgb(stop.color);
                    return { position: stop.percent / 100, color: { r: rgb.r, g: rgb.g, b: rgb.b, a: stop.alpha * (c.a || 1.0) } };
                });
                return { 
                    type: 'linear', 
                    subtype: c.gradientSubtype || 'Linear',
                    gradientStops: figmaStops, 
                    isVertical: c.isVertical,
                    globalAlpha: c.a || 1.0
                };
            } else {
                const rgba = hslToRgba(c.h, c.s, c.l, c.a);
                rgba.type = 'solid';
                return rgba;
            }
        });
    }
}

// --- DATA POOL ---
function initializeParticlePool(settings, bounds, isPreview = false) {
  const { width: boundsWidth, height: boundsHeight } = bounds;
  const randomness = validateNum(settings.randomness, 0, 100, 60) / 100; 
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 0, 50, 10);
  const flutter = validateNum(settings.flutter, 0, 100, 50) / 50; 
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;
  const totalFrames = Math.max(1, validateNum(settings.frameCount, 1, 100, 20));

  let shapesToUse = [];
  const isEmojiMode = settings.shapeTab === 'emoji';
  const isFlagMode = settings.shapeTab === 'flag';

  if (isEmojiMode) {
      shapesToUse = (Array.isArray(settings.selectedEmojis) && settings.selectedEmojis.length > 0) ? settings.selectedEmojis : ['😀'];
  } else if (isFlagMode) {
      shapesToUse = (Array.isArray(settings.selectedFlags) && settings.selectedFlags.length > 0) ? settings.selectedFlags : [];
  } else {
      shapesToUse = (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) ? settings.selectedShapes : [];
  }

  if (shapesToUse.length === 0) return [];

  const colorPalette = getColorPalette(settings);
  const count = Math.floor((boundsWidth * boundsHeight / 3000) * (0.1 + (amount / 100) * 2.9));
  const particles = [];

  for (let i = 0; i < count; i++) {
    const shapeIdentifier = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    const baseReferenceSize = 20; 
    let baseWidth = baseReferenceSize;
    let baseHeight = baseReferenceSize;
    
    if (shapeIdentifier === 'rectangle') { baseWidth = baseReferenceSize * 1.5; baseHeight = baseReferenceSize * 0.9; }
    if (isEmojiMode || shapeIdentifier === 'custom' || isFlagMode) { baseWidth = baseReferenceSize * 1.2; baseHeight = baseReferenceSize * 1.2; }
    if (shapeIdentifier === 'wave') { baseWidth = baseReferenceSize * 1.0; baseHeight = baseReferenceSize * 1.4; }

    let scaleFactor = (zoom / 10) * (randomizeSize ? (0.5 + Math.random()) : 1);
    scaleFactor = Math.max(scaleFactor, 0.1);
    const actualHeight = baseHeight * scaleFactor;

    let xPos, startY, targetEndY;
    if (isPreview) {
        xPos = (Math.random() * boundsWidth * 1.1) - (boundsWidth * 0.05);
        startY = (Math.random() * boundsHeight);
        targetEndY = startY; 
    } else {
        xPos = Math.random() * Math.max(0, boundsWidth - (baseWidth * scaleFactor));
        startY = -actualHeight - 50 - (Math.random() * boundsHeight * 1.5);
        targetEndY = boundsHeight + (0.6 * boundsHeight * 2);
    }
    
    const steps = Math.max(1, totalFrames - 1);
    const finalPixelsPerFrame = ((targetEndY - startY) / steps) * (1 + ((Math.random() - 0.5) * 0.6 * randomness));
    const initialRotation = randomizeRotation ? Math.random() * 360 : 0;
    const rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness * flutter : 0;

    particles.push({
      isEmoji: isEmojiMode,
      shapeType: isFlagMode ? 'flag' : (shapeIdentifier === 'custom' ? 'custom' : shapeIdentifier),
      flagSvg: isFlagMode ? shapeIdentifier.svg : null,
      customPathData: shapeIdentifier === 'custom' ? settings.customShapePath : null,
      customViewBox: shapeIdentifier === 'custom' ? settings.customViewBox : "0 0 320 320",
      color: (!isEmojiMode && !isFlagMode && colorPalette.length > 0) ? colorPalette[Math.floor(Math.random() * colorPalette.length)] : null,
      baseWidth, baseHeight, scale: scaleFactor, startX: xPos, startY, pixelsPerFrame: finalPixelsPerFrame,
      initialRotation, rotationSpeed, driftAmp: 10 + (Math.random() * 80 * randomness), driftSpeed: 0.05 + (Math.random() * 0.15 * randomness), driftPhase: Math.random() * Math.PI * 2,
      flipSpeed: (0.1 + (Math.random() * 0.4 * randomness)) * flutter, flipPhase: Math.random() * Math.PI * 2
    });
  }
  return particles;
}

function updateStyleAttributes(particles, settings, changeType) {
    const colorPalette = getColorPalette(settings);
    const zoom = validateNum(settings.zoom, 0, 50, 10);
    const randomness = validateNum(settings.randomness, 0, 100, 60) / 100;
    const flutter = validateNum(settings.flutter, 0, 100, 50) / 50;

    return particles.map(p => {
        let updates = {};
        if (changeType === 'color' || !changeType) {
            if (!p.isEmoji && p.shapeType !== 'flag') updates.color = colorPalette.length > 0 ? colorPalette[Math.floor(Math.random() * colorPalette.length)] : null;
        }
        if (changeType === 'scale' || !changeType) {
            let sf = (zoom / 10) * (settings.randomizeSize ? (0.5 + Math.random()) : 1);
            updates.scale = Math.max(sf, 0.1);
        }
        if (changeType === 'rotation' || changeType === 'flutter' || !changeType) {
            updates.initialRotation = settings.randomizeRotation ? Math.random() * 360 : 0;
            updates.rotationSpeed = settings.randomizeRotation ? (Math.random() - 0.5) * 15 * randomness * flutter : 0;
            updates.flipSpeed = (0.1 + (Math.random() * 0.4 * randomness)) * flutter;
        }
        return Object.assign({}, p, updates);
    });
}

function getParticleStateForFrame(particle, frameIndex) {
    const t = frameIndex;
    const linearY = particle.startY + (particle.pixelsPerFrame * t);
    const driftOffset = Math.sin(particle.driftPhase + (particle.driftSpeed * t)) * particle.driftAmp;
    return Object.assign({}, particle, { x: particle.startX + driftOffset, y: linearY, rotation: particle.initialRotation + (particle.rotationSpeed * t), flipFactor: Math.cos(particle.flipPhase + (particle.flipSpeed * t)) });
}

// --- NODE CREATION ---
async function createFigmaShapeNode(p) {
  let node;
  if (p.isEmoji) {
      node = figma.createText();
      try { await figma.loadFontAsync({ family: "Inter", style: "Regular" }); node.fontName = { family: "Inter", style: "Regular" }; } catch (e) { await figma.loadFontAsync(figma.fonts[0]); node.fontName = figma.fonts[0]; }
      node.characters = p.shapeType; node.fontSize = p.baseHeight; node.textAlignHorizontal = 'CENTER'; node.textAlignVertical = 'CENTER'; node.resize(p.baseWidth, p.baseHeight);
  } else if (p.shapeType === 'flag' && p.flagSvg) {
      const imported = figma.createNodeFromSvg(p.flagSvg);
      node = imported;
      node.fills = []; 
      node.clipsContent = false;
      figma.currentPage.appendChild(node);
      setScaleConstraints(node);
      const ratio = node.width > 0 && node.height > 0 ? node.width / node.height : 1.5;
      node.setPluginData('aspectRatio', ratio.toString());
  } else if (p.shapeType === 'custom' && p.customPathData) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.customViewBox}"><path d="${p.customPathData}" fill="#D9D9D9" /></svg>`;
      const imported = figma.createNodeFromSvg(svg);
      if (imported.children.length > 0) { node = imported.children[0]; figma.currentPage.appendChild(node); imported.remove(); }
      else { imported.remove(); node = figma.createEllipse(); }
      node.resize(p.baseWidth, p.baseHeight);
      if ('strokes' in node) { node.strokes = []; }
  } else {
      switch (p.shapeType) {
        case 'rectangle': node = figma.createRectangle(); node.resize(p.baseWidth, p.baseHeight); node.cornerRadius = Math.min(p.baseWidth, p.baseHeight) * 0.1; break;
        case 'square': node = figma.createRectangle(); node.resize(p.baseWidth, p.baseHeight); node.cornerRadius = p.baseWidth * 0.1; break;
        case 'circle': node = figma.createEllipse(); node.resize(p.baseWidth, p.baseHeight); break;
        case 'star': node = figma.createStar(); node.resize(p.baseWidth, p.baseHeight); node.pointCount = 5; node.innerRadius = 0.4; break;
        case 'wave':
          const svg = `<svg viewBox="0 0 24 24"><path d="M16.625 18C17.6917 15.3333 16.7583 14.2667 13.825 14.8C11.1583 15.6 10.3583 14.6667 11.425 12C12.7583 9.33333 11.9583 8.4 9.025 9.2C6.09167 10 5.29167 8.93333 6.625 6" stroke="#D9D9D9" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
          const frame = figma.createNodeFromSvg(svg);
          if (frame.children.length > 0) { node = frame.children[0]; figma.currentPage.appendChild(node); frame.remove(); node.resize(p.baseWidth, p.baseHeight); }
          break;
        default: node = figma.createEllipse(); node.resize(p.baseWidth, p.baseHeight); break;
      }
  }
  return node;
}

async function populateFrameWithConfetti(frame, pList) {
  for (let i = 0; i < pList.length; i++) {
    const p = pList[i];
    const node = await createFigmaShapeNode(p);
    if (!node) continue;
    node.name = `Particle ${i+1}`;
    node.rotation = p.rotation;
    const flipScale = Math.max(0.01, Math.abs(p.flipFactor));

    if (p.shapeType === 'flag') {
        const aspectRatio = parseFloat(node.getPluginData('aspectRatio') || "1.5");
        const targetArea = 960; 
        const normH = Math.sqrt(targetArea / aspectRatio);
        const normW = normH * aspectRatio;
        node.resize(normW * p.scale, normH * p.scale * flipScale);
    } else {
        node.resize(p.baseWidth * p.scale, p.baseHeight * p.scale * flipScale);
    }

    if (p.isEmoji) node.fontSize = p.baseHeight * p.scale;
    if (!p.isEmoji && p.shapeType !== 'flag' && p.color) {
        let fill;
        if (p.color.type === 'linear') {
            let figmaType = 'GRADIENT_LINEAR';
            if (p.color.subtype === 'Radial') figmaType = 'GRADIENT_RADIAL';
            if (p.color.subtype === 'Angular') figmaType = 'GRADIENT_ANGULAR';
            if (p.color.subtype === 'Diamond') figmaType = 'GRADIENT_DIAMOND';

            const transform = (figmaType === 'GRADIENT_LINEAR') 
                ? (p.color.isVertical ? [[0, 1, 0], [-1, 0, 1]] : [[1, 0, 0], [0, 1, 0]])
                : [[0.5, 0, 0.5], [0, 0.5, 0.5]];

            fill = { type: figmaType, gradientStops: p.color.gradientStops, gradientTransform: transform };
        } else {
            fill = { type: 'SOLID', color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: p.color.a };
        }
        if (p.shapeType === 'wave') { if ('strokes' in node) { node.strokes = [fill]; node.strokeWeight = Math.max(1.5, 3 * p.scale); node.fills = []; } }
        else if ('fills' in node) node.fills = [fill];
    }
    node.x = p.x - (node.width / 2); node.y = p.y - (node.height / 2);
    frame.appendChild(node);
    if (i % 150 === 0) await new Promise(r => setTimeout(r, 5));
  }
}

async function createFinalConfettiOnCanvas(settings) {
  const fCount = validateNum(settings.frameCount, 1, 100, 20);
  const delay = validateNum(settings.frameDelay, 1, 5000, 75);
  const createdFrames = [];
  const pool = initializeParticlePool(settings, { width: 1440, height: 1080 });

  for (let i = 0; i < fCount; i++) {
    const outer = figma.createFrame(); outer.resize(1440, 1080); outer.x = i * 1640; outer.fills = []; outer.clipsContent = true;
    figma.currentPage.appendChild(outer); createdFrames.push(outer);
    const inner = figma.createFrame(); inner.resize(1440, 1080); inner.fills = []; inner.clipsContent = false;
    await populateFrameWithConfetti(inner, pool.map(p => getParticleStateForFrame(p, i))); outer.appendChild(inner);
    await new Promise(r => setTimeout(r, 20));
  }
  if (createdFrames.length > 0) figma.currentPage.flowStartingPoints = [...figma.currentPage.flowStartingPoints, { nodeId: createdFrames[0].id, name: "Start Confetti" }];
  for (let i = 0; i < createdFrames.length - 1; i++) {
    createdFrames[i].reactions = [{ trigger: { type: 'AFTER_TIMEOUT', timeout: 0.001 }, actions: [{ type: 'NODE', destinationId: createdFrames[i+1].id, navigation: 'NAVIGATE', transition: { type: 'SMART_ANIMATE', duration: delay / 1000, easing: { type: 'LINEAR' } } }] }];
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'preview-confetti') {
    if (msg.keepPositions && cachedParticles.length > 0) cachedParticles = updateStyleAttributes(cachedParticles, msg.settings, msg.changeType);
    else cachedParticles = initializeParticlePool(msg.settings, { width: 1440, height: 1080 }, true);
    figma.ui.postMessage({ type: 'preview-data', particles: cachedParticles.map(p => getParticleStateForFrame(p, 0)) });
  } else if (msg.type === 'generate-confetti') {
    await createFinalConfettiOnCanvas(msg.settings);
    figma.ui.postMessage({ type: 'generation-complete' });
  } else if (msg.type === 'close-plugin') figma.closePlugin();
};