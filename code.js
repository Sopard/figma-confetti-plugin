// Show the UI with dimensions matching the design (wider layout)
figma.showUI(__html__, { width: 720, height: 680, themeColors: false });

figma.ui.onmessage = msg => {
  if (msg.type === 'generate-confetti' || msg.type === 'preview-confetti') {
    const isPreview = msg.type === 'preview-confetti';
    generateConfetti(msg.settings, isPreview);
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

function generateConfetti(settings, isPreview) {
  // 1. Validate settings and set defaults
  const speed = validateNum(settings.speed, 0, 100, 60);
  const randomness = validateNum(settings.randomness, 0, 100, 60);
  const amount = validateNum(settings.amount, 0, 100, 60);
  const zoom = validateNum(settings.zoom, 10, 100, 10);
  const randomizeSize = settings.randomizeSize === true;
  const randomizeRotation = settings.randomizeRotation === true;

  let shapesToUse = (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) 
    ? settings.selectedShapes 
    : ['rectangle', 'circle', 'star'];

  // 2. Frame Setup - Always use a standard desktop size
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

  const rainbowColors = [
    {r:1, g:0.2, b:0.2}, {r:1, g:0.6, b:0}, {r:1, g:0.9, b:0},
    {r:0.2, g:0.8, b:0.2}, {r:0.2, g:0.6, b:1}, {r:0.6, g:0.2, b:0.8}
  ];

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
    if (type === 'rectangle') {
      node = figma.createRectangle();
      node.resize(baseSize, baseSize * 0.6);
      node.cornerRadius = baseSize * 0.1;
    } else if (type === 'circle') {
      node = figma.createEllipse();
      node.resize(baseSize, baseSize);
    } else if (type === 'star') {
      node = figma.createStar();
      node.resize(baseSize, baseSize);
      node.pointCount = 5;
      node.innerRadius = 0.4;
    }
    return node;
  }

  // 4. Generation Loop
  figma.notify(isPreview ? "Generating preview..." : `Generating ${count} particles...`);

  for (let i = 0; i < count; i++) {
    const randomShapeType = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    const particle = createShape(randomShapeType);
    if (!particle) continue;

    // Color
    const colorRGB = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
    particle.fills = [{ type: 'SOLID', color: colorRGB }];

    // Position
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

// Helper function for validation
function validateNum(val, min, max, def) {
    const num = parseFloat(val);
    if (isNaN(num) || num < min || num > max) return def;
    return num;
}