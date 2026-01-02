/**
 * 로그인 세션 저장 스크립트
 *
 * 사용법: npm run screenshot:login
 *
 * 브라우저가 열리면:
 * 1. Google 로그인 진행
 * 2. 로그인 완료되면 터미널에서 Enter 키 누르기
 * 3. 세션이 저장됨
 */

const { chromium } = require('playwright');
const readline = require('readline');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://ministry-hub-three.vercel.app';
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'session.json');

async function waitForEnter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question('\n✅ 로그인 완료 후 Enter 키를 누르세요...', () => {
      rl.close();
      resolve();
    });
  });
}

async function saveSession() {
  console.log('🚀 브라우저를 여는 중...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null // 전체화면
  });

  const page = await context.newPage();

  console.log(`📱 ${BASE_URL} 접속 중...`);
  await page.goto(BASE_URL);

  console.log('\n========================================');
  console.log('📋 안내:');
  console.log('1. 브라우저에서 Google 로그인을 진행하세요');
  console.log('2. 로그인이 완료되어 메인 화면이 보이면');
  console.log('3. 이 터미널로 돌아와서 Enter 키를 누르세요');
  console.log('========================================\n');

  await waitForEnter();

  // 세션 저장
  const fs = require('fs');
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await context.storageState({ path: AUTH_FILE });

  console.log(`\n💾 세션이 저장되었습니다: ${AUTH_FILE}`);
  console.log('🎉 이제 npm run screenshot:capture 를 실행하세요!\n');

  await browser.close();
}

saveSession().catch(console.error);
