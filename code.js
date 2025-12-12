// code.js

// Increased width/height to accommodate new overlays and settings
figma.showUI(__html__, { width: 960, height: 800, themeColors: false });

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

function initializeParticlePool(settings, bounds) {
  const { width: boundsWidth, height: boundsHeight } = bounds;

  // Validate settings
  const randomness = validateNum(settings.randomness, 0, 100, 60) / 100; // 0-1 scale
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 0, 50, 10);
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;
  const totalFrames = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  const speedSetting = 30; // Hardcoded speed

  // Determine Shapes to use
  let shapesToUse = [];
  
  const isEmojiMode = settings.shapeTab === 'emoji';
  if (isEmojiMode && settings.selectedEmoji) {
      shapesToUse = [settings.selectedEmoji]; // Use the single selected emoji char
  } else if (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) {
      shapesToUse = settings.selectedShapes;
  } else {
      // Fallback
      shapesToUse = ['rectangle', 'circle', 'star'];
  }


  // Determine Color Palette (Only if NOT in emoji mode)
  let colorPalette = [];
  if (!isEmojiMode) {
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
  }

  // Calculate Count
  const baseDivider = 3000;
  const densityMultiplier = 0.1 + (amount / 100) * 2.9; 
  const currentArea = boundsWidth * boundsHeight;
  const count = Math.floor((currentArea / baseDivider) * densityMultiplier);

  const particles = [];

  // Generation Loop
  for (let i = 0; i < count; i++) {
    // Select shape identifier (either shape name like 'rectangle' or emoji char like '😀')
    const shapeIdentifier = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    
    // Select color only if not in emoji mode
    let colorBtn = null;
    if (!isEmojiMode && colorPalette.length > 0) {
         colorBtn = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    }


    // Base Size calc
    const baseReferenceSize = 20; 
    let baseWidth = baseReferenceSize;
    let baseHeight = baseReferenceSize;
    
    // Adjust aspect ratio for specific standard shapes
    if (shapeIdentifier === 'rectangle') {
        baseWidth = baseReferenceSize * 1.5;
        baseHeight = baseReferenceSize * 0.9;
    }
    // NEW: Emojis and Custom shapes tend to be square-ish bases
    if (isEmojiMode || shapeIdentifier === 'custom') {
         baseWidth = baseReferenceSize * 1.2;
         baseHeight = baseReferenceSize * 1.2;
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

    // 2. Y Positions
    const startBuffer = 50; 
    const verticalSpread = boundsHeight * 1.5;
    const randomYOffset = Math.random() * verticalSpread;
    const startY = -actualHeight - startBuffer - randomYOffset;
    
    const extraDistance = (speedSetting / 100) * boundsHeight * 2;
    const targetEndY = boundsHeight + extraDistance;

    // 3. Calculate Required Speed
    const totalDistanceToTravel = targetEndY - startY;
    const steps = Math.max(1, totalFrames - 1);
    const basePixelsPerFrame = totalDistanceToTravel / steps;
    const individualVariance = 1 + ((Math.random() - 0.5) * 0.6 * randomness);
    const finalPixelsPerFrame = basePixelsPerFrame * individualVariance;


    // 4. Rotation properties
    const initialRotation = randomizeRotation ? Math.random() * 360 : 0;
    const rotationSpeed = randomizeRotation ? (Math.random() - 0.5) * 15 * randomness : 0;


    particles.push({
      isEmoji: isEmojiMode,
      // shapeType will store either the shape name string, the emoji char string, or 'custom'
      shapeType: shapeIdentifier,
      // NEW: Store custom path data if applicable
      customPathData: shapeIdentifier === 'custom' ? settings.customShapePath : null,
      color: colorBtn, // Will be null for emojis
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


function getParticleStateForFrame(particle, frameIndex) {
    const currentY = particle.startY + (particle.pixelsPerFrame * frameIndex);
    const currentRotation = particle.initialRotation + (particle.rotationSpeed * frameIndex);
    return Object.assign({}, particle, {
        y: currentY,
        rotation: currentRotation
    });
}


// --- NODE CREATION HELPER (Generates actual Figma nodes) ---

// CHANGED: Now handles standard shapes, emojis, and custom vector paths
async function createFigmaShapeNode(particleData) {
  const { shapeType, isEmoji, baseWidth, baseHeight, customPathData } = particleData;
  let node;

  // NEW: Handle Emoji (Text Node)
  if (isEmoji) {
      node = figma.createText();
      // Need to load a font that supports emojis. Inter works well generally.
      // Adding a fallback in case Inter isn't available, though it usually is.
      try {
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
          node.fontName = { family: "Inter", style: "Regular" };
      } catch (e) {
          // Fallback to default font if Inter fails
          await figma.loadFontAsync(figma.fonts[0]);
          node.fontName = figma.fonts[0];
      }
      
      node.characters = shapeType; // shapeType holds the emoji char
      node.fontSize = baseHeight; // Use height as font size base
      // Center text within its bounding box
      node.textAlignHorizontal = 'CENTER';
      node.textAlignVertical = 'CENTER';
      // Resize frame to fit text tightly
      node.resize(baseWidth, baseHeight);
  } 
  // NEW: Handle Custom Shape (Vector Node from SVG path)
  else if (shapeType === 'custom' && customPathData) {
      // Create a vector node from the SVG path string
      node = figma.createVector(customPathData);
      // Resize to the base dimensions. Figma will stretch the path.
      node.resize(baseWidth, baseHeight);
  }
  // Handle Standard Shapes
  else {
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
        // Fallback for safety
        default: 
           node = figma.createEllipse();
           node.resize(baseWidth, baseHeight);
           break;
      }
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
  frame.clipsContent = true; 
  frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  figma.currentPage.appendChild(frame);
  return frame;
}

// --- FRAME POPULATION HELPER ---
async function populateFrameWithConfetti(frame, particleDataList) {
  let shapeCounter = 0;

  for (let i = 0; i < particleDataList.length; i++) {
    const p = particleDataList[i];
    shapeCounter++;
    
    // Create the specific node type (async now due to font loading)
    const node = await createFigmaShapeNode(p);
    if (!node) continue;

    node.name = `Particle ${shapeCounter}`;
    
    // Emojis don't get rotated in this implementation to keep them upright
    if (!p.isEmoji) {
        node.rotation = p.rotation; 
    }

    // Apply scale. For text, this scales fontSize. For shapes, it resizes.
    // We need to handle text scaling differently to ensure it scales around center.
    if (p.isEmoji) {
        // Simple resizing for text node wrapper
        const newSize = p.baseHeight * p.scale;
        node.fontSize = newSize;
        node.resize(newSize, newSize);
    } else {
        node.rescale(p.scale);
    }
     
    // Apply Color only if not an emoji
    if (!p.isEmoji && p.color) {
        node.fills = [{ type: 'SOLID', color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: p.color.a }];
    }

    // Ensure center anchor for scaling/rotation effect by offsetting position
    // Note: Figma rotates around top-left by default.
    if (!p.isEmoji) {
        const width = node.width;
        const height = node.height;
        // Offset x/y by half width/height so (p.x, p.y) is the center
        node.x = p.x - (width / 2);
        node.y = p.y - (height / 2);
    } else {
         // For emojis, simpler centering is enough due to text alignment
         node.x = p.x - (node.width / 2);
         // Small vertical adjustment for text baseline
         node.y = p.y - (node.height / 2) + (node.height * 0.1);
    }


    frame.appendChild(node);

    // Yield to main thread periodically to prevent freezing
    if (i % 150 === 0) await new Promise(r => setTimeout(r, 5));
  }
}


// --- FINAL OUTPUT GENERATOR ---

async function createFinalConfettiOnCanvas(settings) {
  const frameCount = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  const frameDelay = Math.max(1, validateNum(settings.frameDelay, 1, 5000, 50));

  const frameWidth = 1440;
  const frameHeight = 1080;
  const gap = 200; // Increased gap
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
    innerFrame.fills = []; 
    innerFrame.clipsContent = false; 

    figma.notify(`Calculating Frame ${i + 1}/${frameCount}...`);
    
    const particlesForThisFrame = masterParticlePool.map(p => 
        getParticleStateForFrame(p, i)
    );

    // Async population now
    await populateFrameWithConfetti(innerFrame, particlesForThisFrame);
    
    outerFrame.appendChild(innerFrame);

    await new Promise(r => setTimeout(r, 20));
  }


  // 3. Prototyping Interactions
  figma.notify("Setting up prototype interactions...");
  for (let i = 0; i < createdOuterFrames.length - 1; i++) {
    const currentFrame = createdOuterFrames[i];
    const nextFrame = createdOuterFrames[i + 1];

    // --- FIX: Updated 'action' to 'actions' array as per Figma API requirement ---
    currentFrame.reactions = [{
      trigger: {
        type: 'AFTER_TIMEOUT',
        timeout: frameDelay 
      },
      actions: [{
        type: 'NODE',
        destinationId: nextFrame.id,
        navigation: 'NAVIGATE',
        transition: {
          type: 'SMART_ANIMATE',
          duration: frameDelay / 1000, 
          easing: { type: 'LINEAR' }
        }
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
    
    const settingsWithFrameCount = Object.assign({}, msg.settings, { frameCount: simulatedTotalFrames });
    const pool = initializeParticlePool(settingsWithFrameCount, previewBounds);
    
    const previewData = pool.map(p => getParticleStateForFrame(p, simulatedFrameIndex));
    
    figma.ui.postMessage({ type: 'preview-data', particles: previewData });
  }
  else if (msg.type === 'generate-confetti') {
    // Wrap in try/catch for font loading errors or other async issues
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