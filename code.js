// code.js

// Increased width to accommodate settings + preview panel
figma.showUI(__html__, { width: 960, height: 700, themeColors: false });

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

// --- CORE DATA GENERATOR ---

/**
 * Generates the initial properties and calculates required physics for all particles.
 * The "Fall Speed" is now hardcoded to 30.
 */
function initializeParticlePool(settings, bounds) {
  const { width: boundsWidth, height: boundsHeight } = bounds;

  // Validate settings
  const randomness = validateNum(settings.randomness, 0, 100, 60) / 100; // 0-1 scale
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 0, 50, 10);
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;
  // Get total frames to calculate required speed over time
  // Enforce minimum of 1 frame
  const totalFrames = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  
  // CHANGED: Hardcode the speed setting to 30
  const speedSetting = 30;


  let shapesToUse =
    Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0
      ? settings.selectedShapes
      : ['rectangle', 'square', 'circle', 'star'];

  // Determine Color Palette
  let colorPalette = [];
  if (settings.colorData.isMultiColor) {
    colorPalette = [
      { r: 1, g: 0.2, b: 0.2, a: 1 },
      { r: 1, g: 0.6, b: 0, a: 1 },
      { r: 1, g: 0.9, b: 0, a: 1 },
      { r: 0.2, g: 0.8, b: 0.2, a: 1 },
      { r: 0.2, g: 0.6, b: 1, a: 1 },
      { r: 0.6, g: 0.2, b: 0.8, a: 1 },
    ];
  } else {
    colorPalette = settings.colorData.customColors.map((hsla) =>
      hslToRgba(hsla.h, hsla.s, hsla.l, hsla.a)
    );
    if (colorPalette.length === 0) {
      colorPalette = [{ r: 0.5, g: 0.5, b: 0.5, a: 1.0 }];
    }
  }

  // Calculate Count
  const baseDivider = 3000;
  const densityMultiplier = 0.1 + (amount / 100) * 2.9; 
  const currentArea = boundsWidth * boundsHeight;
  const count = Math.floor((currentArea / baseDivider) * densityMultiplier);

  const particles = [];

  // Generation Loop
  for (let i = 0; i < count; i++) {
    const shapeType = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    const colorBtn = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    // Base Size calc
    const baseReferenceSize = 20; 
    let baseWidth = baseReferenceSize;
    let baseHeight = baseReferenceSize;
    if (shapeType === 'rectangle') {
        baseWidth = baseReferenceSize * 1.5;
        baseHeight = baseReferenceSize * 0.9;
    }

    // Scale Factor
    let scaleFactor = zoom / 10;
    if (randomizeSize) {
      scaleFactor *= (0.5 + Math.random());
    }
    scaleFactor = Math.max(scaleFactor, 0.1);
    
    // Actual height on screen
    const actualHeight = baseHeight * scaleFactor;

    // --- PHYSICS INIT LOGIC (Distance based) ---
    
    // 1. X Position
    const estimatedFinalWidth = baseWidth * scaleFactor;
    const safeMaxX = Math.max(0, boundsWidth - estimatedFinalWidth);
    const xPos = Math.random() * safeMaxX;

    // 2. Y Positions (Start and End thresholds)
    const startBuffer = 50; 
    const verticalSpread = boundsHeight * 1.5;
    const randomYOffset = Math.random() * verticalSpread;

    // Start Y: negative height minus buffer minus random offset.
    const startY = -actualHeight - startBuffer - randomYOffset;
    
    // CHANGED: End Y target is now determined by the speed setting.
    // Speed 0 = target is bottom of frame. Speed 100 = target is 2x frame height below.
    const extraDistance = (speedSetting / 100) * boundsHeight * 2;
    const targetEndY = boundsHeight + extraDistance;

    // 3. Calculate Required Speed
    const totalDistanceToTravel = targetEndY - startY;
    
    // Calculate steps needed to get from frame 0 to frame N-1.
    const steps = Math.max(1, totalFrames - 1);
    
    // CHANGED: The speed per frame is now calculated to cover the total distance
    // over the exact number of steps.
    const basePixelsPerFrame = totalDistanceToTravel / steps;

    // Apply individual variance based on randomness slider (+/- 30% variance max)
    const individualVariance = 1 + ((Math.random() - 0.5) * 0.6 * randomness);
    
    // Final speed for this specific particle.
    const finalPixelsPerFrame = basePixelsPerFrame * individualVariance;


    // 4. Rotation properties
    const initialRotation = randomizeRotation ? Math.random() * 360 : 0;
    const rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness : 0;


    particles.push({
      // Immutable properties
      shapeType: shapeType,
      color: colorBtn,
      baseWidth: baseWidth,
      baseHeight: baseHeight,
      scale: scaleFactor,
      x: xPos, 
      // Physics properties pre-calculated
      startY: startY,
      pixelsPerFrame: finalPixelsPerFrame,
      initialRotation: initialRotation,
      rotationSpeed: rotationSpeed
    });
  }

  return particles;
}

