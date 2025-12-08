// Show the UI with dimensions that fit the design
figma.showUI(__html__, { width: 800, height: 750, themeColors: false });

// Listen for messages from the UI
figma.ui.onmessage = msg => {
  if (msg.type === 'generate-confetti' || msg.type === 'preview-confetti') {
    // Preview generates a smaller batch for performance
    const isPreview = msg.type === 'preview-confetti';
    generateConfetti(msg.settings, isPreview);
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

function generateConfetti(settings, isPreview) {
  console.log("Raw settings received:", settings);

  // --- 1. RIGOROUS INPUT VALIDATION & DEFAULTS ---
  // We explicitly check if inputs are valid numbers. If not, we use safe defaults.

  // Speed slider is 0-100. Default to 60 if invalid.
  const speedRaw = parseFloat(settings.speed);
  const speed = (!isNaN(speedRaw) && speedRaw >= 0 && speedRaw <= 100) ? speedRaw : 60;

  // Randomness slider is 0-100. Default to 60 if invalid.
  const randomnessRaw = parseFloat(settings.randomness);
  const randomness = (!isNaN(randomnessRaw) && randomnessRaw >= 0 && randomnessRaw <= 100) ? randomnessRaw : 60;

  // Zoom slider is 10-100. Default to 10 (1.0x) if invalid.
  const zoomRaw = parseFloat(settings.zoom);
  const zoom = (!isNaN(zoomRaw) && zoomRaw >= 10 && zoomRaw <= 100) ? zoomRaw : 10;

  // Ensure device is a valid string. Default to 'desktop'.
  const deviceStr = (settings.device && typeof settings.device === 'string') ? settings.device : 'desktop';

  // Ensure selectedShapes is an array. Default to all shapes if empty.
  let shapesToUse = (Array.isArray(settings.selectedShapes) && settings.selectedShapes.length > 0) 
    ? settings.selectedShapes 
    : ['rectangle', 'circle', 'star'];

  console.log("Validated settings:", { speed, randomness, zoom, deviceStr, shapesToUse });

  // --- 2. FRAME SETUP ---
  let frameWidth = 1440; let frameHeight = 1024;
  if (deviceStr === 'mobile') { frameWidth = 390; frameHeight = 844; }
  else if (deviceStr === 'tablet') { frameWidth = 834; frameHeight = 1194; }

  const frame = figma.createFrame();
  frame.name = `Confetti - ${deviceStr.charAt(0).toUpperCase() + deviceStr.slice(1)}${isPreview ? ' Preview' : ''}`;
  // Ensure width/height are numbers before resizing
  frame.resize(Number(frameWidth), Number(frameHeight));
  frame.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
  figma.currentPage.appendChild(frame);

  // --- 3. CALCULATION SETUP ---
  // Speed 50 is normal density (multiplier 1). Speed 100 is double density.
  const densityMultiplier = speed / 50; 
  // Lower base divider = higher density.
  const baseDivider = isPreview ? 10000 : 2500; 
  const baseCount = (frameWidth * frameHeight) / baseDivider;
  // Ensure count is a safe integer
  const count = Math.floor(baseCount * densityMultiplier);

  const rainbowColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#18A0FB', '#F24E1E', '#FFC700', '#00C853'];

  // Helper: Create shape with validated size
  const createShape = (type) => {
    // Zoom 10 = 0.5x scale. Zoom 100 = 5.0x scale.
    const scaleFactor = zoom / 20; 
    const baseSize = 20;
    let size = baseSize * scaleFactor;

    // Final safety check on size
    if (isNaN(size) || size <= 0) size = 10;

    let node;
    if (type === 'rectangle') {
      node = figma.createRectangle();
      node.resize(size, size * 0.6);
      node.cornerRadius = size * 0.1;
    } else if (type === 'circle') {
      node = figma.createEllipse();
      node.resize(size, size);
    } else if (type === 'star') {
      node = figma.createStar();
      node.resize(size, size);
      node.pointCount = 5;
      node.innerRadius = 0.4;
    }
    return node;
  }

  // --- 4. GENERATION LOOP ---
  figma.notify(isPreview ? "Generating preview..." : `Generating ${count} particles...`);

  for (let i = 0; i < count; i++) {
    const randomShapeType = shapesToUse[Math.floor(Math.random() * shapesToUse.length)];
    const particle = createShape(randomShapeType);
    
    if (!particle) continue;

    // Color
    const colorHex = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
    const r = parseInt(colorHex.slice(1, 3), 16) / 255;
    const g = parseInt(colorHex.slice(3, 5), 16) / 255;
    const b = parseInt(colorHex.slice(5, 7), 16) / 255;
    particle.fills = [{ type: 'SOLID', color: { r, g, b } }];

    // Position & Rotation based on Randomness factor (0.0 - 1.0)
    const randomFactor = randomness / 100; 
    
    // Calculate safe bounds
    const safeMaxX = Math.max(0, frameWidth - particle.width);
    const potentialX = Math.random() * safeMaxX;
    
    // Spread Y: Low randomness concentrates at top, high randomness spreads full height
    const ySpread = frameHeight * (0.2 + (0.8 * randomFactor));
    const potentialY = Math.random() * ySpread;
    
    const potentialRotation = Math.random() * 360 * Math.max(0.1, randomFactor);

    // FINAL SAFETY CHECK before assignment. If any value is NaN, skip this particle.
    if (isNaN(potentialX) || isNaN(potentialY) || isNaN(potentialRotation)) {
        console.error("NaN value calculated for particle. Skipping.");
        particle.remove();
        continue;
    }

    particle.x = potentialX;
    particle.y = potentialY;
    particle.rotation = potentialRotation;

    frame.appendChild(particle);
  }

  // Center view on result
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.notify("Confetti generated successfully!");
}