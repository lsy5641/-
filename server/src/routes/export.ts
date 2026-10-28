import { Router } from 'express';
import { Database } from '../db';
import { fail } from '../http';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface ItemRow { id: number; section: string; heading: string; period: string; bullets: string }
interface JdRow { id: number; company: string; title: string; chosen_items: string; overrides: string }

const SECTION_LABELS: Record<string, string> = { work: '工作经历', project: '项目经历', education: '教育背景', skill: '技能特长', award: '荣誉奖项' };

export function exportRouter(db: Database): Router {
  const r = Router();

  r.get('/docx/:jdId', async (req, res) => {
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(Number(req.params.jdId)) as JdRow | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    const chosen = JSON.parse(jd.chosen_items) as number[];
    const overrides = JSON.parse(jd.overrides) as Record<string, { bullets: string[] }>;
    const rows = db.prepare('SELECT * FROM profile_items ORDER BY section, sort_order, id').all() as unknown as ItemRow[];
    const items = rows.filter((i) => chosen.includes(i.id));

    const children: Paragraph[] = [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${jd.company} · ${jd.title}`, bold: true, size: 36 })] }),
      new Paragraph({ text: '' }),
    ];
    for (const sec of ['work', 'project', 'education', 'skill', 'award']) {
      const group = items.filter((i) => i.section === sec);
      if (!group.length) continue;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: SECTION_LABELS[sec], bold: true, size: 26 })] }));
      for (const it of group) {
        children.push(new Paragraph({ children: [new TextRun({ text: `${it.heading}${it.period ? '  ' + it.period : ''}`, bold: true, size: 22 })] }));
        const bullets = overrides[String(it.id)]?.bullets ?? (JSON.parse(it.bullets) as string[]);
        for (const b of bullets) children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
      }
    }
    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="resume-${jd.id}.docx"`);
    res.send(Buffer.from(buffer));
  });

  return r;
}