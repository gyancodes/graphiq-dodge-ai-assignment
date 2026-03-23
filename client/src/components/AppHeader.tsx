import { BarChart3, Box, ChevronRight, Database, GitBranch, Zap } from 'lucide-react';
import type { Stats } from '../types/app';

interface AppHeaderProps {
  stats: Stats | null;
}

export function AppHeader({ stats }: AppHeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <div className="logo-icon">
            <GitBranch size={16} />
          </div>
          GraphIQ
        </div>
        <div className="header-breadcrumbs">
          <Database size={13} />
          <span>SAP</span>
          <ChevronRight size={12} />
          <span className="current">Order to Cash</span>
        </div>
      </div>

      <div className="header-right">
        {stats && (
          <div className="header-stats">
            <div className="header-stat">
              <Box size={12} />
              <span className="stat-value">{stats.salesOrders}</span> Orders
            </div>
            <div className="header-stat">
              <Zap size={12} />
              <span className="stat-value">{stats.billingDocs}</span> Invoices
            </div>
            <div className="header-stat">
              <BarChart3 size={12} />
              <span className="stat-value">{stats.products}</span> Products
            </div>
          </div>
        )}

        <div className="header-status">
          <div className="status-pulse" />
          Connected
        </div>
      </div>
    </header>
  );
}
