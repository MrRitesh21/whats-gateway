const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG definition for WAFlow PWA Logo
function createSvg(size, isMaskable = false) {
    const padding = isMaskable ? size * 0.15 : size * 0.05;
    const iconSize = size - padding * 2;
    const rx = isMaskable ? 0 : size * 0.22;

    return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#052e16" />
                <stop offset="50%" stop-color="#064e3b" />
                <stop offset="100%" stop-color="#022c22" />
            </linearGradient>
            <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
            </linearGradient>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="100%" stop-color="#047857" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.04}" flood-color="#10b981" flood-opacity="0.45" />
            </filter>
        </defs>

        <!-- Background -->
        <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bgGrad)" />
        
        <!-- Subtle outer ring -->
        <rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${rx * 0.9}" fill="none" stroke="#10b981" stroke-width="${size * 0.015}" stroke-opacity="0.35" />

        <!-- Center Chat Bubble Icon Group with Glow -->
        <g transform="translate(${padding}, ${padding})" filter="url(#glow)">
            <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="url(#emeraldGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <!-- WhatsApp message bubble -->
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="#064e3b" fill-opacity="0.4" />
                <!-- Lightning/Flow dynamic mark inside -->
                <path d="M13 8L9 13h4l-1 5 5-6h-4l1-4z" fill="url(#badgeGrad)" stroke="#6ee7b7" stroke-width="0.75" />
            </svg>
        </g>
    </svg>
    `;
}

async function generateIcons() {
    console.log('Generating PWA Icons...');
    
    const tasks = [
        { name: 'icon-192x192.png', size: 192, maskable: false },
        { name: 'icon-512x512.png', size: 512, maskable: false },
        { name: 'icon-maskable-192x192.png', size: 192, maskable: true },
        { name: 'icon-maskable-512x512.png', size: 512, maskable: true },
        { name: 'apple-touch-icon.png', size: 180, maskable: false },
        { name: 'favicon-32x32.png', size: 32, maskable: false },
    ];

    for (const task of tasks) {
        const svgBuffer = Buffer.from(createSvg(task.size, task.maskable));
        const outputPath = path.join(iconsDir, task.name);
        await sharp(svgBuffer)
            .resize(task.size, task.size)
            .png()
            .toFile(outputPath);
        console.log(`✓ Created ${task.name} (${task.size}x${task.size})`);
    }

    // Also save SVG as public/icons/icon.svg
    fs.writeFileSync(path.join(iconsDir, 'icon.svg'), createSvg(512, false));
    console.log('✓ Created icon.svg');

    // Also copy apple-touch-icon to public root for traditional iOS fallback
    fs.copyFileSync(path.join(iconsDir, 'apple-touch-icon.png'), path.join(__dirname, '../public/apple-touch-icon.png'));
    console.log('✓ Copied apple-touch-icon.png to public root');

    console.log('All PWA icons generated successfully!');
}

generateIcons().catch(err => {
    console.error('Error generating icons:', err);
    process.exit(1);
});
