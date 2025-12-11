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

// --- CORE DATA GENERATOR (Used by both Preview and Final Output) ---

/**
 * Calculates all particle properties based on settings and bounds.
 * Returns an array of plain JS objects, not Figma nodes.
 */
function generateParticleData(settings, bounds) {
  const { width: boundsWidth, height: boundsHeight } = bounds;

  // 1. Validate settings & Setup values
  const randomness = validateNum(settings.randomness, 0, 100, 60);
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 0, 50, 10); // Allowed min 0 based on UI update
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;

  let shapesToUse =
    Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0
      ? settings.selectedShapes
      : ['rectangle', 'square', 'circle', 'star'];

  // 2. Determine Color Palette (array of RGBA objects)
  let colorPalette = [];
  if (settings.colorData.isMultiColor) {
    // Use default rainbow multi-color (solid RGBs from original code)
    colorPalette = [
      { r: 1, g: 0.2, b: 0.2, a: 1 },
      { r: 1, g: 0.6, b: 0, a: 1 },
      { r: 1, g: 0.9, b: 0, a: 1 },
      { r: 0.2, g: 0.8, b: 0.2, a: 1 },
      { r: 0.2, g: 0.6, b: 1, a: 1 },
      { r: 0.6, g: 0.2, b: 0.8, a: 1 },
    ];
  } else {
    // Use custom selected colors (convert HSLA from UI to Figma RGBA)
    colorPalette = settings.colorData.customColors.map((hsla) =>
      hslToRgba(hsla.h, hsla.s, hsla.l, hsla.a)
    );

    // Fallback if list is empty
    if (colorPalette.length === 0) {
      colorPalette = [{ r: 0.5, g: 0.5, b: 0.5, a: 1.0 }];
    }
  }

  // 3. Calculate Count (Using original density logic)
  // We use a fixed divider reference to keep density consistent across different frame sizes
  const referenceArea = 1440 * 1080; 
  // Map amount 0-100 to a density multiplier (e.g., 0.1 to 3.0)
  // Amount 50 gives multiplier ~1.5. Amount 100 gives ~3.
  const densityMultiplier = 0.1 + (amount / 100) * 2.9; 
  const baseDivider = 3000; //Adjusted divider for better count range
  
  const currentArea = boundsWidth * boundsHeight;
  // Calculate count based on area ratio vs reference, multiplied by density setting
  const count = Math.floor((currentArea / baseDivider) * densityMultiplier);


  const particles = [];

  // 4. Generation Loop
  for (let i = 0; i < count; i++) {
    const shapeType =
      shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    const colorBtn = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    // Calculate Base Size and Dimensions based on shape type
    // Base size reference is 20px at x1.0 zoom (zoom value 10)
    const baseReferenceSize = 20; 
    let baseWidth = baseReferenceSize;
    let baseHeight = baseReferenceSize;

    if (shapeType === 'rectangle') {
        baseWidth = baseReferenceSize * 1.5; // Rectangles are wider
        baseHeight = baseReferenceSize * 0.9;
    }

    // Calculate Scale Factor
    // Start with zoom slider effect (e.g., value 10 -> 1.0, value 50 -> 5.0)
    let scaleFactor = zoom / 10;
    
    // Apply randomized size variation if checked
    if (randomizeSize) {
       // Variation between 0.5x and 1.5x of the zoomed size
      scaleFactor *= (0.5 + Math.random());
    }
     // Ensure a tiny minimum scale so they don't disappear completely
     scaleFactor = Math.max(scaleFactor, 0.1);


    // Calculate Position (incorporating randomness spread logic)
    // We estimate final width to ensure it doesn't spawn off-screen right
    const estimatedFinalWidth = baseWidth * scaleFactor;
    const safeMaxX = Math.max(0, boundsWidth - estimatedFinalWidth);
    const potentialX = Math.random() * safeMaxX;

    const randomFactor = randomness / 100;
    // Spread Y based on randomness setting (higher randomness = more vertical spread)
    const ySpread = boundsHeight * (0.2 + 0.8 * randomFactor);
    const potentialY = Math.random() * ySpread;

    // Calculate Rotation
    let rotation = 0;
    if (randomizeRotation) {
      // Higher randomness setting increases rotation range
      rotation = Math.random() * 360 * Math.max(0.1, randomFactor);
    }

    // Push raw data object
    particles.push({
      x: potentialX,
      y: potentialY,
      shapeType: shapeType,
      color: colorBtn,
      scale: scaleFactor,
      rotation: rotation,
      // Store base dimensions for the renderer to use before scaling
      baseWidth: baseWidth,
      baseHeight: baseHeight
    });
  }

  return particles;
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

