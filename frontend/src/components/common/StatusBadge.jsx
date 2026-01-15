import { STATUS_COLORS } from '../../utils/constants';

const STATUS_DESCRIPTIONS = {
  'PENDING': 'Request is waiting for manager approval',
  'APPROVED': 'Request has been approved and is ready for execution',
  'EXECUTING': 'Request is currently being executed',
  'EXECUTED': 'Request has been successfully executed',
  'FAILED': 'Request execution failed due to an error',
  'REJECTED': 'Request was rejected by the manager'
};

export default function StatusBadge({ status }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  const description = STATUS_DESCRIPTIONS[status] || 'Unknown status';
  
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      title={description}
    >
      {status}
    </span>
  );
}
