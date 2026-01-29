import { useEffect, useState } from 'react';
import api from '../services/api';
import { EvidenceDTO } from '../types';  // Will work after fix above
import { usePreferencesStore, t } from '../stores/preferencesStore';

const EvidenceTable = ({ evidences }: { evidences: EvidenceDTO[] }) => {
  const { language } = usePreferencesStore();

  return (
    <table className="case-table">
      <thead>
        <tr>
          <th>{t(language, 'evidenceIdLabel')}</th>
          <th>{t(language, 'caseIdPrefix')}</th>
          <th>{t(language, 'evidenceTypeLabel')}</th>
          <th>{t(language, 'descriptionLabel')}</th>
          <th>{t(language, 'collectedByLabel')}</th>
          <th>{t(language, 'actions')}</th>
        </tr>
      </thead>
      <tbody>
        {evidences.map((evidence) => (
          <tr key={evidence.evidenceId}>
            <td>{evidence.evidenceId}</td>
            <td>{evidence.caseId}</td>
            <td>{evidence.type}</td>
            <td>{evidence.description}</td>
            <td>{evidence.collectedByUserId}</td>
            <td>
              <button>{t(language, 'view')}</button>
              <button>{t(language, 'edit')}</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Evidence = () => {
  const [evidences, setEvidences] = useState<EvidenceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = usePreferencesStore();

  useEffect(() => {
    api.get<EvidenceDTO[]>('evidences')
      .then((res) => {
        setEvidences(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching evidences:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>{t(language, 'loadingEvidences')}</div>;

  return (
    <div>
      <h2>{t(language, 'evidenceManagement')}</h2>
      {evidences.length === 0 ? (
        <p>{t(language, 'noEvidenceRecordsFound')}</p>
      ) : (
        <EvidenceTable evidences={evidences} />
      )}
    </div>
  );
};

export default Evidence;
