
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string;
}

interface InvitationCode {
  id: string;
  code: string;
  email: string;
  used: boolean;
  created_at: string;
  expires_at: string;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createUser, generateInvitationCode, getUsers, getInvitationCodes } = useAdmin();
  
  const [users, setUsers] = useState<User[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateInvitation, setShowCreateInvitation] = useState(false);
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'user'
  });
  
  const [newInvitation, setNewInvitation] = useState({
    email: '',
    expiresInDays: 7
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, codesData] = await Promise.all([
        getUsers(),
        getInvitationCodes()
      ]);
      setUsers(usersData || []);
      setInvitationCodes(codesData || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser(newUser.email, newUser.password, newUser.role);
      setNewUser({ email: '', password: '', role: 'user' });
      setShowCreateUser(false);
      loadData();
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await generateInvitationCode(newInvitation.email, newInvitation.expiresInDays);
      setNewInvitation({ email: '', expiresInDays: 7 });
      setShowCreateInvitation(false);
      loadData();
    } catch (error) {
      console.error('Error creating invitation:', error);
    }
  };

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Admin Panel"
        subtitle="User Management & System Control"
      />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="primary"
            onClick={() => setShowCreateUser(true)}
            className="h-16"
          >
            <i className="ri-user-add-line mr-2"></i>
            Create User
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowCreateInvitation(true)}
            className="h-16"
          >
            <i className="ri-mail-send-line mr-2"></i>
            Send Invitation
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-blue-600">{users.length}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-green-600">
              {invitationCodes.filter(code => !code.used).length}
            </div>
            <div className="text-sm text-gray-500">Active Invitations</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-purple-600">
              {users.filter(u => u.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-500">Admins</div>
          </Card>
        </div>

        {/* Users List */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Users</h3>
          {loading ? (
            <div className="text-center py-8">
              <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-sm text-gray-500">
                      Role: {user.role} • Created: {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${
                      user.last_sign_in_at ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Invitation Codes */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Invitation Codes</h3>
          <div className="space-y-3">
            {invitationCodes.map((code) => (
              <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-mono text-sm">{code.code}</div>
                  <div className="text-sm text-gray-500">
                    For: {code.email} • Expires: {new Date(code.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  code.used ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                }`}>
                  {code.used ? 'Used' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Create User Modal */}
        {showCreateUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Create New User</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateUser(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    Create User
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Create Invitation Modal */}
        {showCreateInvitation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Create Invitation Code</h3>
              <form onSubmit={handleCreateInvitation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newInvitation.email}
                    onChange={(e) => setNewInvitation({...newInvitation, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires in (days)</label>
                  <select
                    value={newInvitation.expiresInDays}
                    onChange={(e) => setNewInvitation({...newInvitation, expiresInDays: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateInvitation(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    Create Invitation
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
