export type Section = 'work' | 'project' | 'education' | 'skill' | 'award';
export const SECTIONS: Section[] = ['work', 'project', 'education', 'skill', 'award'];
export const SECTION_LABELS: Record<Section, string> = {
  work: '工作经历', project: '项目经历', education: '教育背景', skill: '技能特长', award: '荣誉奖项',
};
export interface ProfileItem {
  id: number; section: Section; heading: string; period: string;
  bullets: string[]; sort_order: number; created_at: string; updated_at: string;
}
export interface ProfileVersionSnap { heading: string; bullets: string[] }
export interface ProfileVersion {
  id: number; item_id: number; snapshot: ProfileVersionSnap; trigger: string; created_at: string;
}
export interface Material { id: number; title: string; content: string; tags: string[]; source: string; created_at: string; updated_at: string }
export interface Jd { id: number; company: string; title: string; raw_text: string; summary: { requirements: string[]; responsibilities: string[] }; analyzed: number; recommended: RecommendedItem[]; chosen_items: number[]; overrides: Record<string, { bullets: string[] }>; status: string; created_at: string }
export interface RecommendedItem { item_id: number; score: number; reason: string }
export interface ResumeItemView { item_id: number; section: string; heading: string; period: string; bullets: string[] }
export interface Suggestion { bullet_index: number; new_text: string; star_label: string; reason: string; status: 'pending' | 'accepted' | 'rejected' }
export interface CoachRun { id: number; jd_id: number; item_id: number; original_bullets: string[]; suggestions: Suggestion[]; backfilled: number }
export interface MatchResult { hits: string[]; missing: string[]; coveragePct: number; total: number }
export interface PlanWeek { week: number; focus: string; tasks: { text: string; done: boolean }[]; projects?: { name: string; url: string; deliverable: string }[] }
export interface ExamQuestion { id: number; jd_id: number; category: string; question: string; hint: string }
export interface Keyword { id: number; term: string; category: string; note: string; totalFrequency: number; jdCount: number }
export const CAT_LABELS: Record<string, string> = { hard_skill: '硬技能', soft_skill: '软素质', business: '业务词' };