/**
 * HELPER: Calculates a particle's exact state at a specific frame index (time).
 * Now much simpler as speed is pre-calculated.
 */
function getParticleStateForFrame(particle, frameIndex) {
    // Calculate current Y based on fixed start Y and constant speed over time
    const currentY = particle.startY + (particle.pixelsPerFrame * frameIndex);
    
    // Calculate current Rotation
    const currentRotation = particle.initialRotation + (particle.rotationSpeed * frameIndex);

    // Use Object.assign for compatibility
    return Object.assign({}, particle, {
        y: currentY,
        rotation: currentRotation
    });
}


// --- NODE CREATION HELPER (Generates actual Figma nodes) ---

function createFigmaShapeNode(type, width, height) {
  let node;
  switch (type) {
    case 'rectangle':
      node = figma.createRectangle();
      node.resize(width, height);
      node.cornerRadius = Math.min(width, height) * 0.1;
      break;
    case 'square':
      node = figma.createRectangle();
      node.resize(width, height);
      node.cornerRadius = width * 0.1;
      break;
    case 'circle':
      node = figma.createEllipse();
      node.resize(width, height);
      break;
    case 'star':
      node = figma.createStar();
      node.resize(width, height);
      node.pointCount = 5;
      node.innerRadius = 0.4;
      break;
  }
  return node;
}

// --- FRAME CREATION HELPER ---
function createBaseFrame(x_pos, name) {
  const frameWidth = 1440;
  const frameHeight = 1080; 
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(frameWidth, frameHeight);
  frame.x = x_pos; 
  // IMPORTANT: Clip content so particles above/below aren't visible
  frame.clipsContent = true; 
  frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  figma.currentPage.appendChild(frame);
  return frame;
}

// --- FRAME POPULATION HELPER ---
// Targets a specific frame (now used for the inner container)
async function populateFrameWithConfetti(frame, particleData) {
  let rectangleCount = 0;
  let squareCount = 0;
  let circleCount = 0;
  let starCount = 0;

  for (let i = 0; i < particleData.length; i++) {
    const p = particleData[i];
    let particleName = '';
    switch (p.shapeType) {
      case 'rectangle': rectangleCount++; particleName = `Rectangle${rectangleCount}`; break;
      case 'square': squareCount++; particleName = `Square${squareCount}`; break;
      case 'circle': circleCount++; particleName = `Eclipse${circleCount}`; break;
      case 'star': starCount++; particleName = `Star${starCount}`; break;
    }

    const node = createFigmaShapeNode(p.shapeType, p.baseWidth, p.baseHeight);
    if (!node) continue;

    node.name = particleName;
    node.x = p.x;
    node.y = p.y; // Y calculated per frame
    node.rescale(p.scale); 
    node.rotation = p.rotation; // Rotation calculated per frame
    node.fills = [{ type: 'SOLID', color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: p.color.a }];
    frame.appendChild(node);

    if (i % 200 === 0) await new Promise(r => setTimeout(r, 0));
  }
}


// --- FINAL OUTPUT GENERATOR (Creates Animated Sequence with Nested Frames) ---

