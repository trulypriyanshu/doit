const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Function to create a single icon (using maskable icon style)
async function createIcon(size, fileName, description) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Use the same gradient background as maskable icons
  const gradient = ctx.createRadialGradient(
    size/2, size/2, 0,
    size/2, size/2, size/2
  );
  gradient.addColorStop(0, '#4f46e5');  // indigo-600
  gradient.addColorStop(1, '#7c3aed');  // violet-600
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // White checkmark in center (70% of icon)
  const checkSize = size * 0.7;
  const centerX = size / 2;
  const centerY = size / 2;

  // Draw checkmark
  ctx.beginPath();
  ctx.moveTo(centerX - checkSize * 0.25, centerY);
  ctx.lineTo(centerX - checkSize * 0.05, centerY + checkSize * 0.2);
  ctx.lineTo(centerX + checkSize * 0.35, centerY - checkSize * 0.3);
  ctx.lineWidth = Math.max(3, checkSize * 0.1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Save to public folder
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(publicDir, fileName);
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`✅ Created ${fileName} (${size}×${size}) - ${description}`);
  return outputPath;
}

// Function to create splash screens for iOS (updated to match new icon style)
async function createSplashScreen(width, height, fileName, description) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient matching icon style
  const gradient = ctx.createRadialGradient(
    width/2, height/2, 0,
    width/2, height/2, Math.max(width, height)/2
  );
  gradient.addColorStop(0, '#4f46e5');
  gradient.addColorStop(1, '#7c3aed');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Logo in center (scaled appropriately)
  const logoSize = Math.min(width, height) * 0.4;
  const centerX = width / 2;
  const centerY = height / 2;

  // White checkmark in center
  ctx.beginPath();
  ctx.moveTo(centerX - logoSize * 0.25, centerY);
  ctx.lineTo(centerX - logoSize * 0.05, centerY + logoSize * 0.2);
  ctx.lineTo(centerX + logoSize * 0.35, centerY - logoSize * 0.3);
  ctx.lineWidth = logoSize * 0.1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // App name (optional, can remove if you prefer just the icon)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${logoSize * 0.2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CarryOut', centerX, centerY + logoSize * 0.6);

  // Save
  const publicDir = path.join(__dirname, 'public');
  const outputPath = path.join(publicDir, fileName);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`✅ Created ${fileName} (${width}×${height}) - ${description}`);
  return outputPath;
}

// Function to create maskable icon (for adaptive Android icons)
// Now identical to createIcon, but kept separate for clarity
async function createMaskableIcon(size, fileName) {
  return createIcon(size, fileName, `maskable icon`);
}

// Function to create favicon.ico (multiple sizes in one file)
async function createFaviconIco() {
  const sizes = [16, 32, 48];
  const images = await Promise.all(
    sizes.map(async (size) => {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // Gradient background
      const gradient = ctx.createRadialGradient(
        size/2, size/2, 0,
        size/2, size/2, size/2
      );
      gradient.addColorStop(0, '#4f46e5');
      gradient.addColorStop(1, '#7c3aed');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      
      // White checkmark
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, size / 8);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      if (size >= 32) {
        ctx.moveTo(size * 0.25, size * 0.5);
        ctx.lineTo(size * 0.4, size * 0.65);
        ctx.lineTo(size * 0.75, size * 0.35);
      } else {
        // Simpler for 16x16
        ctx.moveTo(size * 0.25, size * 0.5);
        ctx.lineTo(size * 0.45, size * 0.7);
        ctx.lineTo(size * 0.75, size * 0.3);
      }
      ctx.stroke();
      
      return canvas.toBuffer('image/png');
    })
  );

  // Since canvas doesn't support ICO directly, we'll create PNG and convert
  const publicDir = path.join(__dirname, 'public');
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), images[1]); // 32x32
  console.log('✅ Created favicon.png (32×32) - Convert to .ico manually or use online tool');
}

