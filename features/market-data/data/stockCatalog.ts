export interface CatalogEntry {
  ticker: string;
  name: string;
  marketType: 'KOSPI' | 'KOSDAQ' | '기타';
  type?: 'stock' | 'etf' | 'index';
}

// ── Catalog ───────────────────────────────────────────────────────────────────
// Covers all app-tracked tickers plus major KOSPI/KOSDAQ constituents.
// Source: KRX official listings (as of 2026 Q1).
// Add new entries at the bottom of each section; do not reorder existing rows.

export const STOCK_CATALOG: CatalogEntry[] = [
  // ── 반도체 (KOSPI) ─────────────────────────────────────────────────────────
  { ticker: '005930', name: '삼성전자',       marketType: 'KOSPI'  },
  { ticker: '000660', name: 'SK하이닉스',      marketType: 'KOSPI'  },
  { ticker: '009150', name: '삼성전기',        marketType: 'KOSPI'  },
  { ticker: '007660', name: '이수페타시스',    marketType: 'KOSPI'  },
  { ticker: '000990', name: 'DB하이텍',        marketType: 'KOSPI'  },

  // ── 반도체 (KOSDAQ) ────────────────────────────────────────────────────────
  { ticker: '042700', name: '한미반도체',      marketType: 'KOSDAQ' },
  { ticker: '058470', name: '리노공업',        marketType: 'KOSDAQ' },
  { ticker: '240810', name: '원익IPS',         marketType: 'KOSDAQ' },
  { ticker: '036930', name: '주성엔지니어링',  marketType: 'KOSDAQ' },
  { ticker: '089030', name: '테크윙',          marketType: 'KOSDAQ' },
  { ticker: '357780', name: '솔브레인',        marketType: 'KOSDAQ' },
  { ticker: '005290', name: '동진쎄미켐',      marketType: 'KOSDAQ' },
  { ticker: '039030', name: '이오테크닉스',    marketType: 'KOSDAQ' },
  { ticker: '033640', name: '네패스',          marketType: 'KOSDAQ' },
  { ticker: '319660', name: '피에스케이',      marketType: 'KOSDAQ' },

  // ── 2차전지 (KOSPI) ────────────────────────────────────────────────────────
  { ticker: '373220', name: 'LG에너지솔루션',  marketType: 'KOSPI'  },
  { ticker: '006400', name: '삼성SDI',         marketType: 'KOSPI'  },
  { ticker: '003670', name: '포스코퓨처엠',    marketType: 'KOSPI'  },
  { ticker: '096770', name: 'SK이노베이션',    marketType: 'KOSPI'  },

  // ── 2차전지 (KOSDAQ) ───────────────────────────────────────────────────────
  { ticker: '086520', name: '에코프로',        marketType: 'KOSDAQ' },
  { ticker: '247540', name: '에코프로비엠',    marketType: 'KOSDAQ' },
  { ticker: '278280', name: '천보',            marketType: 'KOSDAQ' },
  { ticker: '066970', name: '엘앤에프',        marketType: 'KOSDAQ' },
  { ticker: '020150', name: '일진머티리얼즈',  marketType: 'KOSDAQ' },
  { ticker: '005070', name: '코스모신소재',    marketType: 'KOSDAQ' },

  // ── 바이오/제약 (KOSPI) ────────────────────────────────────────────────────
  { ticker: '068270', name: '셀트리온',        marketType: 'KOSPI'  },
  { ticker: '128940', name: '한미약품',        marketType: 'KOSPI'  },
  { ticker: '000100', name: '유한양행',        marketType: 'KOSPI'  },
  { ticker: '207940', name: '삼성바이오로직스', marketType: 'KOSPI' },
  { ticker: '326030', name: 'SK바이오팜',      marketType: 'KOSPI'  },
  { ticker: '302440', name: 'SK바이오사이언스', marketType: 'KOSPI' },

  // ── 바이오/제약 (KOSDAQ) ───────────────────────────────────────────────────
  { ticker: '196170', name: '알테오젠',        marketType: 'KOSDAQ' },
  { ticker: '028300', name: 'HLB',             marketType: 'KOSDAQ' },
  { ticker: '237690', name: '에스티팜',        marketType: 'KOSDAQ' },
  { ticker: '096530', name: '씨젠',            marketType: 'KOSDAQ' },
  { ticker: '214450', name: '파마리서치',      marketType: 'KOSDAQ' },
  { ticker: '145020', name: '휴젤',            marketType: 'KOSDAQ' },
  { ticker: '000080', name: '하이트진로',      marketType: 'KOSPI'  },

  // ── 자동차 (KOSPI) ─────────────────────────────────────────────────────────
  { ticker: '005380', name: '현대자동차',      marketType: 'KOSPI'  },
  { ticker: '000270', name: '기아',            marketType: 'KOSPI'  },
  { ticker: '012330', name: '현대모비스',      marketType: 'KOSPI'  },
  { ticker: '011210', name: '현대위아',        marketType: 'KOSPI'  },
  { ticker: '161390', name: '한국타이어앤테크놀로지', marketType: 'KOSPI' },
  { ticker: '010120', name: 'LS ELECTRIC',     marketType: 'KOSPI'  },

  // ── 플랫폼/IT (KOSPI) ──────────────────────────────────────────────────────
  { ticker: '035720', name: '카카오',          marketType: 'KOSPI'  },
  { ticker: '035420', name: '네이버',           marketType: 'KOSPI'  },
  { ticker: '323410', name: '카카오뱅크',      marketType: 'KOSPI'  },
  { ticker: '377300', name: '카카오페이',      marketType: 'KOSPI'  },
  { ticker: '018260', name: '삼성에스디에스',  marketType: 'KOSPI'  },

  // ── 플랫폼/엔터/게임 (KOSDAQ) ─────────────────────────────────────────────
  { ticker: '035900', name: 'JYP Ent.',        marketType: 'KOSDAQ' },
  { ticker: '122870', name: 'YG엔터테인먼트',  marketType: 'KOSDAQ' },
  { ticker: '041510', name: 'SM엔터테인먼트',  marketType: 'KOSDAQ' },
  { ticker: '293490', name: '카카오게임즈',    marketType: 'KOSDAQ' },
  { ticker: '263750', name: '펄어비스',        marketType: 'KOSDAQ' },

  // ── 게임 (KOSPI) ───────────────────────────────────────────────────────────
  { ticker: '259960', name: '크래프톤',        marketType: 'KOSPI'  },
  { ticker: '352820', name: '하이브',          marketType: 'KOSPI'  },
  { ticker: '036570', name: '엔씨소프트',      marketType: 'KOSPI'  },
  { ticker: '251270', name: '넷마블',          marketType: 'KOSPI'  },

  // ── 조선 (KOSPI) ───────────────────────────────────────────────────────────
  { ticker: '329180', name: 'HD현대중공업',    marketType: 'KOSPI'  },
  { ticker: '042660', name: '한화오션',        marketType: 'KOSPI'  },
  { ticker: '010140', name: '삼성중공업',      marketType: 'KOSPI'  },
  { ticker: '010620', name: 'HD현대미포',      marketType: 'KOSPI'  },
  { ticker: '009540', name: 'HD한국조선해양',  marketType: 'KOSPI'  },

  // ── 로봇/항공우주 (KOSPI) ──────────────────────────────────────────────────
  { ticker: '454910', name: '두산로보틱스',    marketType: 'KOSPI'  },
  { ticker: '047810', name: '한국항공우주',    marketType: 'KOSPI'  },
  { ticker: '012450', name: '한화에어로스페이스', marketType: 'KOSPI' },

  // ── 로봇 (KOSDAQ) ──────────────────────────────────────────────────────────
  { ticker: '277810', name: '레인보우로보틱스', marketType: 'KOSDAQ' },
  { ticker: '388790', name: '에스비비테크',    marketType: 'KOSDAQ' },

  // ── 금융 (KOSPI) ───────────────────────────────────────────────────────────
  { ticker: '105560', name: 'KB금융',          marketType: 'KOSPI'  },
  { ticker: '086790', name: '하나금융지주',    marketType: 'KOSPI'  },
  { ticker: '055550', name: '신한지주',        marketType: 'KOSPI'  },
  { ticker: '316140', name: '우리금융지주',    marketType: 'KOSPI'  },
  { ticker: '032830', name: '삼성생명',        marketType: 'KOSPI'  },
  { ticker: '000810', name: '삼성화재',        marketType: 'KOSPI'  },
  { ticker: '138040', name: '메리츠금융지주',  marketType: 'KOSPI'  },
  { ticker: '005940', name: 'NH투자증권',      marketType: 'KOSPI'  },
  { ticker: '071050', name: '한국금융지주',    marketType: 'KOSPI'  },

  // ── 에너지/소재 (KOSPI) ────────────────────────────────────────────────────
  { ticker: '005490', name: '포스코홀딩스',    marketType: 'KOSPI'  },
  { ticker: '051910', name: 'LG화학',          marketType: 'KOSPI'  },
  { ticker: '034020', name: '두산에너빌리티',  marketType: 'KOSPI'  },
  { ticker: '010130', name: '고려아연',        marketType: 'KOSPI'  },
  { ticker: '011170', name: '롯데케미칼',      marketType: 'KOSPI'  },

  // ── 에너지 (KOSDAQ) ────────────────────────────────────────────────────────
  { ticker: '336260', name: '두산퓨얼셀',      marketType: 'KOSDAQ' },
  { ticker: '950130', name: '에코앤드림',      marketType: 'KOSDAQ' },

  // ── 통신/인프라 (KOSPI) ────────────────────────────────────────────────────
  { ticker: '017670', name: 'SK텔레콤',        marketType: 'KOSPI'  },
  { ticker: '030200', name: 'KT',              marketType: 'KOSPI'  },
  { ticker: '015760', name: '한국전력',        marketType: 'KOSPI'  },

  // ── 대형 지주/복합 (KOSPI) ─────────────────────────────────────────────────
  { ticker: '003550', name: 'LG',              marketType: 'KOSPI'  },
  { ticker: '066570', name: 'LG전자',          marketType: 'KOSPI'  },
  { ticker: '034730', name: 'SK',              marketType: 'KOSPI'  },
  { ticker: '028260', name: '삼성물산',        marketType: 'KOSPI'  },
  { ticker: '000720', name: '현대건설',        marketType: 'KOSPI'  },
  { ticker: '267250', name: 'HD현대',          marketType: 'KOSPI'  },
];

// ── Search ────────────────────────────────────────────────────────────────────

function score(entry: CatalogEntry, q: string): number {
  const name = entry.name.toLowerCase();
  const ticker = entry.ticker;

  if (ticker === q) return 100;             // exact ticker
  if (ticker.startsWith(q)) return 80;      // ticker prefix
  if (name === q) return 90;                // exact name
  if (name.startsWith(q)) return 70;        // name prefix
  if (name.includes(q)) return 40;          // name contains
  return 0;
}

export function searchCatalog(query: string, limit = 20): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return STOCK_CATALOG
    .map((entry) => ({ entry, s: score(entry, q) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.entry.name.length - b.entry.name.length)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function searchAll(query: string, catalogs: CatalogEntry[], limit = 20): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return catalogs
    .map((entry) => ({ entry, s: score(entry, q) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.entry.name.length - b.entry.name.length)
    .slice(0, limit)
    .map(({ entry }) => entry);
}
