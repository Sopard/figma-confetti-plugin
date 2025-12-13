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

async function createFigmaShapeNode(particleData) {
  const { shapeType, isEmoji, baseWidth, baseHeight, customPathData } = particleData;
  let node;

  // Handle Emoji (Text Node)
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
  } 
  // CRITICAL FIX: Handle Custom Shape correctly using createNodeFromSvg
  else if (shapeType === 'custom') {
      if (customPathData) {
          // 1. Wrap the path data in a minimal SVG structure based on UI editor size (320x320)
          const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><path d="${customPathData}" /></svg>`;
          
          // 2. Use the correct API to import SVG data. This returns a FrameNode.
          const importedFrame = figma.createNodeFromSvg(svgString);
          
          // 3. Extract the vector node from inside the imported frame
          if (importedFrame.children.length > 0) {
              node = importedFrame.children[0];
              // Move the node out of the temporary frame onto the current page temporarily
              figma.currentPage.appendChild(node);
              // Remove the temporary container frame
              importedFrame.remove();
          } else {
              // Fallback if SVG import resulted in an empty frame for some reason
              importedFrame.remove();
              node = figma.createEllipse();
          }

          // 4. Resize to target dimensions
          node.resize(baseWidth, baseHeight);
          // Ensure no strokes from the import process
          if ('strokes' in node) { node.strokes = []; }

      } else {
          // Fallback if "custom" selected but no path data exists
          node = figma.createEllipse();
          node.resize(baseWidth, baseHeight);
      }
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
        default: 
           // Fallback handled by main if check below
           break;
      }
  }

  // Final safety check: if node wasn't created (e.g. unknown shapeType), create a default
  if (!node) {
      node = figma.createEllipse();
      node.resize(baseWidth, baseHeight);
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
    
    // Create the specific node type (async now due to font loading & svg import)
    const node = await createFigmaShapeNode(p);
    // Safety check if node creation failed completely
    if (!node) continue; 

    node.name = `Particle ${shapeCounter}`;
    
    // Emojis don't get rotated in this implementation to keep them upright
    if (!p.isEmoji) {
        node.rotation = p.rotation; 
    }

    // Apply scale.
    if (p.isEmoji) {
        const newSize = p.baseHeight * p.scale;
        node.fontSize = newSize;
        node.resize(newSize, newSize);
    } else {
        node.rescale(p.scale);
    }
     
    // Apply Color only if not an emoji
    if (!p.isEmoji && p.color) {
        // Ensure the node supports fills (VectorNodes do)
        if ('fills' in node) {
            node.fills = [{ type: 'SOLID', color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: p.color.a }];
        }
    }

    // Ensure center anchor for scaling/rotation effect
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

    // Yield to main thread periodically
    if (i % 150 === 0) await new Promise(r => setTimeout(r, 5));
  }
}


// --- FINAL OUTPUT GENERATOR ---

async function createFinalConfettiOnCanvas(settings) {
  const frameCount = Math.max(1, validateNum(settings.frameCount, 1, 100, 10));
  
  // Get the animation delay from settings (default 75ms if invalid)
  const animationDelayMs = Math.max(1, validateNum(settings.frameDelay, 1, 5000, 75));

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


  // --- NEW FIX: Set Flow Starting Point on Current Page ---
  if (createdOuterFrames.length > 0) {
      const startFrame = createdOuterFrames[0];
      // Flow starting points must be set on the PAGE, not the frame.
      // We must copy the existing array to avoid mutating the read-only original array.
      const existingFlows = figma.currentPage.flowStartingPoints;
      const newFlows = [...existingFlows, {
          nodeId: startFrame.id,
          name: "Start Confetti"
      }];
      figma.currentPage.flowStartingPoints = newFlows;
  }


  // 3. Prototyping Interactions
  figma.notify("Setting up prototype interactions...");
  for (let i = 0; i < createdOuterFrames.length - 1; i++) {
    const currentFrame = createdOuterFrames[i];
    const nextFrame = createdOuterFrames[i + 1];

    // Updated 'action' to 'actions' array as per Figma API requirement
    currentFrame.reactions = [{
      trigger: {
        type: 'AFTER_TIMEOUT',
        // Hardcoded trigger delay to 1ms (0.001s)
        timeout: 0.001 
      },
      actions: [{
        type: 'NODE',
        destinationId: nextFrame.id,
        navigation: 'NAVIGATE',
        transition: {
          type: 'SMART_ANIMATE',
          // Use the UI input value for animation duration (converted to seconds)
          duration: animationDelayMs / 1000, 
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