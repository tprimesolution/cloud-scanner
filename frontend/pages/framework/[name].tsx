import React from 'react';
import { useRouter } from 'next/router';

const FrameworkPage: React.FC = () => {
  const router = useRouter();
  const { name } = router.query;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Framework: {name}</h1>
      <p>Compliance controls and status.</p>
    </div>
  );
};

export default FrameworkPage;
