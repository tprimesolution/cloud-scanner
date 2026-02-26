import React from 'react';

const Filters: React.FC = () => (
  <div className="flex space-x-4">
    <input type="text" placeholder="Search" className="border p-1" />
    <select className="border p-1">
      <option>All severities</option>
      <option>High</option>
      <option>Medium</option>
      <option>Low</option>
    </select>
  </div>
);

export default Filters;
