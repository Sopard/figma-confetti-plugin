// code.js

// Set UI dimensions
figma.showUI(__html__, { width: 960, height: 800, themeColors: false });

// --- GLOBAL CACHE FOR PREVIEW ---
let cachedParticles = [];

// --- HELPER FUNCTIONS ---

function validateNum(val, min, max, def) {
  const num = parseFloat(val);
  if (isNaN(num) || num < min || num > max) return def;
  return num;
}

// Helper to convert HSL to Figma RGBA format (returns floats 0-1)
function hslToRgba(h, s, l, a) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a_hsl = s * Math.min(l, 1 - l);
  const f = (n) => l - a_hsl * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return {
    r: f(0),
    g: f(8),
    b: f(4),
    a: a !== undefined ? a : 1.0,
  };
}

// --- COLOR PALETTE GENERATOR ---
function getColorPalette(settings) {
    if (settings.shapeTab === 'emoji') return [];

    if (settings.colorData.isMultiColor) {
        return [
          { r: 1, g: 0.2, b: 0.2, a: 1 },
          { r: 1, g: 0.6, b: 0, a: 1 },
          { r: 1, g: 0.9, b: 0, a: 1 },
          { r: 0.2, g: 0.8, b: 0.2, a: 1 },
          { r: 0.2, g: 0.6, b: 1, a: 1 },
          { r: 0.6, g: 0.2, b: 0.8, a: 1 },
        ];
    } else {
        const palette = settings.colorData.customColors.map((hsla) =>
          hslToRgba(hsla.h, hsla.s, hsla.l, hsla.a)
        );
        if (palette.length === 0) {
          return [{ r: 0.5, g: 0.5, b: 0.5, a: 1.0 }];
        }
        return palette;
    }
}

// --- CORE DATA GENERATOR (Creates Geometry & Physics) ---

function initializeParticlePool(settings, bounds) {
  const { width: boundsWidth, height: boundsHeight } = bounds;

  const randomness = validateNum(settings.randomness, 0, 100, 60) / 100; 
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 0, 50, 10);
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;
  const totalFrames = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  const speedSetting = 30; 

  let shapesToUse = [];
  const isEmojiMode = settings.shapeTab === 'emoji';

  if (isEmojiMode) {
      if (Array.isArray(settings.selectedEmojis) && settings.selectedEmojis.length > 0) {
          shapesToUse = settings.selectedEmojis;
      } else {
          shapesToUse = ['😀']; 
      }
  } else if (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) {
      shapesToUse = settings.selectedShapes;
  } else {
      shapesToUse = ['rectangle', 'circle', 'star'];
  }

  const colorPalette = getColorPalette(settings);

  const baseDivider = 3000;
  const densityMultiplier = 0.1 + (amount / 100) * 2.9; 
  const currentArea = boundsWidth * boundsHeight;
  const count = Math.floor((currentArea / baseDivider) * densityMultiplier);

  const particles = [];

  for (let i = 0; i < count; i++) {
    const shapeIdentifier = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    
    let colorBtn = null;
    if (!isEmojiMode && colorPalette.length > 0) {
         colorBtn = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    }

    const baseReferenceSize = 20; 
    let baseWidth = baseReferenceSize;
    let baseHeight = baseReferenceSize;
    
    if (shapeIdentifier === 'rectangle') {
        baseWidth = baseReferenceSize * 1.5;
        baseHeight = baseReferenceSize * 0.9;
    }
    if (isEmojiMode || shapeIdentifier === 'custom') {
         baseWidth = baseReferenceSize * 1.2;
         baseHeight = baseReferenceSize * 1.2;
    }
    if (shapeIdentifier === 'wave') {
         baseWidth = baseReferenceSize * 1.0;
         baseHeight = baseReferenceSize * 1.4;
    }

    let scaleFactor = zoom / 10;
    if (randomizeSize) {
      scaleFactor *= (0.5 + Math.random());
    }
    scaleFactor = Math.max(scaleFactor, 0.1);
    const actualHeight = baseHeight * scaleFactor;

    const estimatedFinalWidth = baseWidth * scaleFactor;
    const safeMaxX = Math.max(0, boundsWidth - estimatedFinalWidth);
    const xPos = Math.random() * safeMaxX;

    const startBuffer = 50; 
    const verticalSpread = boundsHeight * 1.5;
    const randomYOffset = Math.random() * verticalSpread;
    const startY = -actualHeight - startBuffer - randomYOffset;
    
    const extraDistance = (speedSetting / 100) * boundsHeight * 2;
    const targetEndY = boundsHeight + extraDistance;

    const totalDistanceToTravel = targetEndY - startY;
    const steps = Math.max(1, totalFrames - 1);
    const basePixelsPerFrame = totalDistanceToTravel / steps;
    const individualVariance = 1 + ((Math.random() - 0.5) * 0.6 * randomness);
    const finalPixelsPerFrame = basePixelsPerFrame * individualVariance;

    const initialRotation = randomizeRotation ? Math.random() * 360 : 0;
    const rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness : 0;

    particles.push({
      isEmoji: isEmojiMode,
      shapeType: shapeIdentifier,
      customPathData: shapeIdentifier === 'custom' ? settings.customShapePath : null,
      color: colorBtn,
      baseWidth: baseWidth,
      baseHeight: baseHeight,
      scale: scaleFactor,
      x: xPos, 
      startY: startY,
      pixelsPerFrame: finalPixelsPerFrame,
      initialRotation: initialRotation,
      rotationSpeed: rotationSpeed
    });
  }

  return particles;
}

