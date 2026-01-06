import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로가기 */}
        <Link
          href="/signup"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} className="mr-1" />
          회원가입으로 돌아가기
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
          <p className="text-gray-500 mb-8">최종 수정일: 2024년 12월 1일</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 개인정보의 수집 및 이용 목적</h2>
              <p className="text-gray-700 leading-relaxed">
                WORSHEEP(이하 "서비스")은 다음의 목적을 위해 개인정보를 수집 및 이용합니다:
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 개인식별</li>
                <li>서비스 제공: 찬양곡 관리, 콘티 작성, PDF/PPT 생성 기능 제공</li>
                <li>팀 협업: 팀 구성원 간 협업 기능 지원</li>
                <li>서비스 개선: 서비스 이용 통계 분석 및 개선</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 수집하는 개인정보 항목</h2>
              <p className="text-gray-700 leading-relaxed">
                <strong>필수 항목:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>이메일 주소</li>
                <li>비밀번호 (암호화 저장)</li>
                <li>이름</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>선택 항목:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>교회명</li>
                <li>프로필 이미지 (Google 로그인 시)</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>자동 수집 항목:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>서비스 이용 기록 (검색, 다운로드 등)</li>
                <li>접속 일시</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 회원 탈퇴 시 즉시 파기됩니다.<br />
                2. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관됩니다:<br />
                &nbsp;&nbsp;- 서비스 이용 기록: 3개월 (통신비밀보호법)
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
              <p className="text-gray-700 leading-relaxed">
                서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 
                다만, 다음의 경우는 예외로 합니다:
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차에 따라 요청이 있는 경우</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 개인정보의 안전성 확보 조치</h2>
              <p className="text-gray-700 leading-relaxed">
                서비스는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>비밀번호 암호화 저장</li>
                <li>SSL/TLS를 통한 데이터 전송 암호화</li>
                <li>Supabase의 보안 기능 활용 (Row Level Security)</li>
                <li>정기적인 보안 점검</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 이용자의 권리</h2>
              <p className="text-gray-700 leading-relaxed">
                이용자는 언제든지 다음의 권리를 행사할 수 있습니다:
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>개인정보 열람 요청</li>
                <li>개인정보 정정·삭제 요청</li>
                <li>개인정보 처리정지 요청</li>
                <li>회원 탈퇴</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-2">
                위 권리 행사는 서비스 내 설정 메뉴 또는 이메일을 통해 가능합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 쿠키(Cookie)의 사용</h2>
              <p className="text-gray-700 leading-relaxed">
                서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다. 
                이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 
                이 경우 서비스 이용에 제한이 있을 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. 개인정보 보호책임자</h2>
              <p className="text-gray-700 leading-relaxed">
                개인정보 처리에 관한 업무를 총괄하고, 개인정보 처리와 관련한 불만처리 및 
                피해구제를 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mt-3">
                <p className="text-gray-700">
                  <strong>담당자:</strong> WORSHEEP 운영팀<br />
                  <strong>이메일:</strong> support@worsheep.com
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. 개인정보처리방침의 변경</h2>
              <p className="text-gray-700 leading-relaxed">
                본 개인정보처리방침은 법령, 정책 또는 서비스 변경에 따라 수정될 수 있으며, 
                변경 시 서비스 공지사항을 통해 안내드립니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">부칙</h2>
              <p className="text-gray-700 leading-relaxed">
                본 개인정보처리방침은 2024년 12월 1일부터 시행됩니다.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}