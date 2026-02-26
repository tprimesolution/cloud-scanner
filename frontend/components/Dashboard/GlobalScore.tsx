import React from 'react';

interface Props {
  score: number;
}

const GlobalScore: React.FC<Props> = ({ score }) => (
  <div className="bg-white p-4 rounded shadow">
    <h2 className="text-xl font-semibold">Overall Compliance</h2>
    <p className="text-4xl font-bold">{score}%</p>
  </div>
);

export default GlobalScore;
