import { usePreferencesStore, t } from '@/stores/preferencesStore';

const NotFound = () => {
  const { language } = usePreferencesStore();

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>{t(language, 'pageNotFound')}</h1>
      <p>{t(language, 'sorryPageNotFound')}</p>
      <a href="/dashboard">{t(language, 'goBackToDashboard')}</a>
    </div>
  );
};

export default NotFound;
