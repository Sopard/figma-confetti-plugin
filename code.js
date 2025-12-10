// code.js

figma.showUI(__html__, { width: 960, height: 700, themeColors: false });

figma.ui.onmessage = msg => {
  if (msg.type === 'generate-confetti' || msg.type === 'preview-confetti') {
    const isPreview = msg.type === 'preview-confetti';
    generateConfetti(msg.settings, isPreview);
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

function generateConfetti(settings, isPreview) {
  // 1. Validate settings
  const speed = validateNum(settings.speed, 0, 100, 60);
  const randomness = validateNum(settings.randomness, 0, 100, 60);
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 10, 50, 10);
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;

  let shapesToUse = (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) 
    ? settings.selectedShapes 
    : ['rectangle', 'square', 'circle', 'star'];

  // Determine Color Palette
  let colorPalette = [];
  if (settings.colorData.isMultiColor) {
      // Use default rainbow multi-color (solid RGBs)
      colorPalette = [
          {r:1, g:0.2, b:0.2}, {r:1, g:0.6, b:0}, {r:1, g:0.9, b:0},
          {r:0.2, g:0.8, b:0.2}, {r:0.2, g:0.6, b:1}, {r:0.6, g:0.2, b:0.8}
      ];
  } else {
      // Use custom selected colors (HSLA objects)
      // Convert HSLA to Figma RGBA format
      colorPalette = settings.colorData.customColors.map(hsla => hslToRgba(hsla.h, hsla.s, hsla.l, hsla.a));
      
      // Fallback if list is empty
      if (colorPalette.length === 0) {
          colorPalette = [{r:0.5, g:0.5, b:0.5, a:1.0}];
      }
  }


  // 2. Frame Setup
  const frameWidth = 1440;
  const frameHeight = 1024;
  const frame = figma.createFrame();
  frame.name = `Confetti Frame${isPreview ? ' Preview' : ''}`;
  frame.resize(Number(frameWidth), Number(frameHeight));
  // Solid white background
  frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  figma.currentPage.appendChild(frame);

  // 3. Calculation Setup
  const densityMultiplier = amount / 50; 
  const baseDivider = isPreview ? 8000 : 2500;
  const baseCount = (frameWidth * frameHeight) / baseDivider;
  const count = Math.floor(baseCount * densityMultiplier);

  // Helper: Create shape
  const createShape = (type) => {
    const zoomScale = zoom / 10; 
    let baseSize = 20 * zoomScale;

    if (randomizeSize) {
        const sizeVariation = 0.5 + Math.random(); 
        baseSize = baseSize * sizeVariation;
    }
    if (isNaN(baseSize) || baseSize <= 2) baseSize = 5;

    let node;
    switch (type) {
        case 'rectangle':
            node = figma.createRectangle();
            node.resize(baseSize, baseSize * 0.6);
            node.cornerRadius = baseSize * 0.1;
            break;
        case 'square':
            node = figma.createRectangle();
            node.resize(baseSize, baseSize);
            node.cornerRadius = baseSize * 0.1;
            break;
        case 'circle':
            node = figma.createEllipse();
            node.resize(baseSize, baseSize);
            break;
        case 'star':
            node = figma.createStar();
            node.resize(baseSize, baseSize);
            node.pointCount = 5;
            node.innerRadius = 0.4;
            break;
    }
    return node;
  }

  // --- NEW: Initialize counters for naming convention ---
  let rectangleCount = 0;
  let squareCount = 0;
  let circleCount = 0; // Used for "Eclipse" names
  let starCount = 0;
  // ------------------------------------------------------


  // 4. Generation Loop
  figma.notify(isPreview ? "Generating preview..." : `Generating ${count} particles...`);

  for (let i = 0; i < count; i++) {
    const randomShapeType = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    
    // --- NEW: Determine Name based on type and increment counter ---
    let particleName = "";
    switch (randomShapeType) {
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
            // Using "Eclipse" as requested in prompt for circles
            particleName = `Eclipse${circleCount}`; 
            break;
        case 'star':
            starCount++;
            particleName = `Star${starCount}`;
            break;
        default:
            particleName = `Particle${i}`;
    }
    // ------------------------------------------------------------

    const particle = createShape(randomShapeType);
    if (!particle) continue;

    // --- NEW: Apply the generated name ---
    particle.name = particleName;
    // -------------------------------------


    // Pick color from the palette
    const colorData = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    
    // Apply solid color and opacity
    particle.fills = [{ 
        type: 'SOLID', 
        color: { r: colorData.r, g: colorData.g, b: colorData.b },
        opacity: colorData.a !== undefined ? colorData.a : 1.0
    }];

    const randomFactor = randomness / 100; 
    const safeMaxX = Math.max(0, frameWidth - particle.width);
    const potentialX = Math.random() * safeMaxX;
    const ySpread = frameHeight * (0.2 + (0.8 * randomFactor));
    const potentialY = Math.random() * ySpread;
    
    particle.x = potentialX;
    particle.y = potentialY;

    if (randomizeRotation) {
       particle.rotation = Math.random() * 360 * Math.max(0.1, randomFactor);
    } else {
       particle.rotation = 0;
    }

    frame.appendChild(particle);
  }

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
}

function validateNum(val, min, max, def) {
    const num = parseFloat(val);
    if (isNaN(num) || num < min || num > max) return def;
    return num;
}

// Helper to convert HSL to Figma RGBA format
function hslToRgba(h, s, l, a) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a_hsl = s * Math.min(l, 1 - l);
  const f = n => l - a_hsl * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return {
    r: f(0),
    g: f(8),
    b: f(4),
    a: a
  };
}