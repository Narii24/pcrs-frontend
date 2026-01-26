import { useEffect, useState } from 'react';
import api from '../services/api';
import { EvidenceDTO } from '../types';  // Will work after fix above

const EvidenceTable = ({ evidences }: { evidences: EvidenceDTO[] }) => {
  return (
    <table className="case-table">
      <thead>
        <tr>
          <th>Evidence ID</th>
          <th>Case ID</th>
          <th>Type</th>
          <th>Description</th>
          <th>Collected By</th>
          <th>Actions</th>
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
              <button>View</button>
              <button>Edit</button>
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

  if (loading) return <div>Loading evidences...</div>;

  return (
    <div>
      <h2>Evidence Management</h2>
      {evidences.length === 0 ? (
        <p>No evidence records found.</p>
      ) : (
        <EvidenceTable evidences={evidences} />
      )}
    </div>
  );
};

export default Evidence;