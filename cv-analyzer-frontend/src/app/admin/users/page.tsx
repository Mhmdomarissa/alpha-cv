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
    email: '',
    role: 'user',
    otp_mode: 'real',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

    // Validate: email is required for non-admin users (user/manager)
    if (createForm.role !== 'admin' && createForm.otp_mode !== 'fixed' && !createForm.email?.trim()) {
      setCreateError('Email is required for non-admin users when OTP mode is real');
      return;
    }

    // Basic email validation
    if (createForm.email && createForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(createForm.email)) {
        setCreateError('Please enter a valid email address');
        return;
      }
    }

    try {
      setCreateLoading(true);
      setCreateError(null);
      await api.createUser(token, createForm);
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', email: '', role: 'user', otp_mode: 'real', team_location: null });
      setCreateError(null);
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || err.message || 'Failed to create user');
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
                style={{ background: 'var(--primary-500)' }}
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
            <Card className="p-6 border border-red-200 bg-white">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 border border-red-200 rounded-xl shadow-sm">
                    <Database className="h-5 w-5 text-red-600" />
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
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3 font-semibold">Username</th>
                          <th className="text-left p-3 font-semibold">Email</th>
                          <th className="text-left p-3 font-semibold">Role</th>
                          <th className="text-left p-3 font-semibold">Status</th>
                          <th className="text-left p-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{user.username}</td>
                            <td className="p-3 text-sm text-gray-600">
                              {user.email || <span className="text-gray-400 italic">No email</span>}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                user.role === 'admin' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
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
          <Dialog open={showCreateModal} onOpenChange={(open) => {
            setShowCreateModal(open);
            if (!open) {
              setCreateForm({ username: '', password: '', email: '', role: 'user' });
              setCreateError(null);
            }
          }}>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-lg p-6 bg-white shadow-xl">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Create New User</h3>
                  <p className="text-sm text-gray-600">Add a new user to the system</p>
                </div>
                
                {createError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleCreateUser} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={createForm.username}
                      onChange={(e) => {
                        setCreateForm({...createForm, username: e.target.value});
                        setCreateError(null);
                      }}
                      placeholder="Enter username"
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={createForm.password}
                      onChange={(e) => {
                        setCreateForm({...createForm, password: e.target.value});
                        setCreateError(null);
                      }}
                      placeholder="Enter password"
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Email {createForm.role !== 'admin' && <span className="text-red-500">*</span>}
                      {createForm.role !== 'admin' && (
                        <span className="text-xs text-gray-500 ml-2">(Required for recruiters/managers)</span>
                      )}
                      {createForm.role === 'admin' && (
                        <span className="text-xs text-gray-500 ml-2">(Optional for admin)</span>
                      )}
                    </label>
                    <Input
                      type="email"
                      value={createForm.email || ''}
                      onChange={(e) => {
                        setCreateForm({...createForm, email: e.target.value});
                        setCreateError(null);
                      }}
                      placeholder="user@example.com"
                      required={createForm.role !== 'admin' && createForm.otp_mode !== 'fixed'}
                      className="w-full"
                    />
                    {createForm.role !== 'admin' && createForm.otp_mode !== 'fixed' && (
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ Regular users need email for OTP authentication
                      </p>
                    )}
                    {createForm.otp_mode === 'fixed' && (
                      <p className="text-xs text-amber-700 mt-1">
                        ⚠️ Fixed OTP mode uses code <strong>123456</strong> and will not send email.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={createForm.role}
                      onChange={(e) => {
                        const newRole = e.target.value as CreateUserRequest['role'];
                        setCreateForm({...createForm, role: newRole});
                        setCreateError(null);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="user">Recruiter (Read-only Tracker)</option>
                      <option value="manager">Manager (Read/Write Tracker)</option>
                      <option value="evp">EVP (Manager access + sees all locations)</option>
                      <option value="admin">Admin (Administrator)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Team Location <span className="text-xs text-gray-500 ml-2">(Abu Dhabi / Dubai)</span>
                    </label>
                    <select
                      value={createForm.team_location || ''}
                      onChange={(e) => setCreateForm({ ...createForm, team_location: e.target.value || null })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">(None)</option>
                      <option value="Abu Dhabi">Abu Dhabi</option>
                      <option value="Dubai">Dubai</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      OTP Mode <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={createForm.otp_mode || 'real'}
                      onChange={(e) => {
                        const mode = e.target.value as NonNullable<CreateUserRequest['otp_mode']>;
                        setCreateForm({ ...createForm, otp_mode: mode });
                        setCreateError(null);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="real">Real OTP (email)</option>
                      <option value="fixed">Fixed OTP (123456, no email)</option>
                    </select>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button 
                      type="submit" 
                      disabled={createLoading}
                      className="flex-1"
                    >
                      {createLoading ? 'Creating...' : 'Create User'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowCreateModal(false);
                        setCreateForm({ username: '', password: '', email: '', role: 'user', otp_mode: 'real', team_location: null });
                        setCreateError(null);
                      }}
                      className="flex-1"
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
          <Dialog open={!!editUser} onOpenChange={() => {
            setEditUser(null);
            setEditForm({});
          }}>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-lg p-6 bg-white shadow-xl">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Edit User: {editUser.username}</h3>
                  <p className="text-sm text-gray-600">Update user information</p>
                </div>
                <form onSubmit={handleEditUser} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Email {(editForm.role || editUser.role) !== 'admin' && <span className="text-red-500">*</span>}
                      {(editForm.role || editUser.role) !== 'admin' && (
                        <span className="text-xs text-gray-500 ml-2">(Required for recruiters/managers)</span>
                      )}
                    </label>
                    <Input
                      type="email"
                      value={editForm.email !== undefined ? editForm.email : (editUser.email || '')}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      placeholder="user@example.com"
                      required={(editForm.role || editUser.role) !== 'admin' && (editForm.otp_mode || editUser.otp_mode || 'real') !== 'fixed'}
                      className="w-full"
                    />
                    {(editForm.role || editUser.role) !== 'admin' && (editForm.otp_mode || editUser.otp_mode || 'real') !== 'fixed' && (
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ Regular users need email for OTP authentication
                      </p>
                    )}
                    {(editForm.otp_mode || editUser.otp_mode) === 'fixed' && (
                      <p className="text-xs text-amber-700 mt-1">
                        ⚠️ Fixed OTP mode uses code <strong>123456</strong> and will not send email.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      New Password <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <Input
                      type="password"
                      value={editForm.password || ''}
                      onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                      placeholder="Leave blank to keep current password"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Role
                    </label>
                    <select
                      value={editForm.role || editUser.role}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value as UpdateUserRequest['role']})}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="user">Recruiter (Read-only Tracker)</option>
                      <option value="manager">Manager (Read/Write Tracker)</option>
                      <option value="evp">EVP (Manager access + sees all locations)</option>
                      <option value="admin">Admin (Administrator)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Team Location <span className="text-xs text-gray-500 ml-2">(Abu Dhabi / Dubai)</span>
                    </label>
                    <select
                      value={
                        editForm.team_location !== undefined
                          ? (editForm.team_location || '')
                          : (editUser.team_location || '')
                      }
                      onChange={(e) => setEditForm({ ...editForm, team_location: e.target.value || null })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">(None)</option>
                      <option value="Abu Dhabi">Abu Dhabi</option>
                      <option value="Dubai">Dubai</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      OTP Mode
                    </label>
                    <select
                      value={editForm.otp_mode || editUser.otp_mode || 'real'}
                      onChange={(e) => setEditForm({ ...editForm, otp_mode: e.target.value as UpdateUserRequest['otp_mode'] })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="real">Real OTP (email)</option>
                      <option value="fixed">Fixed OTP (123456, no email)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.is_active !== undefined ? editForm.is_active : editUser.is_active}
                        onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-gray-700">Active</span>
                    </label>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button type="submit" disabled={editLoading} className="flex-1">
                      {editLoading ? 'Updating...' : 'Update User'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setEditUser(null);
                        setEditForm({});
                      }}
                      className="flex-1"
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