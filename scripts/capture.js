/**
 * 자동 스크린샷 캡처 스크립트
 *
 * 사용법: npm run screenshot:capture
 *
 * 먼저 npm run screenshot:login 으로 로그인 세션을 저장해야 합니다.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://ministry-hub-three.vercel.app';
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'session.json');
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// 뷰포트 설정
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  ipad: { width: 1024, height: 1366 },      // iPad Pro 12.9"
  ipadMini: { width: 768, height: 1024 },   // iPad Mini
  mobile: { width: 375, height: 812 }        // iPhone X/11/12
};

// 캡처할 화면 목록
const SCREENS = [
  // ===== 1. 메인 (홈) =====
  {
    name: '01_home',
    path: '/',
    devices: ['desktop', 'ipad', 'mobile'],
    delay: 2500
  },

  // ===== 2. 송폼 선택 모달 =====
  {
    name: '02_songform_modal',
    path: '/',
    devices: ['desktop', 'ipad', 'mobile'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // 첫 번째 곡 카드 클릭
      const songCard = await page.$('.group.cursor-pointer, [class*="song-card"], [class*="cursor-pointer"][class*="rounded"]');
      if (songCard) {
        await songCard.click();
        await page.waitForTimeout(1500);
      }
    },
    delay: 500
  },

  // ===== 3. 악보 뷰어 (보기 모드) =====
  {
    name: '03_viewer',
    path: '/',
    devices: ['ipad', 'desktop'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // 첫 번째 곡 카드 클릭
      const songCard = await page.$('.group.cursor-pointer, [class*="cursor-pointer"][class*="rounded"]');
      if (songCard) {
        await songCard.click();
        await page.waitForTimeout(1500);
        // "보기" 또는 악보 보기 버튼 클릭
        const viewBtn = await page.$('button:has-text("보기"), button:has-text("악보 보기"), [data-testid="view-btn"]');
        if (viewBtn) {
          await viewBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    delay: 500
  },

  // ===== 4. 악보 에디터 (필기 모드) =====
  {
    name: '04_editor',
    path: '/',
    devices: ['ipad'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // 첫 번째 곡 카드 클릭
      const songCard = await page.$('.group.cursor-pointer, [class*="cursor-pointer"][class*="rounded"]');
      if (songCard) {
        await songCard.click();
        await page.waitForTimeout(1500);
        // "보기" 버튼 클릭
        const viewBtn = await page.$('button:has-text("보기"), button:has-text("악보 보기")');
        if (viewBtn) {
          await viewBtn.click();
          await page.waitForTimeout(2000);
          // "필기" 또는 "편집" 버튼 클릭
          const editBtn = await page.$('button:has-text("필기"), button:has-text("편집"), [data-testid="edit-btn"]');
          if (editBtn) {
            await editBtn.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    },
    delay: 500
  },

  // ===== 5. 마이팀 목록 =====
  {
    name: '05_myteam_list',
    path: '/my-team',
    devices: ['desktop', 'mobile'],
    delay: 2000
  },

  // ===== 6. 팀 상세 페이지 =====
  {
    name: '06_team_detail',
    path: '/my-team',
    devices: ['desktop', 'ipad', 'mobile'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // 첫 번째 팀 클릭
      const teamLink = await page.$('a[href*="/my-team/"]');
      if (teamLink) {
        await teamLink.click();
        await page.waitForTimeout(2500);
      }
    },
    delay: 500
  },

  // ===== 7. 콘티 상세 페이지 =====
  {
    name: '07_setlist_detail',
    path: '/my-team',
    devices: ['desktop', 'ipad', 'mobile'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // 첫 번째 팀 클릭
      const teamLink = await page.$('a[href*="/my-team/"]');
      if (teamLink) {
        await teamLink.click();
        await page.waitForTimeout(2500);
        // 콘티 항목 클릭
        const setlistLink = await page.$('a[href*="/setlist/"], [class*="setlist"], [class*="cursor-pointer"]');
        if (setlistLink) {
          await setlistLink.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    delay: 500
  },

  // ===== 8. 콘티에서 악보 보기 =====
  {
    name: '08_setlist_viewer',
    path: '/my-team',
    devices: ['ipad'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      const teamLink = await page.$('a[href*="/my-team/"]');
      if (teamLink) {
        await teamLink.click();
        await page.waitForTimeout(2500);
        const setlistLink = await page.$('a[href*="/setlist/"]');
        if (setlistLink) {
          await setlistLink.click();
          await page.waitForTimeout(2000);
          // 곡 항목 클릭해서 악보 보기
          const songItem = await page.$('[class*="cursor-pointer"], button:has-text("보기")');
          if (songItem) {
            await songItem.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    },
    delay: 500
  },

  // ===== 9. 곡 업로드 =====
  {
    name: '09_upload',
    path: '/upload',
    devices: ['desktop', 'mobile'],
    delay: 2000
  },

  // ===== 10. 마이페이지 =====
  {
    name: '10_mypage',
    path: '/my-page',
    devices: ['desktop', 'mobile'],
    delay: 2000
  },

  // ===== 11. 개인 콘티 (Personal) =====
  {
    name: '11_personal',
    path: '/personal',
    devices: ['desktop', 'ipad', 'mobile'],
    delay: 2000
  },

  // ===== 12. 필기 노트 =====
  {
    name: '12_mynotes',
    path: '/my-notes',
    devices: ['desktop', 'mobile'],
    delay: 2000
  },

  // ===== 13. 팀 생성 =====
  {
    name: '13_team_create',
    path: '/teams/create',
    devices: ['desktop', 'mobile'],
    delay: 2000
  },

  // ===== 14. 팀 가입 =====
  {
    name: '14_team_join',
    path: '/teams/join',
    devices: ['desktop', 'mobile'],
    delay: 2000
  },

  // ===== 15. 필터 열린 상태 =====
  {
    name: '15_home_filter_open',
    path: '/',
    devices: ['desktop', 'mobile'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // 필터 버튼 클릭
      const filterBtn = await page.$('button:has-text("필터"), [data-testid="filter-btn"], button[class*="filter"]');
      if (filterBtn) {
        await filterBtn.click();
        await page.waitForTimeout(1000);
      }
    },
    delay: 500
  },

  // ===== 16. AI 검색 결과 =====
  {
    name: '16_ai_search',
    path: '/',
    devices: ['desktop'],
    action: async (page) => {
      await page.waitForTimeout(2000);
      // AI 검색 토글 활성화
      const aiToggle = await page.$('[data-testid="ai-toggle"], input[type="checkbox"], button:has-text("AI")');
      if (aiToggle) {
        await aiToggle.click();
        await page.waitForTimeout(500);
      }
      // 검색어 입력
      const searchInput = await page.$('input[type="search"], input[placeholder*="검색"], input[class*="search"]');
      if (searchInput) {
        await searchInput.fill('감사 찬양');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      }
    },
    delay: 500
  },
];

async function captureScreen(context, screen, viewport, viewportName) {
  const page = await context.newPage();

  try {
    await page.setViewportSize(viewport);

    console.log(`  📷 ${screen.name}_${viewportName} 캡처 중...`);

    // 페이지 이동
    await page.goto(`${BASE_URL}${screen.path}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 추가 대기
    if (screen.delay) {
      await page.waitForTimeout(screen.delay);
    }

    // 커스텀 액션 실행
    if (screen.action) {
      try {
        await screen.action(page);
      } catch (e) {
        console.log(`    ⚠️ 액션 실행 중 에러: ${e.message}`);
      }
    }

    // 스크린샷 저장
    const filename = `${screen.name}_${viewportName}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    await page.screenshot({
      path: filepath,
      fullPage: false
    });

    console.log(`    ✅ 저장됨: ${filename}`);

  } catch (error) {
    console.log(`    ❌ 에러: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function captureLoginPage() {
  console.log('\n📸 로그인/회원가입 페이지 캡처 (비로그인 상태)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // 로그인 페이지
  const loginPage = await context.newPage();
  await loginPage.setViewportSize(VIEWPORTS.desktop);
  await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await loginPage.waitForTimeout(1500);
  await loginPage.screenshot({
    path: path.join(SCREENSHOT_DIR, '17_login_desktop.png'),
    fullPage: false
  });
  console.log('  ✅ 17_login_desktop.png');

  await loginPage.setViewportSize(VIEWPORTS.mobile);
  await loginPage.waitForTimeout(500);
  await loginPage.screenshot({
    path: path.join(SCREENSHOT_DIR, '17_login_mobile.png'),
    fullPage: false
  });
  console.log('  ✅ 17_login_mobile.png');
  await loginPage.close();

  // 회원가입 페이지
  const signupPage = await context.newPage();
  await signupPage.setViewportSize(VIEWPORTS.desktop);
  await signupPage.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await signupPage.waitForTimeout(1500);
  await signupPage.screenshot({
    path: path.join(SCREENSHOT_DIR, '18_signup_desktop.png'),
    fullPage: false
  });
  console.log('  ✅ 18_signup_desktop.png');

  await signupPage.setViewportSize(VIEWPORTS.mobile);
  await signupPage.waitForTimeout(500);
  await signupPage.screenshot({
    path: path.join(SCREENSHOT_DIR, '18_signup_mobile.png'),
    fullPage: false
  });
  console.log('  ✅ 18_signup_mobile.png');

  await browser.close();
}

async function main() {
  // 세션 파일 확인
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('❌ 로그인 세션이 없습니다!');
    console.error('   먼저 npm run screenshot:login 을 실행하세요.\n');
    process.exit(1);
  }

  console.log('🚀 스크린샷 캡처 시작...\n');
  console.log(`📁 저장 위치: ${SCREENSHOT_DIR}`);
  console.log(`📱 총 ${SCREENS.length}개 화면 캡처 예정\n`);

  // 브라우저 시작 (저장된 세션 사용)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: AUTH_FILE
  });

  // 각 화면 캡처
  let capturedCount = 0;
  for (const screen of SCREENS) {
    console.log(`\n📄 [${SCREENS.indexOf(screen) + 1}/${SCREENS.length}] ${screen.name} 화면 캡처 중...`);

    for (const deviceName of screen.devices) {
      const viewport = VIEWPORTS[deviceName];
      await captureScreen(context, screen, viewport, deviceName);
      capturedCount++;
    }
  }

  await browser.close();

  // 로그인/회원가입 페이지 캡처 (별도 컨텍스트)
  await captureLoginPage();
  capturedCount += 4;

  console.log('\n========================================');
  console.log('✨ 모든 스크린샷 캡처 완료!');
  console.log(`📁 저장 위치: ${SCREENSHOT_DIR}`);
  console.log('========================================\n');

  // 캡처된 파일 목록 출력
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`📷 캡처된 파일 (${files.length}개):`);
  files.forEach(f => console.log(`   - ${f}`));
  console.log('');
}

main().catch(console.error);
