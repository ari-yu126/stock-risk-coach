import { MarketBriefing } from '../types';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const MOCK_BRIEFING: MarketBriefing = {
  date: todayISO(),
  summary:
    '반도체 섹터는 AI 데이터센터 투자 기대감으로 강세. 2차전지는 중국 보조금 이슈와 에코프로 유상증자 공시로 변동성 확대. 바이오는 셀트리온 임상 결과 발표 대기로 불확실성 높음. 전반적으로 섹터별 온도차가 뚜렷한 혼조 장세.',
  keyThemes: ['AI 반도체', '2차전지 변동성', '바이오 임상', 'IT 플랫폼 규제'],
  overallSentiment: 'mixed',
};

/** Briefing with the current local date (for "오늘 시장 브리핑" header). */
export function getTodayBriefing(): MarketBriefing {
  return { ...MOCK_BRIEFING, date: todayISO() };
}
