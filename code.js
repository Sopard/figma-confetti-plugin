// Show the UI with dimensions matching the design
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
      // Use default rainbow multi-color
      colorPalette = [
          {r:1, g:0.2, b:0.2}, {r:1, g:0.6, b:0}, {r:1, g:0.9, b:0},
          {r:0.2, g:0.8, b:0.2}, {r:0.2, g:0.6, b:1}, {r:0.6, g:0.2, b:0.8}
      ];
  } else {
      // Use custom selected colors
      colorPalette = settings.colorData.customColors.map(hex => hexToRgb(hex));
      // Fallback if list is empty
      if (colorPalette.length === 0) {
          colorPalette = [{r:0.5, g:0.5, b:0.5}];
      }
  }


  // 2. Frame Setup
  const frameWidth = 1440;
  const frameHeight = 1024;
  const frame = figma.createFrame();
  frame.name = `Confetti Frame${isPreview ? ' Preview' : ''}`;
  frame.resize(Number(frameWidth), Number(frameHeight));
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

  // 4. Generation Loop
  figma.notify(isPreview ? "Generating preview..." : `Generating ${count} particles...`);

  for (let i = 0; i < count; i++) {
    const randomShapeType = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    const particle = createShape(randomShapeType);
    if (!particle) continue;

    // Pick color from the determined palette
    const colorRGB = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    particle.fills = [{ type: 'SOLID', color: colorRGB }];

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

// Helper to convert hex to RGB for Figma
function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0.5, g: 0.5, b: 0.5 }; // default gray if invalid
}