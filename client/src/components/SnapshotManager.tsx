
import React, { useState, useMemo } from 'react';
import { SnapshotItem, StrategyVersion, Asset } from '@shared/types';
import { getStrategyForDate } from '../utils/calculators';
import { useSnapshotForm } from '../hooks/useSnapshotForm';
import { SnapshotList } from './snapshots/SnapshotList';
import { SnapshotEntryForm } from './snapshots/SnapshotEntryForm';

interface SnapshotManagerProps {
  snapshots: SnapshotItem[];
  strategies: StrategyVersion[];
  assets?: Asset[]; 
  onUpdate: (snapshots: SnapshotItem[]) => void;
  onSave?: (snapshot: SnapshotItem) => void;
  onCreateAsset?: (asset: Partial<Asset>) => Promise<void>;
}

const SnapshotManager: React.FC<SnapshotManagerProps> = ({ 
  snapshots, 
  strategies: versions, 
  assets = [],
  onUpdate, 
  onSave, 
  onCreateAsset 
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');

  // Determine active strategy based on current date context (default to latest, prefer active)
  const tempDate = new Date().toISOString().slice(0, 7);

  const activeStrategy = useMemo(() => {
    // Priority 1: Find active strategy that matches the date
    const activeVersions = versions.filter(v => v.status === 'active');
    const activeMatch = activeVersions.length > 0
      ? getStrategyForDate(activeVersions, tempDate)
      : null;

    // Priority 2: Fall back to latest version (even if archived)
    const fallback = versions.length > 0 ? versions[versions.length - 1] : null;

    return activeMatch || fallback;
  }, [versions, tempDate]);

  // Use Custom Hook for Form Logic - Lifted here to pass down
  const formHook = useSnapshotForm(snapshots, assets, activeStrategy);
  const { initEntryForm, prepareSubmission, loadingDetails, selectedSnapshotId } = formHook;

  // Handlers
  const handleInitEntry = async (id?: string) => {
      await initEntryForm(id);
      setViewMode('entry');
  };

  const handleSubmit = () => {
    if (onSave) {
        const snapshot = prepareSubmission();
        onSave(snapshot);
        setViewMode('list');
    }
  };

  if (viewMode === 'entry') {
      return (
          <SnapshotEntryForm 
              assets={assets}
              selectedSnapshotId={selectedSnapshotId}
              formHook={formHook}
              onCancel={() => setViewMode('list')}
              onSubmit={handleSubmit}
              onCreateAsset={onCreateAsset || (async () => {})}
          />
      );
  }

  return (
      <SnapshotList 
          snapshots={snapshots}
          loadingDetails={loadingDetails}
          selectedSnapshotId={selectedSnapshotId}
          onInitEntry={handleInitEntry}
      />
  );
};

export default SnapshotManager;
