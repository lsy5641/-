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
