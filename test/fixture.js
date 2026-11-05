// 삼성 커리어스 지원서 미리보기 모달의 DOM 구조를 재현한 테스트 픽스처.
// 실측한 클래스 구조를 그대로 따르되, 내용은 전부 가공의 인물/데이터입니다.
export const HTML = `
<main class="application">
  <!-- 모달 뒤의 편집 폼. 같은 클래스명을 쓰므로 파서가 이것을 집으면 안 된다. -->
  <div class="container">
    <div class="pageTitle"><h2 id="recseqnm">배경 편집 폼 제목 (파서가 읽으면 안 됨)</h2></div>
    <div class="group"><div class="dl"><h4 class="dt">배경필드</h4><p class="dd">배경값</p></div></div>
  </div>

  <div id="formPreview" class="modalWrap full">
    <div class="modal">
      <div class="modalBody full">
        <div class="container">

          <p class="info"><span>[샘플전자]</span><span>AB - 가나다사업부</span><span>시스템 소프트웨어</span></p>
          <h2>20XX년 상반기 신입사원 채용 공고 (샘플부문)</h2>

          <h3 class="groupTitle hope">지원 부문/직무/지역</h3>
          <div class="group hope">
            <div class="dl"><h4 class="dt">지원부문</h4>
              <p class="dd"><span>AB - 가나다사업부</span><span>AB - 라마바사업부</span><span>AB - Sample Research</span></p></div>
            <div class="dl"><h4 class="dt">지원직군</h4></div>
            <div class="dl"><h4 class="dt">지원직무</h4>
              <p class="dd"><span>시스템 소프트웨어</span><span>시스템 소프트웨어</span><span>응용 소프트웨어</span></p></div>
            <div class="dl"><h4 class="dt">희망근무지역</h4>
              <p class="dd"><span>어딘가</span><span>어딘가</span><span>다른곳</span></p></div>
          </div>

          <h3 class="groupTitle">기본 인적사항</h3>
          <div class="group">
            <div class="dl"><h4 class="dt">지원자</h4><p class="dd">홍길동</p></div>
            <div class="dl mFull"><h4 class="dt">주소</h4>
              <p class="dd"><span>국내</span><span>어느도 어느시 어느로 1 (샘플동) 101동 101호</span></p></div>
            <div class="dl"><h4 class="dt">휴대폰 번호</h4><p class="dd">+82-010-0000-0000</p></div>
            <div class="dl"><h4 class="dt">영문 이름</h4><p class="dd">HONG GILDONG</p></div>
            <div class="dl"><h4 class="dt">생년월일</h4><p class="dd">2000.01.01</p></div>
            <div class="dl"><h4 class="dt">이메일</h4><p class="dd">gildong@example.com</p></div>
            <div class="photo"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="증명사진"></div>
          </div>

          <h3 class="groupTitle">이수교과목</h3>
          <div class="group">
            <div class="tableWrap maj majdets gtUni">
              <table class="table majsumrys">
                <tr><th>과정</th><th>전공</th><th>학교</th></tr>
                <tr><td>학사</td><td>샘플공학</td><td>샘플대</td></tr>
              </table>
              <table class="table">
                <tr><th>과정</th><th>전공명</th><th>수강연도</th><th>학기</th><th>과목유형</th><th>과목명</th><th>취득학점</th><th>성적</th><th>재수강 여부</th></tr>
                <tr><td>학사</td><td>샘플공학(샘플대-학사-주전공)</td><td>2020</td><td>1</td><td>전공</td><td>가전공과목</td><td>3</td><td>A+</td><td>N</td></tr>
                <tr><td>학사</td><td>샘플공학(샘플대-학사-주전공)</td><td>2020</td><td>2</td><td>전공</td><td>나전공과목</td><td>3</td><td>A</td><td>N</td></tr>
                <tr><td>학사</td><td>샘플공학(샘플대-학사-주전공)</td><td>2021</td><td>1</td><td>전공</td><td>다전공과목</td><td>4</td><td>B+</td><td>N</td></tr>
                <tr><td>학사</td><td>샘플공학(샘플대-학사-주전공)</td><td>2020</td><td>1</td><td>교양기타</td><td>가교양과목</td><td>2</td><td>PASS</td><td>N</td></tr>
                <tr><td>학사</td><td>샘플공학(샘플대-학사-주전공)</td><td>2021</td><td>2</td><td>교양기타</td><td>나교양과목</td><td>3</td><td>A</td><td>N</td></tr>
              </table>
            </div>
          </div>

          <h3 class="groupTitle">직무관련 경력</h3>
          <div class="group">
            <div class="tableWrap carr bl_carrs">
              <table class="table">
                <tr><th>회사명</th><th>입사일 / 퇴사일</th><th>부서명 / 직무</th><th>경력 상세 설명</th></tr>
                <tr><td>[기타]샘플회사</td><td>2024-01 ~ 2024-12</td><td>샘플팀 / 엔지니어</td><td>1. 첫 번째 업무
2. 두 번째 업무</td></tr>
              </table>
            </div>
          </div>

          <h3 class="groupTitle">에세이</h3>
          <div class="group">
            <div class="dl mFull">
              <h4 class="dt">지원 동기를 기술하십시오.</h4>
              <p class="dd">[첫 번째 소제목]
첫 문단입니다. 이 문장은 충분히 길어서 줄바꿈이 보존되는지 확인하는 용도로 쓰입니다.

[두 번째 소제목]
두 번째 문단입니다.</p>
            </div>
            <div class="dl mFull">
              <h4 class="dt">성장과정을 기술하십시오.</h4>
              <p class="dd">[성장 소제목]
성장과정 본문입니다.</p>
            </div>
            <!-- 문항에 '전공'이 들어 있어도 마스킹 대상이 아니다. 본문 속 학교·전공·이름은 가려져야 한다. -->
            <div class="dl mFull">
              <h4 class="dt">전공 역량을 기술하십시오.</h4>
              <p class="dd">[전공 소제목]
샘플대 샘플공학 수업에서 HONG GILDONG 이라는 이름으로 발표했습니다.

샘플회사 인턴 때 배운 점도 적습니다.</p>
            </div>
          </div>

          <!-- 렌더링되지 않는 숨김 섹션. 파서가 건너뛰어야 한다. -->
          <h3 class="groupTitle" style="display:none">숨겨진 섹션</h3>
          <div class="group" style="display:none">
            <div class="dl"><h4 class="dt">숨김필드</h4><p class="dd">숨김값</p></div>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- 닫혀 있는 다른 모달들. display:none 이므로 무시돼야 한다. -->
  <div id="signinForm" class="modalWrap full" style="display:none">
    <div class="modal"><div class="modalBody"><div class="container">
      <h2>로그인</h2><div class="dl"><h4 class="dt">아이디</h4><p class="dd">있으면 안 되는 값</p></div>
    </div></div></div>
  </div>
</main>
`;