// --- STYLE UPDATE HELPER ---
function updateStyleAttributes(particles, settings, changeType) {
    const colorPalette = getColorPalette(settings);
    const zoom = validateNum(settings.zoom, 0, 50, 10);
    const randomizeSize = settings.randomizeSize === true;
    const randomizeRotation = settings.randomizeRotation === true;
    const randomness = validateNum(settings.randomness, 0, 100, 60) / 100;

    return particles.map(p => {
        let updates = {};

        // 1. UPDATE COLOR
        if (changeType === 'color' || !changeType) {
            if (!p.isEmoji && colorPalette.length > 0) {
                 updates.color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            }
        }

        // 2. UPDATE SCALE
        if (changeType === 'scale' || !changeType) {
            let scaleFactor = zoom / 10;
            if (randomizeSize) {
                 scaleFactor *= (0.5 + Math.random());
            }
            updates.scale = Math.max(scaleFactor, 0.1);
        }

        // 3. UPDATE ROTATION
        if (changeType === 'rotation' || !changeType) {
            updates.initialRotation = randomizeRotation ? Math.random() * 360 : 0;
            updates.rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness : 0;
        }

        return Object.assign({}, p, updates);
    });
}

function getParticleStateForFrame(particle, frameIndex) {
    const currentY = particle.startY + (particle.pixelsPerFrame * frameIndex);
    const currentRotation = particle.initialRotation + (particle.rotationSpeed * frameIndex);
    return Object.assign({}, particle, {
        y: currentY,
        rotation: currentRotation
    });
}


// --- NODE CREATION & FRAME GENERATION ---

