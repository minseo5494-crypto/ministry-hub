import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
          <p className="text-gray-500 mb-8">최종 수정일: 2024년 12월 1일</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
              <p className="text-gray-700 leading-relaxed">
                이 약관은 Ministry Hub(이하 "서비스")를 이용함에 있어 서비스와 이용자 간의 
                권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. "서비스"란 Ministry Hub가 제공하는 찬양/예배 관련 곡 관리, 콘티 작성, 
                PDF/PPT 생성 등의 모든 기능을 의미합니다.<br />
                2. "이용자"란 본 약관에 따라 서비스를 이용하는 회원을 의미합니다.<br />
                3. "팀"이란 서비스 내에서 복수의 이용자가 함께 협업할 수 있는 그룹을 의미합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다.<br />
                2. 서비스는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다.<br />
                3. 변경된 약관은 공지사항을 통해 공지되며, 공지 후 7일이 경과한 후부터 효력이 발생합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (회원가입 및 계정)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 이용자는 서비스가 정한 양식에 따라 회원정보를 기입하고, 본 약관에 동의함으로써 
                회원가입을 신청합니다.<br />
                2. 이용자는 가입 시 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 
                제한될 수 있습니다.<br />
                3. 계정 정보의 관리 책임은 이용자에게 있으며, 타인에게 계정을 양도하거나 대여할 수 없습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (서비스의 제공)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 서비스는 다음과 같은 기능을 제공합니다:<br />
                &nbsp;&nbsp;- 찬양곡 검색 및 관리<br />
                &nbsp;&nbsp;- 예배 콘티(세트리스트) 작성<br />
                &nbsp;&nbsp;- PDF 악보 생성 및 다운로드<br />
                &nbsp;&nbsp;- PPT 가사 슬라이드 생성<br />
                &nbsp;&nbsp;- 팀 협업 기능<br />
                2. 서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 하나, 시스템 점검 등의 
                사유로 일시 중단될 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (저작권)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 서비스에 등록된 찬양곡의 저작권은 해당 저작권자에게 있습니다.<br />
                2. 이용자가 업로드한 콘텐츠의 저작권은 해당 이용자에게 있습니다.<br />
                3. 이용자는 저작권법을 준수해야 하며, 타인의 저작권을 침해하는 행위를 해서는 안 됩니다.<br />
                4. 서비스는 예배 및 찬양 목적으로 사용되는 것을 전제로 하며, 상업적 목적의 
                무단 사용은 금지됩니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (이용자의 의무)</h2>
              <p className="text-gray-700 leading-relaxed">
                이용자는 다음 행위를 해서는 안 됩니다:<br />
                1. 타인의 정보 도용<br />
                2. 서비스의 운영을 방해하는 행위<br />
                3. 서비스를 이용한 영리 활동<br />
                4. 기타 관련 법령에 위배되는 행위
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (면책조항)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 서비스는 무료로 제공되며, 천재지변 또는 이에 준하는 불가항력으로 인해 
                서비스를 제공할 수 없는 경우 책임이 면제됩니다.<br />
                2. 이용자의 귀책사유로 인한 서비스 이용 장애에 대해서는 책임지지 않습니다.<br />
                3. 이용자가 게재한 정보의 신뢰도, 정확성에 대해서는 책임지지 않습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">제9조 (분쟁해결)</h2>
              <p className="text-gray-700 leading-relaxed">
                1. 서비스 이용과 관련하여 분쟁이 발생한 경우, 쌍방 간의 협의에 의해 해결합니다.<br />
                2. 협의가 이루어지지 않을 경우, 관할 법원에 소를 제기할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">부칙</h2>
              <p className="text-gray-700 leading-relaxed">
                본 약관은 2024년 12월 1일부터 시행됩니다.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}