async function createFinalConfettiOnCanvas(settings) {
  // 1. Validate Animation Settings
  const frameCount = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  const frameDelay = Math.max(1, validateNum(settings.frameDelay, 1, 5000, 50));

  const frameWidth = 1440;
  const frameHeight = 1080;
  const gap = 100;
  const createdOuterFrames = []; // Keep track of outer frames for prototyping

  figma.notify("Initializing physics pool...");
  await new Promise(r => setTimeout(r, 20));

  // 1. Initialize pool with distance-based physics
  // Use Object.assign instead of spread syntax for compatibility
  const settingsWithFrameCount = Object.assign({}, settings, { frameCount: frameCount });
  const masterParticlePool = initializeParticlePool(settingsWithFrameCount, { width: frameWidth, height: frameHeight });

  figma.notify(`Starting generation of ${frameCount} animated sequence frames...`);

  // 2. Frame Creation Loop (Simulation over time)
  // Loop from i = 0 up to (but not including) frameCount.
  for (let i = 0; i < frameCount; i++) {
    const xPos = i * (frameWidth + gap);
    // Naming adjustment for clarity
    let frameName = `Confetti Seq - Frame ${i + 1}`;
    if (i === 0) frameName += " (Start)";
    if (i === frameCount - 1) frameName += " (End)";

    // A. Create Outer Frame (The one with background and clipping)
    const outerFrame = createBaseFrame(xPos, frameName);
    createdOuterFrames.push(outerFrame);

    // B. Create Inner Container Frame
    const innerFrame = figma.createFrame();
    innerFrame.name = "Particle Container";
    innerFrame.resize(frameWidth, frameHeight);
    // Make transparent so outer frame background shows
    innerFrame.fills = []; 
    // Don't clip at this level, let the outer frame handle it
    innerFrame.clipsContent = false; 

    figma.notify(`Calculating Frame ${i + 1}/${frameCount}...`);
    
    // Calculate state for this specific time index `i`
    const particlesForThisFrame = masterParticlePool.map(p => 
        getParticleStateForFrame(p, i)
    );

    // C. Populate the INNER frame with particles
    await populateFrameWithConfetti(innerFrame, particlesForThisFrame);
    
    // D. Nest inner frame inside outer frame
    outerFrame.appendChild(innerFrame);

    await new Promise(r => setTimeout(r, 10));
  }


  // 3. Prototyping Interactions (Links Outer Frames)
  figma.notify("Setting up prototype interactions...");
  for (let i = 0; i < createdOuterFrames.length - 1; i++) {
    const currentFrame = createdOuterFrames[i];
    const nextFrame = createdOuterFrames[i + 1];

    currentFrame.reactions = [{
      trigger: {
        type: 'AFTER_TIMEOUT',
        timeout: frameDelay 
      },
      action: {
        type: 'NODE',
        destinationId: nextFrame.id,
        navigation: 'NAVIGATE',
        transition: {
          type: 'SMART_ANIMATE',
          duration: frameDelay / 1000, 
          easing: { type: 'LINEAR' }
        }
      }
    }];
  }

  figma.notify("Animated confetti sequence generated successfully!");
  figma.currentPage.selection = createdOuterFrames;
  figma.viewport.scrollAndZoomIntoView(createdOuterFrames);
}

// --- NEW FUNCTION: Create Single Empty Frame (Alternative action) ---
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
    // For preview, simulate a middle frame
    const simulatedTotalFrames = 20;
    const simulatedFrameIndex = 10; 
    
    // FIX: Use Object.assign for compatibility
    const settingsWithFrameCount = Object.assign({}, msg.settings, { frameCount: simulatedTotalFrames });
    const pool = initializeParticlePool(settingsWithFrameCount, previewBounds);
    
    // Get state for middle frame
    const previewData = pool.map(p => getParticleStateForFrame(p, simulatedFrameIndex));
    
    figma.ui.postMessage({ type: 'preview-data', particles: previewData });
  }
  else if (msg.type === 'generate-confetti') {
    await createFinalConfettiOnCanvas(msg.settings);
  }
  else if (msg.type === 'generate-empty-frame') {
    createEmptyConfettiFrame();
  }
  else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};