import { useState, useMemo } from 'react';
import { Play, Pause, AlertCircle, Clock } from 'lucide-react';

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const NODE_TYPES = ['Trigger', 'Wait', 'Send Email', 'Condition', 'End'];

export default function AutomationList({ workflows }) {
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-accent/10 text-accent';
      case 'paused':
        return 'bg-warning/10 text-warning';
      case 'error':
        return 'bg-danger/10 text-danger';
      default:
        return 'bg-background-secondary text-text-secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onSelect={() => setSelectedWorkflow(workflow)}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
        />
      ))}
    </div>
  );
}

function WorkflowCard({ workflow, onSelect, getStatusColor, getStatusIcon }) {
  return (
    <div
      className="rounded-lg border border-border p-4 hover:bg-background-secondary cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}
          >
            {getStatusIcon(workflow.status)}
            {workflow.status}
          </span>
          <div>
            <h3 className="font-medium text-text-primary">{workflow.name}</h3>
            <p className="text-sm text-text-secondary">{workflow.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-semibold text-text-primary">
              {workflow.executions.toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary">executions</p>
          </div>
        </div>
      </div>
    </div>
  );
}
