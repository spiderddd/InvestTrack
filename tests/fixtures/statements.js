/**
 * Test fixtures for monthly statements
 */

export const testStatements = [
  {
    id: 'stmt-2024-01',
    date: '2024-01-31',
    note: '2024年1月月报'
  },
  {
    id: 'stmt-2024-02',
    date: '2024-02-29',
    note: '2024年2月月报'
  },
  {
    id: 'stmt-2024-03',
    date: '2024-03-31',
    note: '2024年3月月报'
  },
  {
    id: 'stmt-2024-04',
    date: '2024-04-30',
    note: '2024年4月月报'
  },
  {
    id: 'stmt-2024-05',
    date: '2024-05-31',
    note: '2024年5月月报'
  },
  {
    id: 'stmt-2024-06',
    date: '2024-06-30',
    note: '2024年6月月报'
  }
];

/**
 * Get statement by ID
 */
export function getStatementById(id) {
  return testStatements.find(s => s.id === id);
}

/**
 * Get statements by date range
 */
export function getStatementsByDateRange(startDate, endDate) {
  return testStatements.filter(s => s.date >= startDate && s.date <= endDate);
}
