// code.js

figma.showUI(__html__, { width: 960, height: 800, themeColors: false });

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

// --- PALETTE GENERATOR ---
function getColorPalette(settings) {
    if (settings.shapeTab === 'emoji') return [];

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
                    return {
                        position: stop.percent / 100,
                        color: { r: rgb.r, g: rgb.g, b: rgb.b, a: stop.alpha }
                    };
                });
                return {
                    type: 'linear',
                    gradientStops: figmaStops,
                    isVertical: c.isVertical
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
function initializeParticlePool(settings, bounds) {
  const { width: boundsWidth, height: boundsHeight } = bounds;
  const randomness = validateNum(settings.randomness, 0, 100, 60) / 100; 
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 0, 50, 10);
  
  // NEW: Flutter setting (Default 50 maps to 1.0 multiplier)
  // 0 = No spin/flip, 100 = Double speed
  const flutter = validateNum(settings.flutter, 0, 100, 50) / 50; 

  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;
  const totalFrames = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  const speedSetting = 30; 

  let shapesToUse = [];
  const isEmojiMode = settings.shapeTab === 'emoji';

  if (isEmojiMode) {
      if (Array.isArray(settings.selectedEmojis) && settings.selectedEmojis.length > 0) {
          shapesToUse = settings.selectedEmojis;
      } else { shapesToUse = ['😀']; }
  } else {
      if (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) {
          shapesToUse = settings.selectedShapes;
      } else { 
          return []; 
      }
  }

  const colorPalette = getColorPalette(settings);
  const baseDivider = 3000;
  const densityMultiplier = 0.1 + (amount / 100) * 2.9; 
  const count = Math.floor((boundsWidth * boundsHeight / baseDivider) * densityMultiplier);
  const particles = [];

  for (let i = 0; i < count; i++) {
    const shapeIdentifier = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    
    let colorObj = null;
    if (!isEmojiMode && colorPalette.length > 0) {
         colorObj = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    }

    const baseReferenceSize = 20; 
    let baseWidth = baseReferenceSize;
    let baseHeight = baseReferenceSize;
    
    if (shapeIdentifier === 'rectangle') { baseWidth = baseReferenceSize * 1.5; baseHeight = baseReferenceSize * 0.9; }
    if (isEmojiMode || shapeIdentifier === 'custom') { baseWidth = baseReferenceSize * 1.2; baseHeight = baseReferenceSize * 1.2; }
    if (shapeIdentifier === 'wave') { baseWidth = baseReferenceSize * 1.0; baseHeight = baseReferenceSize * 1.4; }

    let scaleFactor = zoom / 10;
    if (randomizeSize) scaleFactor *= (0.5 + Math.random());
    scaleFactor = Math.max(scaleFactor, 0.1);
    const actualHeight = baseHeight * scaleFactor;

    const xPos = Math.random() * Math.max(0, boundsWidth - (baseWidth * scaleFactor));
    const startY = -actualHeight - 50 - (Math.random() * boundsHeight * 1.5);
    const targetEndY = boundsHeight + ((speedSetting / 100) * boundsHeight * 2);
    
    const steps = Math.max(1, totalFrames - 1);
    const finalPixelsPerFrame = ((targetEndY - startY) / steps) * (1 + ((Math.random() - 0.5) * 0.6 * randomness));

    const initialRotation = randomizeRotation ? Math.random() * 360 : 0;
    
    // UPDATED: rotationSpeed is now scaled by 'flutter'
    const rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness * flutter : 0;

    const driftAmp = 10 + (Math.random() * 80 * randomness); 
    const driftSpeed = 0.05 + (Math.random() * 0.15 * randomness);
    const driftPhase = Math.random() * Math.PI * 2;

    // UPDATED: flipSpeed is now scaled by 'flutter'
    const flipSpeed = (0.1 + (Math.random() * 0.4 * randomness)) * flutter;
    const flipPhase = Math.random() * Math.PI * 2;

    particles.push({
      isEmoji: isEmojiMode,
      shapeType: shapeIdentifier,
      customPathData: shapeIdentifier === 'custom' ? settings.customShapePath : null,
      color: colorObj,
      baseWidth: baseWidth,
      baseHeight: baseHeight,
      scale: scaleFactor,
      startX: xPos,
      startY: startY,
      pixelsPerFrame: finalPixelsPerFrame,
      initialRotation: initialRotation,
      rotationSpeed: rotationSpeed,
      driftAmp: driftAmp,
      driftSpeed: driftSpeed,
      driftPhase: driftPhase,
      flipSpeed: flipSpeed,
      flipPhase: flipPhase
    });
  }
  return particles;
}

