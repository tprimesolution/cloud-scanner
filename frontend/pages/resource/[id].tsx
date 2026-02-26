import React from 'react';
import { useRouter } from 'next/router';

const ResourceDetail: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Resource {id}</h1>
      <p>Compliance status per rule will be shown here.</p>
    </div>
  );
};

export default ResourceDetail;
