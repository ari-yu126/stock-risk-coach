export interface ThemeDefinition {
  id: string;
  name: string;
  /** Must match ≥ 1 strong keyword OR ≥ 2 weak keywords (after exclusion check) */
  strongKeywords: string[];
  weakKeywords: string[];
  /** Presence of any exclusion keyword disqualifies the article immediately */
  exclusionKeywords: string[];
  positiveSignals: string[];
  negativeSignals: string[];
}

export const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'semiconductor',
    name: '반도체 / HBM',
    strongKeywords: [
      'HBM', 'D램', '낸드', '파운드리', '웨이퍼', '삼성전자 DS', '시스템반도체', 'TSMC',
    ],
    weakKeywords: [
      '반도체', '메모리', 'SK하이닉스', '삼성전자',
    ],
    exclusionKeywords: [],
    positiveSignals: [
      '회복', '상승', '수주', '흑자', '확대', '증가', '호조', '수혜', '성장',
      '양산', '반등', '상향', '돌파', '개선',
    ],
    negativeSignals: [
      '하락', '부진', '적자', '감소', '우려', '둔화', '지연', '위축', '악화',
      '감산', '재고',
    ],
  },
  {
    id: 'ai-datacenter',
    name: 'AI 데이터센터',
    strongKeywords: [
      '데이터센터', 'GPU', '엔비디아', 'GB200', 'AI 인프라', 'NPU', '하이퍼클로바',
    ],
    weakKeywords: [
      'AI', '인공지능', 'LLM', '클라우드',
    ],
    exclusionKeywords: [],
    positiveSignals: [
      '투자', '확대', '성장', '증가', '수주', '개발', '출시', '돌파', '구축', '공급',
    ],
    negativeSignals: [
      '부족', '제한', '규제', '감소', '우려', '둔화', '병목', '전력난',
    ],
  },
  {
    id: 'battery',
    name: '2차전지',
    strongKeywords: [
      '2차전지', '배터리', '리튬', '양극재', '전고체', '음극재', '배터리 소재',
    ],
    weakKeywords: [
      'LG에너지솔루션', '에코프로', '포스코퓨처엠', '셀',
    ],
    exclusionKeywords: [],
    positiveSignals: [
      '회복', '반등', '상승', '증가', '개선', '성장', '수주', '확대', '공급', '완료', '양산',
    ],
    negativeSignals: [
      '하락', '재고', '둔화', '감소', '부진', '우려', '지연', '적자', '조정',
    ],
  },
  {
    id: 'bio',
    name: '바이오 / 임상',
    strongKeywords: [
      '임상', '신약', '식약처', '항체', '치료제', '바이오시밀러', 'GLP-1', '기술수출',
    ],
    weakKeywords: [
      '바이오', '제약', '한미약품', '셀트리온', '유한양행',
    ],
    exclusionKeywords: [],
    positiveSignals: [
      '승인', '성공', '돌파', '완료', '수출', '계약', '경신', '성장', '진입', '허가', '상회',
    ],
    negativeSignals: [
      '실패', '중단', '취소', '우려', '부작용', '지연', '반려',
    ],
  },
  {
    id: 'auto',
    name: '자동차 / 전기차',
    strongKeywords: [
      '전기차', 'EV', '자율주행', '전기 SUV',
    ],
    weakKeywords: [
      '자동차', '현대차', '기아', '완성차', '내연기관',
    ],
    exclusionKeywords: [],
    positiveSignals: [
      '증가', '상승', '호조', '돌파', '성장', '확대', '수혜', '선전', '흑자',
    ],
    negativeSignals: [
      '감소', '둔화', '하락', '보조금', '축소', '지연', '부진', '감산',
    ],
  },
  {
    id: 'platform',
    name: '플랫폼 규제',
    strongKeywords: [
      '공정위', '독점', '빅테크 규제', '온라인 플랫폼', '과징금', '네이버 규제',
    ],
    weakKeywords: [
      '플랫폼', '카카오', '네이버',
    ],
    exclusionKeywords: [],
    positiveSignals: ['완화', '해소', '협력'],
    negativeSignals: [
      '규제', '과징금', '제재', '조사', '압박', '강화', '위반', '처벌',
    ],
  },
  {
    id: 'market-flow',
    name: '국내 증시 / 수급',
    strongKeywords: [
      '코스피', '코스닥', '순매수', '순매도', '수급',
    ],
    weakKeywords: [
      '외국인', '기관', '증시', '증권',
    ],
    exclusionKeywords: [],
    positiveSignals: [
      '순매수', '상승', '회복', '강세', '상향', '돌파', '반등',
    ],
    negativeSignals: [
      '순매도', '하락', '약세', '이탈', '매도', '우려', '급락',
    ],
  },
];
