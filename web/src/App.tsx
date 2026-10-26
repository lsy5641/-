import { useState } from 'react';
import ProfilePage from './pages/ProfilePage';
import WorkbenchPage from './pages/WorkbenchPage';
import ExamPage from './pages/ExamPage';

type Page = 'profile' | 'workbench' | 'exam';
const LABELS: Record<Page, string> = { profile: '① 个人履历', workbench: '② JD 工作台', exam: '③ 备考中心' };

export default function App() {
  const [page, setPage] = useState<Page>('profile');
  return (
    <div className="app">
      <header className="topnav">
        <b>JobCoach 求职助手</b>
        <nav>
          {(Object.keys(LABELS) as Page[]).map(p => (
            <button key={p} className={p === page ? 'tab active' : 'tab'} onClick={() => setPage(p)}>{LABELS[p]}</button>
          ))}
        </nav>
      </header>
      {page === 'profile' && <ProfilePage />}
      {page === 'workbench' && <WorkbenchPage />}
      {page === 'exam' && <ExamPage />}
    </div>
  );
}