async function createFigmaShapeNode(particleData) {
  const { shapeType, isEmoji, baseWidth, baseHeight, customPathData } = particleData;
  let node;

  if (isEmoji) {
      node = figma.createText();
      try {
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
          node.fontName = { family: "Inter", style: "Regular" };
      } catch (e) {
          await figma.loadFontAsync(figma.fonts[0]);
          node.fontName = figma.fonts[0];
      }
      node.characters = shapeType;
      node.fontSize = baseHeight;
      node.textAlignHorizontal = 'CENTER';
      node.textAlignVertical = 'CENTER';
      node.resize(baseWidth, baseHeight);
  } else if (shapeType === 'custom') {
      if (customPathData) {
          const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><path d="${customPathData}" /></svg>`;
          const importedFrame = figma.createNodeFromSvg(svgString);
          if (importedFrame.children.length > 0) {
              node = importedFrame.children[0];
              figma.currentPage.appendChild(node);
              importedFrame.remove();
          } else {
              importedFrame.remove();
              node = figma.createEllipse();
          }
          node.resize(baseWidth, baseHeight);
          if ('strokes' in node) { node.strokes = []; }
      } else {
          node = figma.createEllipse();
          node.resize(baseWidth, baseHeight);
      }
  } else {
      switch (shapeType) {
        case 'rectangle':
          node = figma.createRectangle();
          node.resize(baseWidth, baseHeight);
          node.cornerRadius = Math.min(baseWidth, baseHeight) * 0.1;
          break;
        case 'square':
          node = figma.createRectangle();
          node.resize(baseWidth, baseHeight);
          node.cornerRadius = baseWidth * 0.1;
          break;
        case 'circle':
          node = figma.createEllipse();
          node.resize(baseWidth, baseHeight);
          break;
        case 'star':
          node = figma.createStar();
          node.resize(baseWidth, baseHeight);
          node.pointCount = 5;
          node.innerRadius = 0.4;
          break;
        case 'wave':
          const wavePath = "M16.625 18C17.6917 15.3333 16.7583 14.2667 13.825 14.8C11.1583 15.6 10.3583 14.6667 11.425 12C12.7583 9.33333 11.9583 8.4 9.025 9.2C6.09167 10 5.29167 8.93333 6.625 6";
          const svg = `<svg viewBox="0 0 24 24"><path d="${wavePath}" stroke="black" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
          const frame = figma.createNodeFromSvg(svg);
          if (frame.children.length > 0) {
              node = frame.children[0];
              figma.currentPage.appendChild(node);
              frame.remove();
              node.resize(baseWidth, baseHeight);
          }
          break;
        default: break;
      }
  }

  if (!node) {
      node = figma.createEllipse();
      node.resize(baseWidth, baseHeight);
  }
  return node;
}

// CHANGED: Removed solid fill, now uses empty array for transparency
function createBaseFrame(x_pos, name) {
  const frameWidth = 1440;
  const frameHeight = 1080; 
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(frameWidth, frameHeight);
  frame.x = x_pos; 
  frame.clipsContent = true; 
  // Transparent background
  frame.fills = []; 
  figma.currentPage.appendChild(frame);
  return frame;
}

async function populateFrameWithConfetti(frame, particleDataList) {
  let shapeCounter = 0;
  for (let i = 0; i < particleDataList.length; i++) {
    const p = particleDataList[i];
    shapeCounter++;
    
    const node = await createFigmaShapeNode(p);
    if (!node) continue; 

    node.name = `Particle ${shapeCounter}`;
    if (!p.isEmoji) { node.rotation = p.rotation; }

    if (p.isEmoji) {
        const newSize = p.baseHeight * p.scale;
        node.fontSize = newSize;
        node.resize(newSize, newSize);
    } else {
        node.rescale(p.scale);
    }
      
    if (!p.isEmoji && p.color) {
        if (p.shapeType === 'wave') {
             if ('strokes' in node) {
                 node.strokes = [{ type: 'SOLID', color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: p.color.a }];
                 const weight = Math.max(1.5, 3 * p.scale); 
                 node.strokeWeight = weight;
                 node.fills = [];
             }
        } else {
            if ('fills' in node) {
                node.fills = [{ type: 'SOLID', color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: p.color.a }];
            }
        }
    }

    if (!p.isEmoji) {
        const width = node.width;
        const height = node.height;
        node.x = p.x - (width / 2);
        node.y = p.y - (height / 2);
    } else {
         node.x = p.x - (node.width / 2);
         node.y = p.y - (node.height / 2) + (node.height * 0.1);
    }

    frame.appendChild(node);
    if (i % 150 === 0) await new Promise(r => setTimeout(r, 5));
  }
}

