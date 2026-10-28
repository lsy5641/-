import { useEffect, useLayoutEffect, useState } from 'react';
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
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => { setPage(p); window.scrollTo(0, 0); });
    } else {
      setPage(p);
      window.scrollTo(0, 0);
    }
  }

  useEffect(() => {
    if (typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function') {
      document.documentElement.classList.add('vt');
    }
  }, []);

  useLayoutEffect(() => { window.scrollTo(0, 0); }, [page]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">跳到主内容</a>
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
      <main id="main" tabIndex={-1}>
        <div key={page} className={'view view-' + dir}>
          {page === 'profile' && <ProfilePage onNavigate={go} />}
          {page === 'workbench' && <WorkbenchPage />}
          {page === 'exam' && <ExamPage onNavigate={go} />}
        </div>
      </main>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}