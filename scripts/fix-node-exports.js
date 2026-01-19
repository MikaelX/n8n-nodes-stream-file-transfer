#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixExports(filePath, className, exportName) {
	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		return false;
	}

	let content = fs.readFileSync(filePath, 'utf8');

	// Remove any existing module.exports that replaces the entire exports object
	content = content.replace(new RegExp(`^module\\.exports\\s*=\\s*${className};?\\s*$`, 'm'), '');

	// Ensure exports[exportName] exists (it should from TypeScript compilation)
	const exportPattern = new RegExp(`exports\\.${exportName}\\s*=\\s*${className};`);
	if (!exportPattern.test(content)) {
		// Find the class definition and add export after it
		const classMatch = content.match(new RegExp(`(class ${className}[^}]+})`, 's'));
		if (classMatch) {
			const insertPos = content.indexOf('}', content.indexOf(`class ${className}`)) + 1;
			content = content.slice(0, insertPos) + `\nexports.${exportName} = ${className};\n` + content.slice(insertPos);
		}
	}

	// Also ensure module.exports[exportName] exists for compatibility
	const moduleExportPattern = new RegExp(`module\\.exports\\.${exportName}`);
	let sourceMapMatch = content.match(/(\/\/# sourceMappingURL=.*)$/m);
	const sourceMap = sourceMapMatch ? sourceMapMatch[1] : '';
	
	if (!moduleExportPattern.test(content)) {
		// Remove the source map comment temporarily
		content = content.replace(/\/\/# sourceMappingURL=.*$/m, '');
		
		// Add module.exports[exportName] (doesn't override exports object)
		content += `\nmodule.exports.${exportName} = ${className};\n`;
	}
	
	// Restore source map at the end if it was removed
	if (sourceMap && !content.includes('sourceMappingURL')) {
		content += sourceMap + '\n';
	}

	fs.writeFileSync(filePath, content, 'utf8');
	return true;
}

// Copy SVG icon file to dist
function copySvgIcon() {
	const srcSvg = path.join(__dirname, '../src/nodes/SiteToSiteFileTransfer/transfer.svg');
	const distSvg = path.join(__dirname, '../dist/nodes/SiteToSiteFileTransfer/transfer.svg');
	
	if (!fs.existsSync(srcSvg)) {
		console.warn(`⚠️  SVG icon not found: ${srcSvg}`);
		return false;
	}
	
	// Ensure dist directory exists
	const distDir = path.dirname(distSvg);
	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
	}
	
	fs.copyFileSync(srcSvg, distSvg);
	return true;
}

// Fix node file
const nodeFile = path.join(__dirname, '../dist/nodes/SiteToSiteFileTransfer/SiteToSiteFileTransfer.node.js');
if (fs.existsSync(nodeFile)) {
	fixExports(nodeFile, 'SiteToSiteFileTransfer', 'SiteToSiteFileTransfer');
	console.log('✓ Fixed node exports');
} else {
	console.warn(`Node file not found: ${nodeFile}`);
}

// Copy SVG icon
if (copySvgIcon()) {
	console.log('✓ Copied SVG icon');
} else {
	console.warn('⚠️  Failed to copy SVG icon');
}

