import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Finding {
  id: number;
  resource_id: number;
  rule_id: number;
  severity: string;
  status: string;
  detected_at: string;
}

const ViolationsPage: React.FC = () => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = filter !== 'all' ? { severity: filter } : {};
        const res = await api.get('/findings', { params });
        setFindings(res.data);
      } catch (err) {
        console.error('Failed to fetch findings');
      }
      setLoading(false);
    };
    fetchData();
  }, [filter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Cloud Compliance Scanner</h1>
            <div className="flex space-x-4">
              <a href="/" className="text-gray-700 hover:text-blue-600">Dashboard</a>
              <a href="/violations" className="text-gray-700 hover:text-blue-600">Violations</a>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold mb-6">Violations Explorer</h2>
        
        <div className="bg-white p-4 rounded shadow mb-6 flex space-x-4">
          <input 
            type="text" 
            placeholder="Search resources..." 
            className="flex-1 border border-gray-300 rounded px-3 py-2"
          />
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading findings...</p>
        ) : findings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No findings match your filter</p>
        ) : (
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Resource</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Rule</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Severity</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f, idx) => (
                  <tr key={f.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} >
                    <td className="px-6 py-4 text-sm">Resource-{f.resource_id}</td>
                    <td className="px-6 py-4 text-sm">Rule-{f.rule_id}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        f.severity === 'high' ? 'bg-red-100 text-red-800' :
                        f.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {f.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                        f.status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-semibold">Fix</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViolationsPage;