async function createFinalConfettiOnCanvas(settings) {
  const frameCount = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  const animationDelayMs = Math.max(1, validateNum(settings.frameDelay, 1, 5000, 75));
  const frameWidth = 1440;
  const frameHeight = 1080;
  const gap = 200; 
  const createdOuterFrames = [];

  figma.notify("Initializing physics pool...");
  await new Promise(r => setTimeout(r, 20));

  const settingsWithFrameCount = Object.assign({}, settings, { frameCount: frameCount });
  const masterParticlePool = initializeParticlePool(settingsWithFrameCount, { width: frameWidth, height: frameHeight });

  figma.notify(`Starting generation of ${frameCount} animated sequence frames...`);

  for (let i = 0; i < frameCount; i++) {
    const xPos = i * (frameWidth + gap);
    let frameName = `Confetti Seq - Frame ${i + 1}`;
    if (i === 0) frameName += " (Start)";
    if (i === frameCount - 1) frameName += " (End)";

    const outerFrame = createBaseFrame(xPos, frameName);
    createdOuterFrames.push(outerFrame);

    const innerFrame = figma.createFrame();
    innerFrame.name = "Particle Container";
    innerFrame.resize(frameWidth, frameHeight);
    innerFrame.fills = []; // Inner frame is already transparent
    innerFrame.clipsContent = false; 

    figma.notify(`Calculating Frame ${i + 1}/${frameCount}...`);
    
    const particlesForThisFrame = masterParticlePool.map(p => getParticleStateForFrame(p, i));
    await populateFrameWithConfetti(innerFrame, particlesForThisFrame);
    outerFrame.appendChild(innerFrame);
    await new Promise(r => setTimeout(r, 20));
  }

  if (createdOuterFrames.length > 0) {
      const startFrame = createdOuterFrames[0];
      const existingFlows = figma.currentPage.flowStartingPoints;
      const newFlows = [...existingFlows, { nodeId: startFrame.id, name: "Start Confetti" }];
      figma.currentPage.flowStartingPoints = newFlows;
  }

  figma.notify("Setting up prototype interactions...");
  for (let i = 0; i < createdOuterFrames.length - 1; i++) {
    const currentFrame = createdOuterFrames[i];
    const nextFrame = createdOuterFrames[i + 1];
    currentFrame.reactions = [{
      trigger: { type: 'AFTER_TIMEOUT', timeout: 0.001 },
      actions: [{
        type: 'NODE',
        destinationId: nextFrame.id,
        navigation: 'NAVIGATE',
        transition: { type: 'SMART_ANIMATE', duration: animationDelayMs / 1000, easing: { type: 'LINEAR' } }
      }]
    }];
  }

  figma.notify("Animated confetti sequence generated successfully!");
  figma.currentPage.selection = createdOuterFrames;
  figma.viewport.scrollAndZoomIntoView(createdOuterFrames);
}

function createEmptyConfettiFrame() {
  const frame = createBaseFrame(0, 'Confetti Frame (Empty)');
  figma.notify("Empty confetti frame created.");
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
}

// --- MAIN MESSAGE ROUTER ---

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'preview-confetti') {
    const previewBounds = { width: 1440, height: 1080 };
    const simulatedTotalFrames = 20;
    const simulatedFrameIndex = 10; 
    
    if (msg.keepPositions && cachedParticles.length > 0) {
        cachedParticles = updateStyleAttributes(cachedParticles, msg.settings, msg.changeType);
    } else {
        const settingsWithFrameCount = Object.assign({}, msg.settings, { frameCount: simulatedTotalFrames });
        cachedParticles = initializeParticlePool(settingsWithFrameCount, previewBounds);
    }

    const previewData = cachedParticles.map(p => getParticleStateForFrame(p, simulatedFrameIndex));
    figma.ui.postMessage({ type: 'preview-data', particles: previewData });
  }
  else if (msg.type === 'generate-confetti') {
    try {
        await createFinalConfettiOnCanvas(msg.settings);
    } catch (e) {
        figma.notify("Error generating: " + e.message, { error: true });
        console.error(e);
    }
  }
  else if (msg.type === 'generate-empty-frame') {
    createEmptyConfettiFrame();
  }
  else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};