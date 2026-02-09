
import React, { useState, useMemo } from 'react';
import { MonthlyStatement, StrategyVersion, Asset } from '@shared/types';
import { useStatementForm } from '../hooks/useStatementForm';
import { MonthlyStatementList } from './statements/MonthlyStatementList';
import { MonthlyStatementForm } from './statements/MonthlyStatementForm';

interface StatementManagerProps {
  monthlyStatements: MonthlyStatement[];
  strategies: StrategyVersion[];
  assets?: Asset[]; 
  onUpdate: (monthlyStatements: MonthlyStatement[]) => void;
  onSave?: (statement: MonthlyStatement) => void;
  onCreateAsset?: (asset: Partial<Asset>) => Promise<void>;
}

const StatementManager: React.FC<StatementManagerProps> = ({ 
  monthlyStatements, 
  strategies: versions, 
  assets = [],
  onUpdate, 
  onSave, 
  onCreateAsset 
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');

  // Determine active strategy based on current date context (default to latest, prefer active)
  const tempPeriod = new Date().toISOString().slice(0, 7);

  const activeStrategy = useMemo(() => {
    if (versions.length === 0) return null;
    // Priority 1: Find active strategy
    const active = versions.find(v => v.status === 'active');
    if (active) return active;
    // Priority 2: Fall back to latest version (even if archived)
    return versions[versions.length - 1];
  }, [versions]);

  // Use Custom Hook for Form Logic - Lifted here to pass down
  const formHook = useStatementForm(monthlyStatements, assets, activeStrategy);
  const { initEntryForm, prepareSubmission, loadingDetails, selectedStatementId } = formHook;

  // Handlers
  const handleInitEntry = async (id?: string) => {
      await initEntryForm(id);
      setViewMode('entry');
  };

  const handleSubmit = () => {
    if (onSave) {
        const statement = prepareSubmission();
        onSave(statement);
        setViewMode('list');
    }
  };

  if (viewMode === 'entry') {
      return (
          <MonthlyStatementForm 
              assets={assets}
              selectedStatementId={selectedStatementId}
              formHook={formHook}
              onCancel={() => setViewMode('list')}
              onSubmit={handleSubmit}
              onCreateAsset={onCreateAsset || (async () => {})}
          />
      );
  }

  return (
      <MonthlyStatementList 
          monthlyStatements={monthlyStatements}
          loadingDetails={loadingDetails}
          selectedStatementId={selectedStatementId}
          onInitEntry={handleInitEntry}
      />
  );
};

export default StatementManager;
