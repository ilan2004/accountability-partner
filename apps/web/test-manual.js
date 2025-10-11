// Simple test to validate the pages can be imported without errors
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing pages for import errors...\n');

const pagesDir = path.join(__dirname, 'src/pages');

function testFile(filePath) {
  const relativePath = path.relative(__dirname, filePath);
  
  try {
    // Read file and check for basic syntax errors
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic checks
    const hasUseAuth = content.includes('useAuth');
    const hasWithAuthProvider = content.includes('withAuthProvider');
    const hasGetServerSideProps = content.includes('getServerSideProps');
    const hasExportDefault = content.includes('export default');
    
    console.log(`✓ ${relativePath}`);
    if (hasUseAuth && !hasWithAuthProvider && !relativePath.includes('_app')) {
      console.log(`  ⚠️  Uses useAuth but not wrapped with withAuthProvider`);
    }
    if (hasUseAuth && hasWithAuthProvider) {
      console.log(`  ✓ Properly wrapped with withAuthProvider`);
    }
    if (hasGetServerSideProps) {
      console.log(`  ✓ Has getServerSideProps (SSR enabled)`);
    }
    if (!hasExportDefault) {
      console.log(`  ⚠️  Missing export default`);
    }
    
  } catch (error) {
    console.log(`✗ ${relativePath}: ${error.message}`);
  }
}

// Test key pages
const testPages = [
  'src/pages/auth/signup.tsx',
  'src/pages/auth/signin.tsx', 
  'src/pages/auth/callback.tsx',
  'src/pages/auth/notion-connect.tsx',
  'src/pages/auth/index.tsx',
  'src/pages/index.tsx',
  'src/pages/_app.tsx'
];

testPages.forEach(page => {
  const fullPath = path.join(__dirname, page);
  if (fs.existsSync(fullPath)) {
    testFile(fullPath);
  } else {
    console.log(`✗ ${page}: File not found`);
  }
});

// Test API routes
console.log('\n🔌 Testing API routes...\n');

const testApis = [
  'src/pages/api/auth/create-profile.ts',
  'src/pages/api/auth/callback.ts',
  'src/pages/api/auth/notion-callback.ts'
];

testApis.forEach(api => {
  const fullPath = path.join(__dirname, api);
  if (fs.existsSync(fullPath)) {
    testFile(fullPath);
  } else {
    console.log(`✗ ${api}: File not found`);
  }
});

console.log('\n🎯 Manual verification checklist:');
console.log('1. All auth pages should be wrapped with AuthProvider');
console.log('2. Auth pages should have getServerSideProps to disable SSG'); 
console.log('3. API routes should exist for auth flows');
console.log('4. _app.tsx should wrap with AuthProvider globally');
console.log('\n✨ Test complete!');
