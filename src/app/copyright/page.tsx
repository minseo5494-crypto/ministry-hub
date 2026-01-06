import Link from 'next/link'
import { ArrowLeft, Shield, AlertTriangle, Mail, CheckCircle } from 'lucide-react'

export default function CopyrightPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로가기 */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} className="mr-1" />
          메인으로 돌아가기
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">저작권 정책</h1>
          </div>
          <p className="text-gray-500 mb-8">최종 수정일: 2024년 12월</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* 개요 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">개요</h2>
              <p className="text-gray-700 leading-relaxed">
                WORSHEEP(이하 "서비스")은 저작권을 존중하며, 저작권법 및 관련 법령을 준수합니다.
                본 정책은 서비스 내 악보 콘텐츠의 저작권 보호와 관련된 사항을 안내합니다.
              </p>
            </section>

            {/* 악보 분류 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">악보 분류</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                서비스 내 악보는 다음과 같이 분류됩니다:
              </p>

              <div className="space-y-4">
                {/* 공식 악보 */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">공식 악보</h3>
                  </div>
                  <p className="text-sm text-green-800">
                    저작권자 또는 권리자와 정식 계약을 통해 제공되는 악보입니다. 
                    서비스는 해당 악보의 이용에 대해 적법한 권리를 확보하고 있습니다.
                  </p>
                </div>

                {/* 사용자 악보 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">사용자 악보 (UGC)</h3>
                  </div>
                  <p className="text-sm text-yellow-800">
                    이용자가 직접 업로드한 악보입니다. 해당 악보의 저작권 적법성에 대한 
                    책임은 업로드한 이용자에게 있습니다. 서비스는 온라인서비스제공자로서 
                    저작권 침해 신고 접수 시 해당 콘텐츠를 삭제합니다.
                  </p>
                </div>

                {/* 퍼블릭 도메인 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">퍼블릭 도메인</h3>
                  </div>
                  <p className="text-sm text-blue-800">
                    저작권 보호 기간이 만료된 악보입니다. 대한민국 저작권법에 따라 
                    저작자 사후 70년이 경과한 저작물이 이에 해당합니다.
                  </p>
                </div>
              </div>
            </section>

            {/* 저작권 침해 신고 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">저작권 침해 신고</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                본인의 저작물이 서비스 내에서 무단으로 사용되고 있다고 판단되는 경우, 
                아래 절차에 따라 신고해 주시기 바랍니다.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-3">신고 시 필요한 정보</h3>
                <ol className="list-decimal list-inside text-gray-700 space-y-2">
                  <li><strong>신고자 정보:</strong> 이름, 연락처, 이메일</li>
                  <li><strong>저작권자 확인:</strong> 본인이 저작권자임을 증명하는 자료 또는 대리인 위임장</li>
                  <li><strong>침해 콘텐츠 특정:</strong> 해당 악보의 제목, URL 등 식별 정보</li>
                  <li><strong>원저작물 정보:</strong> 원곡명, 작곡자/작사자, 출처 등</li>
                  <li><strong>요청 사항:</strong> 삭제 요청 또는 기타 조치 요청</li>
                </ol>
              </div>

              <div className="flex items-center gap-3 mt-4 p-4 bg-blue-50 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">신고 접수처</p>
                  <a href="mailto:copyright@worsheep.com" className="text-blue-600 hover:underline">
                    copyright@worsheep.com
                  </a>
                </div>
              </div>
            </section>

            {/* 처리 절차 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">처리 절차</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <div>
                    <p className="font-medium text-gray-900">신고 접수</p>
                    <p className="text-sm text-gray-600">이메일을 통해 저작권 침해 신고를 접수합니다.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <div>
                    <p className="font-medium text-gray-900">검토 (3영업일 이내)</p>
                    <p className="text-sm text-gray-600">신고 내용의 타당성을 검토합니다.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <div>
                    <p className="font-medium text-gray-900">조치</p>
                    <p className="text-sm text-gray-600">침해가 확인되면 해당 콘텐츠를 삭제하고, 업로더에게 통지합니다.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  <div>
                    <p className="font-medium text-gray-900">결과 통보</p>
                    <p className="text-sm text-gray-600">신고자에게 처리 결과를 이메일로 통보합니다.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 반복 침해자 정책 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">반복 침해자 정책</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                서비스는 저작권을 반복적으로 침해하는 이용자에 대해 다음과 같은 조치를 취합니다:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <ul className="space-y-2 text-red-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1차:</span>
                    <span>경고 및 해당 콘텐츠 삭제</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2차:</span>
                    <span>업로드 기능 30일 제한</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3차:</span>
                    <span>계정 영구 정지</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 이의 제기 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">이의 제기</h2>
              <p className="text-gray-700 leading-relaxed">
                저작권 침해 신고로 인해 본인의 콘텐츠가 삭제되었으나, 정당한 권리가 있다고 
                판단되는 경우, 동일한 이메일 주소로 이의를 제기할 수 있습니다. 
                이의 제기 시 해당 콘텐츠에 대한 적법한 권리를 증명하는 자료를 함께 제출해 주시기 바랍니다.
              </p>
            </section>

            {/* 파트너십 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">공식 악보 파트너십</h2>
              <p className="text-gray-700 leading-relaxed">
                찬양팀, 음악 출판사, 개인 작곡가/작사자분들의 공식 파트너십 문의를 환영합니다. 
                파트너십을 통해 귀하의 악보를 공식 콘텐츠로 제공하고, 사용량에 따른 수익을 
                배분받을 수 있습니다.
              </p>
              <div className="flex items-center gap-3 mt-4 p-4 bg-green-50 rounded-lg">
                <Mail className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900">파트너십 문의</p>
                  <a href="mailto:partnership@worsheep.com" className="text-green-600 hover:underline">
                    partnership@worsheep.com
                  </a>
                </div>
              </div>
            </section>

            {/* 관련 문서 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">관련 문서</h2>
              <div className="flex flex-col gap-2">
                <Link href="/terms" className="text-blue-600 hover:underline">
                  → 이용약관
                </Link>
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  → 개인정보처리방침
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}