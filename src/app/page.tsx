'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DailyStat {
  date: string;
  newUsers: number;
  interactions: number;
  starsEarned: number;
}

interface User {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode: string;
  startedAt: string;
  lastActiveAt: string;
}

interface StatsData {
  configured: boolean;
  total: {
    totalUsers: number;
    totalInteractions: number;
    totalStars: number;
  };
  period: {
    days: number;
    newUsers: number;
    interactions: number;
    starsEarned: number;
    changes: {
      newUsers: number;
      interactions: number;
      starsEarned: number;
    };
  };
  dailyStats: DailyStat[];
  users: User[];
}

interface ErrorResponse {
  error: string;
  message: string;
  configured: boolean;
}

type SortField = 'id' | 'username' | 'firstName' | 'lastName' | 'languageCode' | 'startedAt' | 'lastActiveAt';
type SortOrder = 'asc' | 'desc';

function StatCard({ 
  title, 
  value, 
  change, 
  isPeriod = false 
}: { 
  title: string; 
  value: number; 
  change?: number; 
  isPeriod?: boolean;
}) {
  const formattedValue = value.toLocaleString();
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-3xl font-bold text-gray-900">{formattedValue}</p>
        {isPeriod && change !== undefined && (
          <span className={`ml-2 text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Chart({ 
  data, 
  dataKey, 
  title, 
  color 
}: { 
  data: DailyStat[]; 
  dataKey: keyof DailyStat; 
  title: string; 
  color: string;
}) {
  const formattedData = data.map(d => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-gray-700 font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="dateLabel" 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UsersTable({ 
  users, 
  sortField, 
  sortOrder, 
  onSort 
}: { 
  users: User[]; 
  sortField: SortField; 
  sortOrder: SortOrder; 
  onSort: (field: SortField) => void;
}) {
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-gray-700 font-semibold">Users ({users.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="id" label="User ID" />
              <SortHeader field="username" label="Username" />
              <SortHeader field="firstName" label="First Name" />
              <SortHeader field="lastName" label="Last Name" />
              <SortHeader field="languageCode" label="Language" />
              <SortHeader field="startedAt" label="Started At" />
              <SortHeader field="lastActiveAt" label="Last Active" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No users yet. Users will appear here when they interact with the bot.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{user.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.username || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.firstName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.lastName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 uppercase">{user.languageCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.startedAt ? new Date(user.startedAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigurationWarning() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Database Not Configured</h1>
          <p className="text-gray-600 mb-6">
            The dashboard requires a Redis database connection to display statistics.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">Required environment variables:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><code className="bg-gray-200 px-1 rounded">KV_REST_API_URL</code></li>
              <li><code className="bg-gray-200 px-1 rounded">KV_REST_API_TOKEN</code></li>
            </ul>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Set these variables in your Vercel project settings or in your local .env file.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [period, setPeriod] = useState(7);
  const [sortField, setSortField] = useState<SortField>('lastActiveAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stats?days=${period}`);
      const data = await response.json();
      
      if (!response.ok) {
        if (data.configured === false) {
          setNotConfigured(true);
          return;
        }
        throw new Error(data.message || 'Failed to fetch stats');
      }
      
      setStats(data);
      setNotConfigured(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedUsers = stats?.users ? [...stats.users].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField) {
      case 'id':
        aVal = a.id;
        bVal = b.id;
        break;
      case 'username':
        aVal = (a.username || '').toLowerCase();
        bVal = (b.username || '').toLowerCase();
        break;
      case 'firstName':
        aVal = (a.firstName || '').toLowerCase();
        bVal = (b.firstName || '').toLowerCase();
        break;
      case 'lastName':
        aVal = (a.lastName || '').toLowerCase();
        bVal = (b.lastName || '').toLowerCase();
        break;
      case 'languageCode':
        aVal = a.languageCode;
        bVal = b.languageCode;
        break;
      case 'startedAt':
        aVal = new Date(a.startedAt || 0).getTime();
        bVal = new Date(b.startedAt || 0).getTime();
        break;
      case 'lastActiveAt':
        aVal = new Date(a.lastActiveAt || 0).getTime();
        bVal = new Date(b.lastActiveAt || 0).getTime();
        break;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  }) : [];

  if (loading && !stats && !notConfigured) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (notConfigured) {
    return <ConfigurationWarning />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg">
          <div className="text-red-500 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Cleo & Leo Bot Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Total Users" value={stats.total.totalUsers} />
          <StatCard title="Total Interactions" value={stats.total.totalInteractions} />
          <StatCard title="Total Stars Earned" value={stats.total.totalStars} />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 mb-8">
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-medium">Period:</span>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title={`New Users (${period}d)`} 
            value={stats.period.newUsers} 
            change={stats.period.changes.newUsers}
            isPeriod
          />
          <StatCard 
            title={`Interactions (${period}d)`} 
            value={stats.period.interactions} 
            change={stats.period.changes.interactions}
            isPeriod
          />
          <StatCard 
            title={`Stars Earned (${period}d)`} 
            value={stats.period.starsEarned} 
            change={stats.period.changes.starsEarned}
            isPeriod
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
          <Chart 
            data={stats.dailyStats} 
            dataKey="newUsers" 
            title="New Users Trend" 
            color="#3b82f6" 
          />
          <Chart 
            data={stats.dailyStats} 
            dataKey="interactions" 
            title="Interactions Trend" 
            color="#10b981" 
          />
          <Chart 
            data={stats.dailyStats} 
            dataKey="starsEarned" 
            title="Stars Earned Trend" 
            color="#f59e0b" 
          />
        </div>

        <UsersTable 
          users={sortedUsers} 
          sortField={sortField} 
          sortOrder={sortOrder} 
          onSort={handleSort} 
        />
      </div>
    </div>
  );
}