// --- FINAL OUTPUT GENERATOR (Creates Frame and Nodes on Canvas) ---

async function createFinalConfettiOnCanvas(settings) {
  // 1. Frame Setup
  // Using 1440x1080 to match the UI preview aspect ratio for consistency
  const frameWidth = 1440;
  const frameHeight = 1080; 
  const frame = figma.createFrame();
  frame.name = 'Confetti Frame';
  frame.resize(frameWidth, frameHeight);
  frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  figma.currentPage.appendChild(frame);

  // 2. Generate Data Blueprint
  figma.notify("Calculating particle physics...");
  // Yield to let UI update
  await new Promise(resolve => setTimeout(resolve, 20)); 

  const particleData = generateParticleData(settings, {
    width: frameWidth,
    height: frameHeight,
  });

  figma.notify(`Generating ${particleData.length} particles...`);
   // Yield again before heavy node creation loop
  await new Promise(resolve => setTimeout(resolve, 50));


  // Initialize counters for naming convention
  let rectangleCount = 0;
  let squareCount = 0;
  let circleCount = 0;
  let starCount = 0;

  // 3. Node Creation Loop
  // Wrap in a huge async IIFE to allow yielding during heavy processing
  await (async () => {
      for (let i = 0; i < particleData.length; i++) {
        const p = particleData[i];

        // Determine Name based on type and increment counter
        let particleName = '';
        switch (p.shapeType) {
          case 'rectangle':
            rectangleCount++;
            particleName = `Rectangle${rectangleCount}`;
            break;
          case 'square':
            squareCount++;
            particleName = `Square${squareCount}`;
            break;
          case 'circle':
            circleCount++;
            particleName = `Eclipse${circleCount}`; // Using "Eclipse" per requirement
            break;
          case 'star':
            starCount++;
            particleName = `Star${starCount}`;
            break;
        }

        // Create the basic node with base dimensions
        const node = createFigmaShapeNode(p.shapeType, p.baseWidth, p.baseHeight);
        if (!node) continue;

        // Apply properties
        node.name = particleName;
        node.x = p.x;
        node.y = p.y;
        // Apply scale calculated in data generator
        // We rescale based on its current size multiplied by the scale factor
        node.rescale(p.scale); 
        node.rotation = p.rotation;
        
        node.fills = [
          {
            type: 'SOLID',
            color: { r: p.color.r, g: p.color.g, b: p.color.b },
            opacity: p.color.a,
          },
        ];

        frame.appendChild(node);

        // Performance Optimization: Yield to the main thread every X nodes
        // to prevent Figma from freezing during large generations.
        if (i % 200 === 0) {
             await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
  })();

  figma.notify("Confetti generated successfully!");
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
}

// --- MAIN MESSAGE ROUTER ---

figma.ui.onmessage = async (msg) => {
  // 1. Handle Real-time Preview Request from UI
  if (msg.type === 'preview-confetti') {
    // Define bounds to match the UI's SVG viewBox (1440x1080)
    const previewBounds = { width: 1440, height: 1080 };

    // Generate pure data (no nodes created)
    const data = generateParticleData(msg.settings, previewBounds);

    // Send data back to UI for rendering
    figma.ui.postMessage({
      type: 'preview-data',
      particles: data,
    });
  }
  // 2. Handle Final Generation Request from UI
  else if (msg.type === 'generate-confetti') {
    // Create actual nodes on canvas
    await createFinalConfettiOnCanvas(msg.settings);
  }
  // 3. Close
  else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};