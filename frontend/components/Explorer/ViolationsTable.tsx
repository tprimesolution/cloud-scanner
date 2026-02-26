import React from 'react';

const ViolationsTable: React.FC = () => (
  <div className="mt-4">
    <table className="min-w-full bg-white">
      <thead>
        <tr>
          <th>Resource</th>
          <th>Severity</th>
          <th>Issue</th>
          <th>Framework</th>
          <th>Fix</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>i-123</td>
          <td>High</td>
          <td>S3 bucket public</td>
          <td>CIS</td>
          <td><button className="text-blue-600">Fix</button></td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default ViolationsTable;
