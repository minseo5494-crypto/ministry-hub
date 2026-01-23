/**
 * WORSHEEP 전체 화면 캡쳐 스크립트
 *
 * 사용법:
 * 1. npx playwright install chromium
 * 2. npx ts-node scripts/capture-all-screens.ts
 *
 * 결과: screenshots/ 폴더에 모든 캡쳐 저장
 */

import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

function askPassword(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question('🔑 비밀번호를 입력하세요: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = './screenshots';

// 테스트 계정 (환경변수 또는 직접 입력)
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'minseo1885@naver.com',
  password: process.env.TEST_PASSWORD || '' // 실행 시 환경변수로 전달
};

// 캡쳐할 페이지 목록
const PAGES = {
  // 비로그인 상태
  public: [
    { name: '01_랜딩', path: '/' },
    { name: '02_로그인', path: '/login' },
    { name: '03_회원가입', path: '/signup' },
    { name: '04_비밀번호찾기', path: '/auth/forgot-password' },
    { name: '05_이용약관', path: '/terms' },
    { name: '06_개인정보처리방침', path: '/privacy' },
    { name: '07_저작권안내', path: '/copyright' },
  ],

  // 로그인 필요
  authenticated: [
    { name: '10_메인_악보검색', path: '/main' },
    { name: '11_악보업로드', path: '/upload' },
    { name: '12_마이페이지', path: '/my-page' },
    { name: '13_마이페이지_설정', path: '/my-page/settings' },
    { name: '14_내필기', path: '/my-notes' },
    { name: '15_내악보', path: '/personal' },
    { name: '16_팀목록', path: '/my-team' },
    { name: '17_팀생성', path: '/teams/create' },
    { name: '18_팀참가', path: '/teams/join' },
    { name: '19_스트리밍', path: '/streaming' },
  ],

  // 관리자 전용
  admin: [
    { name: '30_관리자_대시보드', path: '/admin/dashboard' },
    { name: '31_관리자_콘텐츠관리', path: '/admin/content-management' },
    { name: '32_관리자_곡승인', path: '/admin/song-approvals' },
    { name: '33_관리자_피드백', path: '/admin/feedbacks' },
    { name: '34_관리자_계정관리', path: '/admin/account-management' },
    { name: '35_관리자_유저곡', path: '/admin/user-songs' },
    { name: '36_관리자_공식업로더', path: '/admin/official-uploaders' },
    { name: '37_관리자_공식곡', path: '/admin/official-songs' },
    { name: '38_관리자_출판사', path: '/admin/publishers' },
  ],
};

// 인터랙션 (모달, 팝업 등)
const INTERACTIONS = [
  {
    page: '/main',
    actions: [
      { name: '10_메인_검색결과', action: async (p: Page) => {
        await p.fill('input[placeholder*="검색"]', '주 하나님');
        await p.waitForTimeout(1000);
      }},
      { name: '10_메인_곡클릭_모달', action: async (p: Page) => {
        await p.click('.song-card >> nth=0').catch(() => {});
        await p.waitForTimeout(500);
      }},
    ]
  },
  {
    page: '/my-page',
    actions: [
      { name: '12_마이페이지_곡추가모달', action: async (p: Page) => {
        const addBtn = p.locator('button:has-text("추가"), button:has-text("업로드")').first();
        if (await addBtn.isVisible()) {
          await addBtn.click();
          await p.waitForTimeout(500);
        }
      }},
    ]
  },
  {
    page: '/admin/content-management',
    actions: [
      { name: '31_관리자_콘텐츠_필터열기', action: async (p: Page) => {
        const filterBtn = p.locator('button:has-text("필터")').first();
        if (await filterBtn.isVisible()) {
          await filterBtn.click();
          await p.waitForTimeout(300);
        }
      }},
    ]
  },
];

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function capture(page: Page, name: string, viewport: { width: number; height: number }) {
  const filename = `${name}_${viewport.width}x${viewport.height}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);

  await page.setViewportSize(viewport);
  await page.waitForTimeout(300); // 리사이즈 후 렌더링 대기
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`✓ ${filename}`);
}

async function captureWithViewports(page: Page, name: string) {
  // 데스크톱
  await capture(page, name, { width: 1920, height: 1080 });
  // 태블릿
  await capture(page, name, { width: 768, height: 1024 });
  // 모바일
  await capture(page, name, { width: 375, height: 812 });
}

async function login(page: Page) {
  console.log('\n🔐 로그인 필요 - 브라우저에서 직접 로그인해주세요...');
  await page.goto(`${BASE_URL}/login`);

  // 사용자가 직접 로그인할 때까지 대기 (최대 2분)
  console.log('⏳ 로그인 완료 후 메인 페이지로 이동하면 자동 진행됩니다...');
  await page.waitForURL('**/main**', { timeout: 120000 });
  console.log('✓ 로그인 완료!\n');
}

async function capturePages(page: Page, pages: typeof PAGES.public) {
  for (const { name, path: pagePath } of pages) {
    try {
      await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1000); // 렌더링 대기
      await captureWithViewports(page, name);
    } catch (error) {
      console.log(`✗ ${name} - 에러: ${error}`);
    }
  }
}

async function captureInteractions(page: Page) {
  console.log('\n📱 인터랙션 캡쳐 중...');

  for (const { page: pagePath, actions } of INTERACTIONS) {
    await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle' });

    for (const { name, action } of actions) {
      try {
        await action(page);
        await captureWithViewports(page, name);
        // 모달 닫기 시도
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } catch (error) {
        console.log(`✗ ${name} - 인터랙션 에러`);
      }
    }
  }
}

async function main() {
  console.log('🎬 WORSHEEP 화면 캡쳐 시작\n');

  ensureDir(SCREENSHOT_DIR);

  // 브라우저 실행
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // 1. 비로그인 페이지 캡쳐
    console.log('📄 비로그인 페이지 캡쳐...');
    await capturePages(page, PAGES.public);

    // 2. 로그인 (브라우저에서 직접)
    await login(page);

    // 3. 로그인 필요 페이지 캡쳐
    console.log('\n📄 로그인 페이지 캡쳐...');
    await capturePages(page, PAGES.authenticated);

    // 4. 관리자 페이지 캡쳐 (관리자 계정인 경우)
    console.log('\n📄 관리자 페이지 캡쳐...');
    await capturePages(page, PAGES.admin);

    // 5. 인터랙션 캡쳐 (모달, 팝업 등)
    await captureInteractions(page);

    console.log('\n✅ 캡쳐 완료! screenshots/ 폴더를 확인하세요.');

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await browser.close();
  }
}

main();