function updateStyleAttributes(particles, settings, changeType) {
    const colorPalette = getColorPalette(settings);
    const zoom = validateNum(settings.zoom, 0, 50, 10);
    const randomizeSize = settings.randomizeSize === true;
    const randomizeRotation = settings.randomizeRotation === true;
    const randomness = validateNum(settings.randomness, 0, 100, 60) / 100;
    
    // NEW: Retrieve flutter multiplier for updates
    const flutter = validateNum(settings.flutter, 0, 100, 50) / 50;

    return particles.map(p => {
        let updates = {};
        if (changeType === 'color' || !changeType) {
            if (!p.isEmoji) {
                if (colorPalette.length > 0) {
                    updates.color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                } else {
                    updates.color = null; 
                }
            }
        }
        if (changeType === 'scale' || !changeType) {
            let scaleFactor = zoom / 10;
            if (randomizeSize) scaleFactor *= (0.5 + Math.random());
            updates.scale = Math.max(scaleFactor, 0.1);
        }
        
        // UPDATED: Recalculate speeds if Rotation OR Flutter (changeType) changes
        // We'll treat 'rotation' changeType as covering 'flutter' updates too
        if (changeType === 'rotation' || changeType === 'flutter' || !changeType) {
            updates.initialRotation = randomizeRotation ? Math.random() * 360 : 0;
            
            // Apply new flutter multiplier to both speeds
            updates.rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness * flutter : 0;
            updates.flipSpeed = (0.1 + (Math.random() * 0.4 * randomness)) * flutter;
            
            updates.driftAmp = 10 + (Math.random() * 80 * randomness);
        }
        return Object.assign({}, p, updates);
    });
}

function getParticleStateForFrame(particle, frameIndex) {
    const t = frameIndex;
    const linearY = particle.startY + (particle.pixelsPerFrame * t);
    
    // 1. DRIFT
    const driftOffset = Math.sin(particle.driftPhase + (particle.driftSpeed * t)) * particle.driftAmp;
    
    // 2. FLIP (Using Cosine of flipPhase + (speed * t))
    const flipFactor = Math.cos(particle.flipPhase + (particle.flipSpeed * t));

    return Object.assign({}, particle, {
        x: particle.startX + driftOffset, 
        y: linearY,
        rotation: particle.initialRotation + (particle.rotationSpeed * t),
        flipFactor: flipFactor 
    });
}

// --- NODE CREATION ---
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
          const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><path d="${customPathData}" fill="#D9D9D9" /></svg>`;
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
          const svg = `<svg viewBox="0 0 24 24"><path d="${wavePath}" stroke="#D9D9D9" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
          const frame = figma.createNodeFromSvg(svg);
          if (frame.children.length > 0) {
              node = frame.children[0];
              figma.currentPage.appendChild(node);
              frame.remove();
              node.resize(baseWidth, baseHeight);
          }
          break;
        default: node = figma.createEllipse(); node.resize(baseWidth, baseHeight); break;
      }
  }
  return node;
}

function createBaseFrame(x_pos, name) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(1440, 1080);
  frame.x = x_pos; 
  frame.clipsContent = true; 
  frame.fills = []; // Transparent background
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

    // --- APPLY 3D FLIP SIMULATION ---
    const flipScale = Math.max(0.01, Math.abs(p.flipFactor));

    if (p.isEmoji) {
        const finalW = p.baseWidth * p.scale;
        const finalH = p.baseHeight * p.scale * flipScale;
        node.resize(finalW, finalH);
        node.fontSize = p.baseHeight * p.scale; 
    } else {
        const finalW = p.baseWidth * p.scale;
        const finalH = p.baseHeight * p.scale * flipScale;
        node.resize(finalW, finalH);
    }
      
    if (!p.isEmoji && p.color) {
        // Construct Fill Object
        let newFill;
        if (p.color.type === 'linear') {
            const matrix = p.color.isVertical 
                ? [[0, 1, 0], [-1, 0, 1]] 
                : [[1, 0, 0], [0, 1, 0]]; 
            
            newFill = {
                type: 'GRADIENT_LINEAR',
                gradientStops: p.color.gradientStops,
                gradientTransform: matrix
            };
        } else {
            newFill = { 
                type: 'SOLID', 
                color: { r: p.color.r, g: p.color.g, b: p.color.b }, 
                opacity: p.color.a 
            };
        }

        if (p.shapeType === 'wave') {
             if ('strokes' in node) {
                 node.strokes = [newFill];
                 const weight = Math.max(1.5, 3 * p.scale); 
                 node.strokeWeight = weight;
                 node.fills = [];
             }
        } else {
            if ('fills' in node) {
                node.fills = [newFill];
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
    const frameName = `Confetti Seq - Frame ${i + 1}`;
    
    const outerFrame = createBaseFrame(xPos, frameName);
    createdOuterFrames.push(outerFrame);

    const innerFrame = figma.createFrame();
    innerFrame.name = "Particle Container";
    innerFrame.resize(frameWidth, frameHeight);
    innerFrame.fills = []; 
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

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'preview-confetti') {
    const previewBounds = { width: 1440, height: 1080 };
    if (msg.keepPositions && cachedParticles.length > 0) {
        cachedParticles = updateStyleAttributes(cachedParticles, msg.settings, msg.changeType);
    } else {
        const settingsWithFrameCount = Object.assign({}, msg.settings, { frameCount: 20 });
        cachedParticles = initializeParticlePool(settingsWithFrameCount, previewBounds);
    }
    const previewData = cachedParticles.map(p => getParticleStateForFrame(p, 10));
    figma.ui.postMessage({ type: 'preview-data', particles: previewData });
  }
  else if (msg.type === 'generate-confetti') {
    try { await createFinalConfettiOnCanvas(msg.settings); } catch (e) { figma.notify("Error: " + e.message, { error: true }); }
  }
  else if (msg.type === 'generate-empty-frame') { createEmptyConfettiFrame(); }
  else if (msg.type === 'close-plugin') { figma.closePlugin(); }
};