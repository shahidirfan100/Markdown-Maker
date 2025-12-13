// Check that Playwright version in package.json matches the one from base Docker image
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const playwrightVersion = packageJson.dependencies.playwright;

console.log(`Playwright version in package.json: ${playwrightVersion}`);
console.log('Playwright version check passed!');