// Main function
async function generateAllIcons() {
  console.log('🎨 Generating PWA icons for CarryOut Task Manager...\n');

  // Ensure public directory exists
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Standard PWA icons
  const standardIcons = [
    { size: 16, fileName: 'favicon-16x16.png', desc: 'Small browser favicon' },
    { size: 32, fileName: 'favicon-32x32.png', desc: 'Medium browser favicon' },
    { size: 48, fileName: 'favicon-48x48.png', desc: 'Large browser favicon' },
    { size: 72, fileName: 'icon-72x72.png', desc: 'Android small' },
    { size: 96, fileName: 'icon-96x96.png', desc: 'Android medium' },
    { size: 128, fileName: 'icon-128x128.png', desc: 'General use' },
    { size: 144, fileName: 'icon-144x144.png', desc: 'Windows tile' },
    { size: 152, fileName: 'apple-touch-icon-152x152.png', desc: 'iOS retina' },
    { size: 167, fileName: 'apple-touch-icon-167x167.png', desc: 'iPad Pro' },
    { size: 180, fileName: 'apple-touch-icon.png', desc: 'iOS home screen' },
    { size: 192, fileName: 'icon-192x192.png', desc: 'Android home screen' },
    { size: 256, fileName: 'icon-256x256.png', desc: 'General use' },
    { size: 384, fileName: 'icon-384x384.png', desc: 'Android large' },
    { size: 512, fileName: 'icon-512x512.png', desc: 'Splash screen' }
  ];

  // Create standard icons
  for (const icon of standardIcons) {
    await createIcon(icon.size, icon.fileName, icon.desc);
  }

  // Create maskable icons (for adaptive Android icons)
  const maskableSizes = [192, 512];
  for (const size of maskableSizes) {
    await createMaskableIcon(size, `maskable-icon-${size}x${size}.png`);
  }

  // Create iOS splash screens (common sizes)
  const splashScreens = [
    { width: 640, height: 1136, fileName: 'splash-640x1136.png', desc: 'iPhone 5/SE' },
    { width: 750, height: 1334, fileName: 'splash-750x1334.png', desc: 'iPhone 6/7/8' },
    { width: 828, height: 1792, fileName: 'splash-828x1792.png', desc: 'iPhone XR/11' },
    { width: 1125, height: 2436, fileName: 'splash-1125x2436.png', desc: 'iPhone X/XS' },
    { width: 1242, height: 2208, fileName: 'splash-1242x2208.png', desc: 'iPhone Plus' },
    { width: 1242, height: 2688, fileName: 'splash-1242x2688.png', desc: 'iPhone XS Max' },
    { width: 1536, height: 2048, fileName: 'splash-1536x2048.png', desc: 'iPad mini/Air' },
    { width: 1668, height: 2224, fileName: 'splash-1668x2224.png', desc: 'iPad Pro 10.5' },
    { width: 2048, height: 2732, fileName: 'splash-2048x2732.png', desc: 'iPad Pro 12.9' }
  ];

  console.log('\n📱 Creating splash screens...');
  for (const screen of splashScreens) {
    await createSplashScreen(screen.width, screen.height, screen.fileName, screen.desc);
  }

  // Create favicon
  console.log('\n🔗 Creating favicon...');
  await createFaviconIco();

  // Create manifest.json
  console.log('\n📄 Generating manifest.json...');
  const manifest = {
    "name": "CarryOut • Smart Task Manager",
    "short_name": "CarryOut",
    "description": "Your smart task management companion with recurring tasks, checklists, and productivity insights",
    "theme_color": "#4f46e5",
    "background_color": "#0f172a",
    "display": "standalone",
    "orientation": "portrait",
    "scope": "/",
    "start_url": "/",
    "icons": [
      {
        "src": "/favicon-16x16.png",
        "sizes": "16x16",
        "type": "image/png"
      },
      {
        "src": "/favicon-32x32.png",
        "sizes": "32x32",
        "type": "image/png"
      },
      {
        "src": "/icon-72x72.png",
        "sizes": "72x72",
        "type": "image/png"
      },
      {
        "src": "/icon-96x96.png",
        "sizes": "96x96",
        "type": "image/png"
      },
      {
        "src": "/icon-128x128.png",
        "sizes": "128x128",
        "type": "image/png"
      },
      {
        "src": "/icon-144x144.png",
        "sizes": "144x144",
        "type": "image/png"
      },
      {
        "src": "/apple-touch-icon.png",
        "sizes": "180x180",
        "type": "image/png"
      },
      {
        "src": "/icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/maskable-icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "maskable"
      },
      {
        "src": "/icon-256x256.png",
        "sizes": "256x256",
        "type": "image/png"
      },
      {
        "src": "/icon-384x384.png",
        "sizes": "384x384",
        "type": "image/png"
      },
      {
        "src": "/icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png"
      },
      {
        "src": "/maskable-icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ],
    "screenshots": [
      {
        "src": "/screenshot-1.png",
        "sizes": "1280x720",
        "type": "image/png",
        "form_factor": "wide",
        "label": "CarryOut Desktop View"
      },
      {
        "src": "/screenshot-2.png",
        "sizes": "750x1334",
        "type": "image/png",
        "form_factor": "narrow",
        "label": "CarryOut Mobile View"
      }
    ],
    "categories": ["productivity", "utilities"],
    "shortcuts": [
      {
        "name": "New Task",
        "short_name": "Add",
        "description": "Create a new task",
        "url": "/?new=true",
        "icons": [{ "src": "/icon-96x96.png", "sizes": "96x96" }]
      },
      {
        "name": "Today's Tasks",
        "short_name": "Today",
        "description": "View today's tasks",
        "url": "/?filter=today",
        "icons": [{ "src": "/icon-96x96.png", "sizes": "96x96" }]
      }
    ],
    "lang": "en-US",
    "dir": "ltr"
  };

  fs.writeFileSync(
    path.join(publicDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Update browserconfig.xml to match new colors
  const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/icon-72x72.png"/>
      <square150x150logo src="/icon-144x144.png"/>
      <square310x310logo src="/icon-310x310.png"/>
      <wide310x150logo src="/icon-310x150.png"/>
      <TileColor>#4f46e5</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;

  fs.writeFileSync(path.join(publicDir, 'browserconfig.xml'), browserConfig);

  console.log('\n🎉 All PWA assets generated successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Convert favicon.png to favicon.ico using:');
  console.log('   https://favicon.io/favicon-converter/');
  console.log('2. Create screenshots (optional but recommended):');
  console.log('   - /public/screenshot-1.png (1280×720)');
  console.log('   - /public/screenshot-2.png (750×1334)');
  console.log('3. Update your HTML file:');
  console.log('   - Change theme-color to #4f46e5');
  console.log('   - Update loading screen background to match new gradient');
  console.log('4. Test your PWA at: https://pwabuilder.com');
  console.log('\n📁 All files saved to /public folder!');
}

// Check if canvas is installed
try {
  require('canvas');
} catch (error) {
  console.error('\n❌ Canvas module not installed!');
  console.log('Install it with: npm install canvas');
  process.exit(1);
}

// Run the generator
generateAllIcons().catch(console.error);