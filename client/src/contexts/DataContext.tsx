
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Asset, StrategyVersion, MonthlyStatement } from '@shared/types';
import { StorageService } from '../services/storageService';

interface DataContextType {
  assets: Asset[];
  strategies: StrategyVersion[];
  monthlyStatements: MonthlyStatement[];
  statementTotal: number;
  statementPage: number;
  setStatementPage: (page: number) => void;
  isLoading: boolean;
  error: string | null;
  refreshAssets: () => Promise<void>;
  refreshStrategies: () => Promise<void>;
  refreshMonthlyStatements: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [strategies, setStrategies] = useState<StrategyVersion[]>([]);
  
  // Monthly Statements State
  const [monthlyStatements, setMonthlyStatements] = useState<MonthlyStatement[]>([]);
  const [statementTotal, setStatementTotal] = useState(0);
  const [statementPage, setStatementPage] = useState(1);
  const STATEMENT_LIMIT = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAssets = useCallback(async () => {
    try {
      const data = await StorageService.getAssets();
      setAssets(data);
    } catch (e) { console.error(e); }
  }, []);

  const refreshStrategies = useCallback(async () => {
    try {
      const data = await StorageService.getStrategyVersions();
      setStrategies(data);
    } catch (e) { console.error(e); }
  }, []);

  const refreshMonthlyStatements = useCallback(async () => {
    try {
      const data = await StorageService.getMonthlyStatements(statementPage, STATEMENT_LIMIT);
      setMonthlyStatements(data.items);
      setStatementTotal(data.total);
    } catch (e) { console.error(e); }
  }, [statementPage]);

  // Handle page change -> triggers fetch
  useEffect(() => {
    if (!isLoading) { // Skip on initial load as refreshAll handles it
        refreshMonthlyStatements();
    }
  }, [statementPage]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [a, st, snData] = await Promise.all([
        StorageService.getAssets(),
        StorageService.getStrategyVersions(),
        StorageService.getMonthlyStatements(statementPage, STATEMENT_LIMIT)
      ]);
      setAssets(a);
      setStrategies(st);
      setMonthlyStatements(snData.items);
      setStatementTotal(snData.total);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("无法连接到服务器。请确保后端服务已启动。");
    } finally {
      setIsLoading(false);
    }
  }, []); // Only on mount essentially, or manual full refresh. We don't depend on statementPage here to avoid loops if not careful.

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <DataContext.Provider value={{ 
      assets, 
      strategies, 
      monthlyStatements,
      statementTotal,
      statementPage,
      setStatementPage, 
      isLoading, 
      error,
      refreshAssets,
      refreshStrategies,
      refreshMonthlyStatements,
      refreshAll
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
