'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { Users, Plus, Trash2, Shield, Search } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: usersData, isLoading } = useQuery<any>({
    queryKey: ['admin-users', search],
    queryFn: () => fetchApi(`/api/admin/users?search=${encodeURIComponent(search)}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, isAdmin }),
      }),
    onSuccess: () => {
      setShowModal(false);
      setUsername('');
      setEmail('');
      setPassword('');
      setIsAdmin(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      alert(`User creation failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            User Accounts
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage customer accounts, administrators, and security privileges
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username or email..."
              className="pl-8 pr-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Create User
          </Button>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Create User Account</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="accent-primary"
                />
                <span>Administrator (Superuser access)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending || !username || !email || !password}
                onClick={() => createMutation.mutate()}
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading users...</div>
        ) : (usersData?.data || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No users found matching query.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Username</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">2FA</th>
                <th className="px-5 py-3">Servers</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {usersData?.data?.map((user: any) => (
                <tr key={user.id} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-text-primary flex items-center gap-2">
                    <Users className="w-4 h-4 text-text-muted" />
                    <span>{user.username}</span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary font-mono text-[11px]">
                    {user.email}
                  </td>
                  <td className="px-5 py-3.5">
                    {user.isAdmin ? (
                      <Badge variant="info">ADMINISTRATOR</Badge>
                    ) : (
                      <Badge variant="default">USER</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {user.totpEnabled ? (
                      <Badge variant="success">ENABLED</Badge>
                    ) : (
                      <span className="text-text-muted font-mono text-[10px]">Disabled</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-text-secondary">
                    {user._count?.servers || 0}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete user ${user.username}?`)) {
                          deleteMutation.mutate(user.id);
                        }
                      }}
                      className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
