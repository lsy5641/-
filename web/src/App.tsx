import { useState } from 'react';
import ProfilePage from './pages/ProfilePage';
import WorkbenchPage from './pages/WorkbenchPage';
import ExamPage from './pages/ExamPage';
import SettingsModal from './components/SettingsModal';
import Icon from './components/Icon';

type Page = 'profile' | 'workbench' | 'exam';
const ORDER: Page[] = ['profile', 'workbench', 'exam'];
const LABELS: Record<Page, string> = { profile: '① 个人履历', workbench: '② JD 工作台', exam: '③ 备考中心' };

export default function App() {
  const [page, setPage] = useState<Page>('profile');
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [showSettings, setShowSettings] = useState(false);

  function go(p: Page) {
    if (p === page) return;
    setDir(ORDER.indexOf(p) > ORDER.indexOf(page) ? 'next' : 'prev');
    setPage(p);
  }

  return (
    <div className="app">
      <header className="topnav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">J</span>
          <span>JobCoach<span className="brand-sub"> 求职助手</span></span>
        </div>
        <nav aria-label="主导航">
          {(Object.keys(LABELS) as Page[]).map(p => (
            <button key={p} className={p === page ? 'tab active' : 'tab'} aria-current={p === page ? 'page' : undefined} onClick={() => go(p)}>{LABELS[p]}</button>
          ))}
        </nav>
        <span className="wide" />
        <button className="icon-btn ghost" onClick={() => setShowSettings(true)} aria-label="AI 服务设置" title="AI 服务设置">
          <Icon name="gear" />
        </button>
      </header>
      <div key={page} className={'view view-' + dir}>
        {page === 'profile' && <ProfilePage />}
        {page === 'workbench' && <WorkbenchPage />}
        {page === 'exam' && <ExamPage />}
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}