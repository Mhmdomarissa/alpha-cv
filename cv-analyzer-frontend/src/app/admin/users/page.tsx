'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api, AdminUser, CreateUserRequest, UpdateUserRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X, Trash2, Database, AlertTriangle, ArrowRight } from 'lucide-react';
import Protected from '@/components/layout/Protected';
import { config } from '@/lib/config';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: '',
    password: '',
    role: 'user',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Edit user modal state
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserRequest>({});
  const [editLoading, setEditLoading] = useState(false);

  // Clear database modal state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchUsers = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const usersList = await api.listUsers(token);
      setUsers(usersList);
      setError(null);
    } catch (err: any) {
      if (err.message.includes('403') || err.message.includes('Admin only')) {
        setError('Access denied. Admin privileges required.');
      } else {
        setError(err.message || 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setCreateLoading(true);
      await api.createUser(token, createForm);
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', role: 'user' });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editUser) return;

    try {
      setEditLoading(true);
      await api.updateUser(token, editUser.id, editForm);
      setEditUser(null);
      setEditForm({});
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.deleteUser(token, userId);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      if (!token) {
        throw new Error('No authentication token found');
      }
      await api.clearDatabase(token, true);
      setShowClearDialog(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to clear database');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Protected requireRole="admin">
      <div className="min-h-screen" style={{ backgroundColor: 'var(--gray-50)' }}>
        {/* Header */}
        <header className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <span className="text-white text-sm font-bold">⚡</span>
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--gray-900)' }}>{config.appName} - Admin</h1>
                <p className="text-sm" style={{ color: 'var(--gray-600)' }}>User Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm" style={{ color: 'var(--gray-700)' }}>
                  <strong>{user?.username}</strong>
                </span>
                <span 
                  className="text-xs px-2 py-1 rounded-full"
                  style={{ 
                    backgroundColor: 'var(--red-100)',
                    color: 'var(--red-800)'
                  }}
                >
                  {user?.role}
                </span>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Navigation Links */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Quick Navigation</h3>
                  <p className="text-sm text-gray-600">Access main application features</p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/')}
                    className="flex items-center space-x-2"
                  >
                    <span>Go to Main App</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Database Management Section */}
            <Card className="p-6 border-red-200 bg-red-50/30">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-md">
                    <Database className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Database Management</h3>
                    <p className="text-sm text-neutral-500 font-normal">Clear all stored documents</p>
                  </div>
                </div>
                
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This will permanently delete all CVs and job descriptions from the database. This action cannot be undone.
                  </AlertDescription>
                </Alert>
                
                <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Confirm Database Clear
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>Are you sure you want to permanently delete all CVs and job descriptions?</p>
                      <p className="text-sm text-gray-500">This action cannot be undone.</p>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleClearDatabase}
                          disabled={isClearing}
                        >
                          {isClearing ? 'Clearing...' : 'Clear All Data'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>

            {/* User Management Section */}
            <Card className="p-6">
              <div className="space-y-6">
                {/* Page Header */}
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">User Management</h2>
                  <Button onClick={() => setShowCreateModal(true)}>
                    Create User
                  </Button>
                </div>

                {/* Error Banner */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>{error}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setError(null)}
                        className="h-auto p-1 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Users Table */}
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Username</th>
                          <th className="text-left p-2">Role</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b">
                            <td className="p-2">{user.username}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.role === 'admin' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-2 space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setEditUser(user);
                                  setEditForm({});
                                }}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </main>

        {/* Create User Modal */}
        {showCreateModal && (
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
              <Card className="w-full max-w-md p-6">
                <h3 className="text-lg font-semibold mb-4">Create New User</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <Input
                      value={createForm.username}
                      onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({...createForm, role: e.target.value as 'admin' | 'user'})}
                      className="w-full p-2 border rounded"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={createLoading}>
                      {createLoading ? 'Creating...' : 'Create'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </Dialog>
        )}

        {/* Edit User Modal */}
        {editUser && (
          <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
              <Card className="w-full max-w-md p-6">
                <h3 className="text-lg font-semibold mb-4">Edit User: {editUser.username}</h3>
                <form onSubmit={handleEditUser} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">New Password (optional)</label>
                    <Input
                      type="password"
                      value={editForm.password || ''}
                      onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                      placeholder="Leave blank to keep current password"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <select
                      value={editForm.role || editUser.role}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value as 'admin' | 'user'})}
                      className="w-full p-2 border rounded"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editForm.is_active !== undefined ? editForm.is_active : editUser.is_active}
                        onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
                      />
                      <span className="text-sm font-medium">Active</span>
                    </label>
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={editLoading}>
                      {editLoading ? 'Updating...' : 'Update'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setEditUser(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </Dialog>
        )}
      </div>
    </Protected>
  );
}