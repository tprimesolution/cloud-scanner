import React from 'react';

interface Props {
  fixSteps: string;
  cli: string;
  terraform: string;
}

const RemediationPanel: React.FC<Props> = ({ fixSteps, cli, terraform }) => (
  <div className="bg-white p-4 rounded shadow">
    <h3 className="text-lg font-semibold">Remediation</h3>
    <div className="mt-2">
      <strong>Steps:</strong>
      <pre className="bg-gray-100 p-2 rounded">{fixSteps}</pre>
    </div>
    <div className="mt-2">
      <strong>CLI:</strong>
      <pre className="bg-gray-100 p-2 rounded">{cli}</pre>
    </div>
    <div className="mt-2">
      <strong>Terraform:</strong>
      <pre className="bg-gray-100 p-2 rounded">{terraform}</pre>
    </div>
  </div>
);

export default RemediationPanel;
