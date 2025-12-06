

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import TelegramSettings from '../../components/settings/TelegramSettings';
import PaperTradingBalance from '../../components/paper/PaperTradingBalance';
import { useAuth } from '../../hooks/useAuth';
import { useApiKeys } from '../../hooks/useApiKeys';
import type { ApiKeyFormData } from '../../hooks/useApiKeys';
import { useProfile } from '../../hooks/useProfile';
import type { ProfileData } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabase';
import { openAIService } from '../../services/openai';
import { useEmailNotifications } from '../../hooks/useEmailNotifications';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { apiKeys, loading: apiKeysLoading, saveApiKey, testApiConnection: testConnection, toggleApiKey, deleteApiKey } = useApiKeys();
  const { getProfile, updateProfile } = useProfile();
  const { 
    emailPreferences, 
    alertSettings, 
    loading: emailSettingsLoading, 
    updateEmailPreferences, 
    updateAlertSettings 
  } = useEmailNotifications();

  const [notifications] = useState({
    push: true,
    email: false,
    trading: true,
    price: true
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    biometric: true,
    autoLogout: 30
  });

  const [trading, setTrading] = useState({
    defaultLeverage: 5,
    riskLevel: 'medium',
    autoRebalance: true,
    stopLoss: 5
  });

  const [appearance, setAppearance] = useState(() => {
    // Load from localStorage with error handling
    try {
    const saved = localStorage.getItem('appearance_settings');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure theme is valid
        if (parsed && typeof parsed === 'object') {
          return {
            theme: parsed.theme || 'light',
            currency: parsed.currency || 'USD',
            language: parsed.language || 'English'
          };
        }
      }
    } catch (error) {
      console.error('Error loading appearance settings:', error);
      // Clear invalid data
      localStorage.removeItem('appearance_settings');
    }
    return {
      theme: 'light',
      currency: 'USD',
      language: 'English'
    };
  });

  const [apiSettings, setApiSettings] = useState({
    bybitApiKey: '',
    bybitApiSecret: '',
    okxApiKey: '',
    okxApiSecret: '',
    okxPassphrase: '',
    bitunixApiKey: '',
    bitunixApiSecret: '',
    webhookUrl: '',
    webhookSecret: '',
    alertsEnabled: true
  });

  const [aiSettings, setAiSettings] = useState(() => {
    // Load AI API keys from localStorage or service
    const keys = openAIService.getApiKeys();
    return {
      openaiApiKey: '',
      deepseekApiKey: '',
      showKeys: false // Don't show full keys by default
    };
  });
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiKeysRefresh, setAiKeysRefresh] = useState(0); // Force re-render when keys change

  const [alerts, setAlerts] = useState({
    priceThreshold: 5,
    pnlThreshold: 10,
    volumeThreshold: 50,
    rsiOverbought: 70,
    rsiOversold: 30,
    emailAlerts: true,
    pushAlerts: true,
    webhookAlerts: false,
    telegramBot: '',
    discordWebhook: '',
    // New risk management alerts
    lowBalanceAlert: true,
    lowBalanceThreshold: 100,
    liquidationAlert: true,
    liquidationThreshold: 80,
    newTradeAlert: true,
    closePositionAlert: true,
    profitAlert: true,
    profitThreshold: 5,
    lossAlert: true,
    lossThreshold: 5,
    dailyPnlAlert: true,
    weeklyPnlAlert: false,
    monthlyPnlAlert: true
  });

  // Load alert settings from hook when available
  useEffect(() => {
    if (alertSettings) {
      setAlerts(prev => ({ ...prev, ...alertSettings }));
    }
  }, [alertSettings]);

  const [riskManagement, setRiskManagement] = useState({
    maxDailyLoss: 500,
    maxPositionSize: 1000,
    stopLossPercentage: 5,
    takeProfitPercentage: 10,
    maxOpenPositions: 5,
    riskPerTrade: 2,
    autoStopTrading: true,
    emergencyStopLoss: 20
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showAlertsConfig, setShowAlertsConfig] = useState(false);
  const [showRiskConfig, setShowRiskConfig] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    id: '',
    email: '',
    name: '',
    bio: '',
    location: '',
    website: '',
    profile_picture_url: ''
  });

  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load profile data on component mount
  // Apply theme whenever it changes
  useEffect(() => {
    // Ensure appearance.theme exists
    if (!appearance || !appearance.theme) {
      return;
    }
    
    try {
      // Remove all theme classes first
      document.documentElement.classList.remove('dark', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
      document.body.classList.remove('dark', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
      
      // Apply new theme
      const isColorTheme = ['blue', 'green', 'purple', 'orange'].includes(appearance.theme);
      
    if (appearance.theme === 'dark') {
        // Dark theme without color accent
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      } else if (isColorTheme) {
        // Color themes are light themes with accent colors
        document.documentElement.classList.add(`theme-${appearance.theme}`);
        document.body.classList.add(`theme-${appearance.theme}`);
    }
      // Light theme (default) - no classes needed
      
    console.log(`🎨 Theme applied: ${appearance.theme}`);
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, [appearance?.theme]); // Watch for theme changes

  useEffect(() => {
    // Check AI keys from Edge Function secrets on mount only
    const checkKeys = async () => {
      try {
        await openAIService.checkKeysFromEdgeFunction();
        // Update UI after check completes
        setAiKeysRefresh(prev => prev + 1);
      } catch (error) {
        console.error('Error checking AI keys:', error);
      }
    };
    checkKeys();
    
    // Also refresh from localStorage (fallback)
    openAIService.refreshKeys();
    // Only run on mount - remove aiKeysRefresh from dependencies to prevent infinite loop
  }, []); // Empty array = run only once on mount

  useEffect(() => {
    const loadProfile = async () => {
      try {
        console.log('🔄 Loading profile for user:', user?.email);
        
        // First, set current user data as default
        if (user) {
          const currentUserProfile = {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            bio: '',
            location: '',
            website: '',
            profile_picture_url: ''
          };
          console.log('📋 Setting current user profile as default:', currentUserProfile);
          setProfileData(currentUserProfile);
        }
        
        // Then try to get profile from backend
        const profile = await getProfile();
        console.log('📋 Profile loaded from backend:', profile);
        
        // Only use backend data if it has the correct email
        if (profile.email === user?.email) {
          console.log('✅ Using backend profile data');
          setProfileData(profile);
          if (profile.profile_picture_url) {
            setProfilePicturePreview(profile.profile_picture_url);
          }
        } else {
          console.log('⚠️ Backend profile has wrong email, keeping current user data');
        }
      } catch (error) {
        console.error('❌ Error loading profile:', error);
        // Keep the current user data that was already set
        console.log('📋 Keeping current user data due to error');
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]); // Removed getProfile from dependencies to prevent infinite loop

  // Load API keys into form when modal opens (show placeholders for existing keys)
  useEffect(() => {
    if (showApiConfig && apiKeys.length > 0) {
      const bybitKey = apiKeys.find(k => k.exchange === 'bybit');
      const okxKey = apiKeys.find(k => k.exchange === 'okx');
      const bitunixKey = apiKeys.find(k => k.exchange === 'bitunix');
      
      setApiSettings(prev => ({
        ...prev,
        // Don't populate actual keys (they're encrypted, show placeholders instead)
        bybitApiKey: bybitKey ? '••••••••••••••••' : '',
        bybitApiSecret: bybitKey ? '••••••••••••••••' : '',
        okxApiKey: okxKey ? '••••••••••••••••' : '',
        okxApiSecret: okxKey ? '••••••••••••••••' : '',
        okxPassphrase: okxKey ? '••••••••••••••••' : '',
        bitunixApiKey: bitunixKey ? '••••••••••••••••' : '',
        bitunixApiSecret: bitunixKey ? '••••••••••••••••' : '',
      }));
    } else if (showApiConfig && apiKeys.length === 0) {
      // Reset to defaults when opening modal with no existing keys
      setApiSettings(prev => ({
        ...prev,
        bybitApiKey: '',
        bybitApiSecret: '',
        okxApiKey: '',
        okxApiSecret: '',
        okxPassphrase: '',
        bitunixApiKey: '',
        bitunixApiSecret: '',
      }));
    }
  }, [showApiConfig, apiKeys]);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfilePicturePreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile) {
      console.log('⚠️ Profile save already in progress, ignoring duplicate click');
      return;
    }
    
    try {
      setIsSavingProfile(true);
      console.log('🔄 Starting profile save...');
      let profilePictureBase64 = '';
      
      // Convert profile picture to base64 if provided
      if (profilePicture) {
        console.log('📸 Converting profile picture to base64...');
        profilePictureBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(new Error('File read error'));
          reader.readAsDataURL(profilePicture);
        });
      }

      console.log('💾 Updating profile with backend...');
      // Update profile with backend
      const result = await updateProfile({
        name: profileData.name,
        bio: profileData.bio,
        location: profileData.location,
        website: profileData.website,
        profilePicture: profilePictureBase64
      });

      console.log('✅ Profile update result:', result);
      if (result.success) {
        // Update local state with returned data
        if (result.profilePictureUrl) {
          setProfilePicturePreview(result.profilePictureUrl);
          setProfileData(prev => ({ ...prev, profile_picture_url: result.profilePictureUrl }));
        }
        
        alert('Profile saved successfully!');
        setShowEditProfile(false);
      } else {
        alert(`Failed to save profile: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('❌ Error saving profile:', error);
      alert(`Failed to save profile: ${error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSecurityChange = (key: string, value: any) => {
    setSecurity(prev => ({ ...prev, [key]: value }));
  };

  const handleTradingChange = (key: string, value: any) => {
    setTrading(prev => ({ ...prev, [key]: value }));
  };

  const handleAppearanceChange = (key: string, value: any) => {
    console.log(`⚙️ Appearance change: ${key} = ${value}`);
    
    const newAppearance = { ...appearance, [key]: value };
    setAppearance(newAppearance);
    
    // Save to localStorage
    localStorage.setItem('appearance_settings', JSON.stringify(newAppearance));
    console.log(`💾 Saved to localStorage:`, newAppearance);
    
    // Apply theme immediately (useEffect will handle the actual application)
    if (key === 'theme') {
      console.log(`🎨 Theme will change to: ${value}`);
        // The useEffect hook will handle theme application
        alert(`✅ ${value.charAt(0).toUpperCase() + value.slice(1)} theme enabled!`);
    }
    
    // Apply language immediately
    if (key === 'language') {
      // Map display names to i18n codes
      const languageMap: { [key: string]: string } = {
        'English': 'en',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Chinese': 'zh',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Russian': 'ru',
        'Portuguese': 'pt',
        'Italian': 'it'
      };
      const i18nCode = languageMap[value] || 'en';
      localStorage.setItem('i18nextLng', i18nCode);
      console.log(`🌍 Language changed to: ${value} (${i18nCode})`);
      
      if (confirm(`Change language to ${value}?\n\nThe page will reload to apply the new language.`)) {
        window.location.reload();
      }
    }
    
    // Show confirmation for currency changes
    if (key === 'currency') {
      console.log(`💰 Currency changed to: ${value}`);
      alert(`✅ Currency changed to ${value}!`);
    }
  };

  const handleApiChange = (key: string, value: any) => {
    setApiSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAlertsChange = (key: string, value: any) => {
    setAlerts(prev => ({ ...prev, [key]: value }));
  };


  const ensureUserExists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check if user exists in users table
      const { error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (userCheckError && userCheckError.code === 'PGRST116') {
        // User doesn't exist, create them
        const { error: createUserError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            role: 'user',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (createUserError) {
          console.error('Error creating user:', createUserError);
          return false;
        }
        console.log('Created user:', user.id);
        return true;
      } else if (userCheckError) {
        console.error('Error checking user:', userCheckError);
        return false;
      }
      return true; // User already exists
    } catch (error) {
      console.error('Error ensuring user exists:', error);
      return false;
    }
  };

  const handleApiSave = async () => {
    try {
      // Ensure user exists before saving API keys
      const userExists = await ensureUserExists();
      if (!userExists) {
        alert('Failed to create user account. Please try again.');
        return;
      }

      // Save Bybit API key if provided
      if (apiSettings.bybitApiKey && apiSettings.bybitApiSecret) {
        await saveApiKey({
          exchange: 'bybit',
          apiKey: apiSettings.bybitApiKey,
          apiSecret: apiSettings.bybitApiSecret,
        });
      }

      // Save OKX API key if provided
      if (apiSettings.okxApiKey && apiSettings.okxApiSecret) {
        await saveApiKey({
          exchange: 'okx',
          apiKey: apiSettings.okxApiKey,
          apiSecret: apiSettings.okxApiSecret,
          passphrase: apiSettings.okxPassphrase,
        });
      }

      // Save Bitunix API key if provided
      if (apiSettings.bitunixApiKey && apiSettings.bitunixApiSecret) {
        await saveApiKey({
          exchange: 'bitunix',
          apiKey: apiSettings.bitunixApiKey,
          apiSecret: apiSettings.bitunixApiSecret,
          passphrase: '', // Bitunix doesn't use passphrase
        });
      }

      // Clear form fields after saving (for security - keys are encrypted in DB)
      setApiSettings(prev => ({
        bybitApiKey: '',
        bybitApiSecret: '',
        okxApiKey: '',
        okxApiSecret: '',
        okxPassphrase: '',
        bitunixApiKey: '',
        bitunixApiSecret: '',
        webhookUrl: prev.webhookUrl,
        webhookSecret: prev.webhookSecret,
        alertsEnabled: prev.alertsEnabled
      }));

    setShowApiConfig(false);
      alert('API keys saved successfully!');
    } catch (error: any) {
      alert(`Failed to save API keys: ${error.message}`);
    }
  };

  const handleSaveExchange = async (exchange: 'bybit' | 'okx' | 'bitunix') => {
    try {
      // Ensure user exists before saving API keys
      const userExists = await ensureUserExists();
      if (!userExists) {
        alert('Failed to create user account. Please try again.');
        return;
      }

      if (exchange === 'bybit') {
        if (!apiSettings.bybitApiKey || !apiSettings.bybitApiSecret) {
          alert('Please enter both API Key and API Secret for Bybit');
          return;
        }
        // Test connection first before saving
        const testResult = await testConnection({
          exchange: 'bybit',
          apiKey: apiSettings.bybitApiKey,
          apiSecret: apiSettings.bybitApiSecret,
        });
        
        if (!testResult.success) {
          const proceed = confirm(`⚠️ Connection test failed: ${testResult.message}\n\nDo you still want to save these keys?`);
          if (!proceed) return;
        }
        
        await saveApiKey({
          exchange: 'bybit',
          apiKey: apiSettings.bybitApiKey,
          apiSecret: apiSettings.bybitApiSecret,
        });
        // Clear only Bybit fields after saving
        setApiSettings(prev => ({
          ...prev,
          bybitApiKey: '',
          bybitApiSecret: '',
        }));
        alert('✅ Bybit API keys saved successfully!');
      } else if (exchange === 'okx') {
        if (!apiSettings.okxApiKey || !apiSettings.okxApiSecret) {
          alert('Please enter both API Key and API Secret for OKX');
          return;
        }
        // Test connection first before saving
        const testResult = await testConnection({
          exchange: 'okx',
          apiKey: apiSettings.okxApiKey,
          apiSecret: apiSettings.okxApiSecret,
          passphrase: apiSettings.okxPassphrase,
        });
        
        if (!testResult.success) {
          const proceed = confirm(`⚠️ Connection test failed: ${testResult.message}\n\nDo you still want to save these keys?`);
          if (!proceed) return;
        }
        
        await saveApiKey({
          exchange: 'okx',
          apiKey: apiSettings.okxApiKey,
          apiSecret: apiSettings.okxApiSecret,
          passphrase: apiSettings.okxPassphrase,
        });
        // Clear only OKX fields after saving
        setApiSettings(prev => ({
          ...prev,
          okxApiKey: '',
          okxApiSecret: '',
          okxPassphrase: '',
        }));
        alert('✅ OKX API keys saved successfully!');
      } else if (exchange === 'bitunix') {
        if (!apiSettings.bitunixApiKey || !apiSettings.bitunixApiSecret) {
          alert('Please enter both API Key and API Secret for Bitunix');
          return;
        }
        // Test connection first before saving
        const testResult = await testConnection({
          exchange: 'bitunix',
            apiKey: apiSettings.bitunixApiKey,
            apiSecret: apiSettings.bitunixApiSecret,
            passphrase: '' // Bitunix doesn't use passphrase
          });
        
        if (!testResult.success) {
          const proceed = confirm(`⚠️ Connection test failed: ${testResult.message}\n\nDo you still want to save these keys?`);
          if (!proceed) return;
        }
        
        await saveApiKey({
          exchange: 'bitunix',
          apiKey: apiSettings.bitunixApiKey,
          apiSecret: apiSettings.bitunixApiSecret,
          passphrase: '', // Bitunix doesn't use passphrase
        });
        // Clear only Bitunix fields after saving
        setApiSettings(prev => ({
          ...prev,
          bitunixApiKey: '',
          bitunixApiSecret: '',
        }));
        alert('✅ Bitunix API keys saved successfully!');
      }
    } catch (error: any) {
      alert(`Failed to save ${exchange.toUpperCase()} API keys: ${error.message}`);
    }
  };

  const handleAlertsSave = async () => {
    try {
      if (alertSettings) {
        await updateAlertSettings(alerts);
        alert('Alert settings saved successfully!');
      } else {
        // Fallback: save to localStorage if hook not ready
        localStorage.setItem('alert_settings', JSON.stringify(alerts));
        alert('Alert settings saved to local storage!');
      }
      setShowAlertsConfig(false);
    } catch (error: any) {
      console.error('Error saving alert settings:', error);
      alert(`Failed to save alert settings: ${error.message}`);
    }
  };

  const handleProfileChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = async () => {
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('New password must be at least 6 characters long');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      alert('New password must be different from current password');
      return;
    }

    try {
      setIsChangingPassword(true);

      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.currentPassword
      });

      if (signInError) {
        alert(`Current password is incorrect: ${signInError.message}`);
        setIsChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) {
        alert(`Failed to change password: ${updateError.message}`);
        setIsChangingPassword(false);
        return;
      }

      // Success
      alert('✅ Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowChangePassword(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      alert(`Failed to change password: ${error.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenEditProfile = async () => {
    console.log('🔄 Opening Edit Profile modal for user:', user?.email);
    
    // Force use current user data instead of database data
    if (user) {
      console.log('🔄 Forcing current user data for profile');
      const currentUserProfile = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        bio: '',
        location: '',
        website: '',
        profile_picture_url: ''
      };
      console.log('📋 Current user profile data:', currentUserProfile);
      setProfileData(currentUserProfile);
    }
    
    // Also try to get profile from backend as backup
    try {
      const profile = await getProfile();
      console.log('📋 Backend profile data:', profile);
      // Only use backend data if it has the correct email
      if (profile.email === user?.email) {
        console.log('✅ Using backend profile data');
        setProfileData(profile);
        if (profile.profile_picture_url) {
          setProfilePicturePreview(profile.profile_picture_url);
        }
      } else {
        console.log('⚠️ Backend profile has wrong email, using current user data');
      }
    } catch (error) {
      console.error('❌ Error refreshing profile:', error);
    }
    
    setShowEditProfile(true);
  };

  const handleTestConnection = async (exchange: 'bybit' | 'okx' | 'bitunix') => {
    try {
      let formData: ApiKeyFormData;
      
      if (exchange === 'bybit') {
        if (!apiSettings.bybitApiKey || !apiSettings.bybitApiSecret) {
          alert('Please enter both API Key and API Secret for Bybit');
          return;
        }
        formData = {
          exchange: 'bybit',
          apiKey: apiSettings.bybitApiKey,
          apiSecret: apiSettings.bybitApiSecret,
        };
      } else if (exchange === 'okx') {
        if (!apiSettings.okxApiKey || !apiSettings.okxApiSecret) {
          alert('Please enter both API Key and API Secret for OKX');
          return;
        }
        formData = {
          exchange: 'okx',
          apiKey: apiSettings.okxApiKey,
          apiSecret: apiSettings.okxApiSecret,
          passphrase: apiSettings.okxPassphrase,
        };
      } else if (exchange === 'bitunix') {
        if (!apiSettings.bitunixApiKey || !apiSettings.bitunixApiSecret) {
          alert('Please enter both API Key and API Secret for Bitunix');
          return;
        }
        formData = {
          exchange: 'bitunix',
            apiKey: apiSettings.bitunixApiKey,
            apiSecret: apiSettings.bitunixApiSecret,
            passphrase: '' // Bitunix doesn't use passphrase
          };
      } else {
        alert('Invalid exchange');
        return;
      }

      const result = await testConnection(formData);
      
      if (result.success) {
        alert(`✅ ${exchange.toUpperCase()} API connection successful!`);
      } else {
        alert(`❌ ${exchange.toUpperCase()} API connection failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      alert(`❌ Failed to test ${exchange.toUpperCase()} API: ${error.message || 'Network error'}`);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
      } else {
        navigate('/auth');
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleRiskChange = (key: string, value: any) => {
    setRiskManagement(prev => ({ ...prev, [key]: value }));
  };

  const handleRiskSave = () => {
    // Save risk management settings
    setShowRiskConfig(false);
  };

  const handleAiSettingsChange = (key: string, value: string) => {
    setAiSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAiSave = () => {
    try {
      // Save OpenAI API key
      if (aiSettings.openaiApiKey) {
        openAIService.setOpenAIKey(aiSettings.openaiApiKey);
      }

      // Save DeepSeek API key
      if (aiSettings.deepseekApiKey) {
        openAIService.setDeepSeekKey(aiSettings.deepseekApiKey);
      }

      // Refresh keys from localStorage to ensure sync
      openAIService.refreshKeys();
      
      // Trigger UI update
      setAiKeysRefresh(prev => prev + 1);

      setShowAiConfig(false);
      alert('AI API keys saved successfully!');
      
      // Small delay before reload to ensure localStorage is written and UI updates
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } catch (error: any) {
      alert(`Failed to save AI API keys: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Settings" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">

        {/* Profile Section */}
        <Card className="p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              {profilePicturePreview || profileData.profile_picture_url ? (
                <img 
                  src={profilePicturePreview || profileData.profile_picture_url} 
                  alt="Profile" 
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-200 flex items-center justify-center">
                  <i className="ri-user-line text-2xl text-gray-400"></i>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {profileData.name || user?.email?.split('@')[0] || 'User'}
              </h3>
              <p className="text-gray-500">{user?.email || 'No email'}</p>
              {profileData.bio && (
                <p className="text-sm text-gray-600 mt-1">{profileData.bio}</p>
              )}
              <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                user?.role === 'admin' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {user?.role === 'admin' ? 'Admin' : 'Pro Member'}
              </span>
            </div>
          </div>
          <button 
            onClick={handleOpenEditProfile}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
          >
            <i className="ri-edit-line mr-2"></i>
            Edit Profile
          </button>
          <button 
            onClick={async () => {
              console.log('🔄 Manual profile refresh for user:', user?.email);
              try {
                const profile = await getProfile();
                console.log('📋 Manual refresh - Profile data:', profile);
                setProfileData(profile);
                alert('Profile refreshed! Check console for details.');
              } catch (error) {
                console.error('❌ Manual refresh failed:', error);
                alert('Profile refresh failed! Check console for details.');
              }
            }}
            className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 px-4 rounded-lg transition-colors mt-2"
          >
            <i className="ri-refresh-line mr-2"></i>
            Refresh Profile Data
          </button>
        </Card>

        {/* API Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Exchange Connections</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${apiKeys.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`text-sm ${apiKeys.length > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {apiKeys.length > 0 ? `${apiKeys.length} Connected` : 'Not Connected'}
              </span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-4">Configure your exchange API keys to view balances and enable trading</p>
          
          {apiKeysLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading connections...</p>
                </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="ri-exchange-line text-4xl mb-2"></i>
              <p>No exchange connections found</p>
              <p className="text-sm">Connect your exchange API keys to get started</p>
                <button
                  onClick={() => setShowApiConfig(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                <i className="ri-add-line mr-2"></i>
                Connect Exchange
                </button>
              </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      apiKey.exchange === 'bybit' ? 'bg-orange-100' : 
                      apiKey.exchange === 'bitunix' ? 'bg-green-100' : 
                      'bg-blue-100'
                    }`}>
                      <i className={`${
                        apiKey.exchange === 'bybit' ? 'ri-currency-line text-orange-600' : 
                        apiKey.exchange === 'bitunix' ? 'ri-exchange-line text-green-600' : 
                        'ri-exchange-line text-blue-600'
                      }`}></i>
                </div>
                <div>
                      <p className="font-medium text-gray-900">{apiKey.exchange.toUpperCase()} API</p>
                  <p className="text-sm text-gray-500">
                        {apiKey.isActive ? 'Active' : 'Inactive'} • Live
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                      onClick={() => toggleApiKey(apiKey.id, !apiKey.isActive)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        apiKey.isActive 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {apiKey.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => deleteApiKey(apiKey.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                </button>
              </div>
            </div>
              ))}
              <button
                onClick={() => setShowApiConfig(true)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
              >
                <i className="ri-add-line mr-2"></i>
                Add Exchange Connection
              </button>
          </div>
          )}
        </Card>

        {/* AI API Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Recommendations</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                openAIService.isProviderAvailable('openai') || openAIService.isProviderAvailable('deepseek') 
                  ? 'bg-green-500' 
                  : 'bg-gray-400'
              }`}></div>
              <span className={`text-sm ${
                openAIService.isProviderAvailable('openai') || openAIService.isProviderAvailable('deepseek')
                  ? 'text-green-600' 
                  : 'text-gray-600'
              }`}>
                {openAIService.isProviderAvailable('openai') && openAIService.isProviderAvailable('deepseek')
                  ? 'Both Configured'
                  : openAIService.isProviderAvailable('openai')
                  ? 'OpenAI Only'
                  : openAIService.isProviderAvailable('deepseek')
                  ? 'DeepSeek Only'
                  : 'Not Configured'}
              </span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-4">Configure AI API keys for strategy recommendations (optional)</p>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  openAIService.isProviderAvailable('openai') ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <i className={`ri-openai-fill ${openAIService.isProviderAvailable('openai') ? 'text-green-600' : 'text-gray-400'} text-xl`}></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900">OpenAI API</p>
                  <p className="text-sm text-gray-500">
                    {openAIService.isProviderAvailable('openai') 
                      ? `Configured • ${openAIService.getApiKeys().openai}`
                      : 'Not configured'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiConfig(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  openAIService.isProviderAvailable('deepseek') ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <i className={`ri-brain-line ${openAIService.isProviderAvailable('deepseek') ? 'text-blue-600' : 'text-gray-400'}`}></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900">DeepSeek API</p>
                  <p className="text-sm text-gray-500">
                    {openAIService.isProviderAvailable('deepseek') 
                      ? `Configured • ${openAIService.getApiKeys().deepseek}`
                      : 'Not configured'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiConfig(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Configure
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            💡 Get API keys from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI</a> or <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DeepSeek</a>
          </p>
        </Card>

        {/* Risk Management */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Risk Management</h3>
            <button
              onClick={() => setShowRiskConfig(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Configure
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">Protect your capital with automated risk controls</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-shield-line text-red-600"></i>
                <span className="text-sm font-medium text-gray-900">Max Daily Loss</span>
              </div>
              <p className="text-xs text-gray-500">${riskManagement.maxDailyLoss}</p>
            </div>
            
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-pie-chart-line text-orange-600"></i>
                <span className="text-sm font-medium text-gray-900">Position Size</span>
              </div>
              <p className="text-xs text-gray-500">Max ${riskManagement.maxPositionSize}</p>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-stop-line text-blue-600"></i>
                <span className="text-sm font-medium text-gray-900">Stop Loss</span>
              </div>
              <p className="text-xs text-gray-500">{riskManagement.stopLossPercentage}%</p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-trophy-line text-green-600"></i>
                <span className="text-sm font-medium text-gray-900">Take Profit</span>
              </div>
              <p className="text-xs text-gray-500">{riskManagement.takeProfitPercentage}%</p>
            </div>
          </div>
        </Card>

        {/* Alerts Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alert Preferences</h3>
            <button
              onClick={() => setShowAlertsConfig(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Configure
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">Choose which alerts you want to receive</p>
          
          <div className="space-y-3">
            {[
              { key: 'newTradeAlert', label: 'New Trade Alerts', desc: 'Get notified when bots open new positions', icon: 'ri-add-circle-line', color: 'blue' },
              { key: 'closePositionAlert', label: 'Position Closed', desc: 'Alerts when positions are closed', icon: 'ri-close-circle-line', color: 'green' },
              { key: 'profitAlert', label: 'Profit Alerts', desc: 'Notifications for profitable trades', icon: 'ri-arrow-up-line', color: 'green' },
              { key: 'lossAlert', label: 'Loss Alerts', desc: 'Notifications for losing trades', icon: 'ri-arrow-down-line', color: 'red' },
              { key: 'lowBalanceAlert', label: 'Low Balance Alert', desc: 'Warning when account balance is low', icon: 'ri-wallet-line', color: 'orange' },
              { key: 'liquidationAlert', label: 'Liquidation Risk', desc: 'Alert when positions are at risk', icon: 'ri-alarm-warning-line', color: 'red' }
            ].map(({ key, label, desc, icon, color }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-${color}-100 rounded-full flex items-center justify-center`}>
                    <i className={`${icon} text-${color}-600`}></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAlertsChange(key, !alerts[key as keyof typeof alerts])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    alerts[key as keyof typeof alerts] ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      alerts[key as keyof typeof alerts] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-4">
            {[
              { key: 'push', label: 'Push Notifications', desc: 'Receive push notifications on your device' },
              { key: 'email', label: 'Email Alerts', desc: 'Get important updates via email' },
              { key: 'trading', label: 'Trading Alerts', desc: 'Notifications for bot actions and trades' },
              { key: 'price', label: 'Price Alerts', desc: 'Alerts for significant price movements' }
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{label}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => {/* handleNotificationChange(key, !notifications[key as keyof typeof notifications]) */}}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications[key as keyof typeof notifications] ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications[key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Security */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Add an extra layer of security</p>
              </div>
              <button
                onClick={() => handleSecurityChange('twoFactor', !security.twoFactor)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  security.twoFactor ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    security.twoFactor ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Biometric Login</p>
                <p className="text-sm text-gray-500">Use fingerprint or face ID</p>
              </div>
              <button
                onClick={() => handleSecurityChange('biometric', !security.biometric)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  security.biometric ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    security.biometric ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto Logout (minutes)
              </label>
              <select
                value={security.autoLogout}
                onChange={(e) => handleSecurityChange('autoLogout', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Trading Preferences */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Leverage
              </label>
              <select
                value={trading.defaultLeverage}
                onChange={(e) => handleTradingChange('defaultLeverage', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
                <option value={20}>20x</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level
              </label>
              <select
                value={trading.riskLevel}
                onChange={(e) => handleTradingChange('riskLevel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Auto Rebalance</p>
                <p className="text-sm text-gray-500">Automatically rebalance portfolio</p>
              </div>
              <button
                onClick={() => handleTradingChange('autoRebalance', !trading.autoRebalance)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  trading.autoRebalance ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    trading.autoRebalance ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Stop Loss (%)
              </label>
              <input
                type="number"
                value={trading.stopLoss}
                onChange={(e) => handleTradingChange('stopLoss', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                max="20"
                step="0.5"
              />
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Theme
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleAppearanceChange('theme', 'light')}
                  className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                    appearance.theme === 'light'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className="ri-sun-line text-2xl mb-1"></i>
                  <span className="font-medium text-sm">Light</span>
                </button>
                <button
                  onClick={() => handleAppearanceChange('theme', 'dark')}
                  className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                    appearance.theme === 'dark'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className="ri-moon-line text-2xl mb-1"></i>
                  <span className="font-medium text-sm">Dark</span>
                </button>
                <button
                  onClick={() => handleAppearanceChange('theme', 'blue')}
                  className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                    appearance.theme === 'blue'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className="ri-drop-line text-2xl mb-1"></i>
                  <span className="font-medium text-sm">Blue</span>
                </button>
                <button
                  onClick={() => handleAppearanceChange('theme', 'green')}
                  className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                    appearance.theme === 'green'
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className="ri-leaf-line text-2xl mb-1"></i>
                  <span className="font-medium text-sm">Green</span>
                </button>
                <button
                  onClick={() => handleAppearanceChange('theme', 'purple')}
                  className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                    appearance.theme === 'purple'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className="ri-magic-line text-2xl mb-1"></i>
                  <span className="font-medium text-sm">Purple</span>
                </button>
                <button
                  onClick={() => handleAppearanceChange('theme', 'orange')}
                  className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                    appearance.theme === 'orange'
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <i className="ri-fire-line text-2xl mb-1"></i>
                  <span className="font-medium text-sm">Orange</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
                Current theme: <strong className="capitalize">{appearance.theme}</strong> mode
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                value={appearance.currency}
                onChange={(e) => handleAppearanceChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="USD">🇺🇸 USD ($)</option>
                <option value="EUR">🇪🇺 EUR (€)</option>
                <option value="GBP">🇬🇧 GBP (£)</option>
                <option value="JPY">🇯🇵 JPY (¥)</option>
                <option value="CNY">🇨🇳 CNY (¥)</option>
                <option value="KRW">🇰🇷 KRW (₩)</option>
                <option value="AUD">🇦🇺 AUD ($)</option>
                <option value="CAD">🇨🇦 CAD ($)</option>
                <option value="CHF">🇨🇭 CHF (Fr)</option>
                <option value="BTC">₿ Bitcoin (BTC)</option>
                <option value="ETH">Ξ Ethereum (ETH)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                value={appearance.language}
                onChange={(e) => handleAppearanceChange('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="English">🇺🇸 English</option>
                <option value="Spanish">🇪🇸 Español</option>
                <option value="French">🇫🇷 Français</option>
                <option value="German">🇩🇪 Deutsch</option>
                <option value="Chinese">🇨🇳 中文</option>
                <option value="Japanese">🇯🇵 日本語</option>
                <option value="Korean">🇰🇷 한국어</option>
                <option value="Russian">🇷🇺 Русский</option>
                <option value="Portuguese">🇵🇹 Português</option>
                <option value="Italian">🇮🇹 Italiano</option>
              </select>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>💡 Note:</strong> Theme and currency changes apply immediately. 
                Language changes will refresh the page to apply translations.
              </p>
            </div>
          </div>
        </Card>

        {/* Account */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account</h3>
          <div className="space-y-3">
            <Button variant="secondary" className="w-full justify-start">
              <i className="ri-download-line mr-2"></i>
              Export Data
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              <i className="ri-refresh-line mr-2"></i>
              Reset Settings
            </Button>
            <button 
              onClick={handleSignOut}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 px-4 py-2 text-sm w-full justify-start"
            >
              <i className="ri-logout-box-line mr-2"></i>
              Sign Out
            </button>
          </div>
        </Card>

        {/* Email Notifications */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Email Notifications</h3>
            {emailSettingsLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          <p className="text-gray-500 text-sm mb-4">Configure email notifications for trading events</p>
          
          {emailPreferences ? (
            <div className="space-y-4">
              {/* Email Notifications Status (Read-only) */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">Email Notifications</span>
                  <p className="text-xs text-gray-500">Configure which email notifications you receive</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${emailPreferences.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                  {emailPreferences.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              {emailPreferences.enabled && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Notification Types</h4>
                  {[
                    { key: 'trade_executed', label: 'Trade Executed', desc: 'When a trade is executed' },
                    { key: 'bot_started', label: 'Bot Started', desc: 'When a bot starts trading' },
                    { key: 'bot_stopped', label: 'Bot Stopped', desc: 'When a bot stops trading' },
                    { key: 'position_opened', label: 'Position Opened', desc: 'When a new position is opened' },
                    { key: 'position_closed', label: 'Position Closed', desc: 'When a position is closed' },
                    { key: 'stop_loss_triggered', label: 'Stop Loss Triggered', desc: 'When stop loss is hit' },
                    { key: 'take_profit_triggered', label: 'Take Profit Triggered', desc: 'When take profit is hit' },
                    { key: 'error_occurred', label: 'Error Occurred', desc: 'When a bot encounters an error' },
                    { key: 'profit_alert', label: 'Profit Alert', desc: 'When profit threshold is reached' },
                    { key: 'loss_alert', label: 'Loss Alert', desc: 'When loss threshold is reached' },
                    { key: 'daily_summary', label: 'Daily Summary', desc: 'Daily trading summary email' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await updateEmailPreferences({
                              [key]: !emailPreferences[key as keyof typeof emailPreferences]
                            } as any);
                          } catch (error: any) {
                            alert(`Failed to update: ${error.message}`);
                          }
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${emailPreferences[key as keyof typeof emailPreferences] ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${emailPreferences[key as keyof typeof emailPreferences] ? 'translate-x-5' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!emailPreferences.enabled && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs text-yellow-800">
                    <i className="ri-information-line mr-1"></i>
                    Email notifications are currently disabled. Please contact an administrator to enable email notifications.
                  </p>
                </div>
              )}

              {/* Test Email Button */}
              {emailPreferences.enabled && (
                <div className="pt-4 border-t">
                  <button
                    onClick={async () => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                          alert('Please log in to test email notifications');
                          return;
                        }

                        const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';
                        const cleanUrl = supabaseUrl.replace('/rest/v1', '');
                        const functionUrl = `${cleanUrl}/functions/v1/email-notifications?action=test`;

                        const response = await fetch(functionUrl, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'Content-Type': 'application/json',
                            'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '',
                          },
                        });

                        const result = await response.json();
                        if (result.success) {
                          alert('✅ Test email sent successfully! Check your inbox.');
                        } else {
                          alert(`❌ Failed to send test email: ${result.error || result.message}`);
                        }
                      } catch (error: any) {
                        console.error('Error sending test email:', error);
                        alert(`Failed to send test email: ${error.message}`);
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium flex items-center justify-center"
                  >
                    <i className="ri-mail-send-line mr-2"></i>
                    Send Test Email
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading email preferences...</p>
            </div>
          )}
        </Card>

        {/* Telegram Notifications */}
        <TelegramSettings />

        {/* Paper Trading Balance */}
        <PaperTradingBalance />

        {/* App Info */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">App Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="text-gray-900">1.2.3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Build</span>
              <span className="text-gray-900">2024.01.15</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Status</span>
              <span className="text-green-600 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Connected
              </span>
            </div>
            <Button variant="secondary" className="w-full justify-start mt-4">
              <i className="ri-question-line mr-2"></i>
              Help &amp; Support
            </Button>
          </div>
        </Card>
      </div>

      {/* API Configuration Modal */}
      {showApiConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">API Configuration</h2>
                <button
                  onClick={() => setShowApiConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Bybit API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-currency-line text-orange-600 mr-2"></i>
                    Bybit API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiSettings.bybitApiKey}
                        onChange={(e) => handleApiChange('bybitApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Bybit API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.bybitApiSecret}
                        onChange={(e) => handleApiChange('bybitApiSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Bybit API Secret"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleTestConnection('bybit')}
                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Test Connection
                      </button>
                      <button
                        onClick={() => handleSaveExchange('bybit')}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                      >
                        <i className="ri-save-line mr-1"></i>
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* OKX API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-exchange-line text-blue-600 mr-2"></i>
                    OKX API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiSettings.okxApiKey}
                        onChange={(e) => handleApiChange('okxApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter OKX API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.okxApiSecret}
                        onChange={(e) => handleApiChange('okxApiSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter OKX API Secret"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Passphrase
                      </label>
                      <input
                        type="password"
                        value={apiSettings.okxPassphrase}
                        onChange={(e) => handleApiChange('okxPassphrase', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter OKX Passphrase"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleTestConnection('okx')}
                        className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Test Connection
                      </button>
                      <button
                        onClick={() => handleSaveExchange('okx')}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                      >
                        <i className="ri-save-line mr-1"></i>
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bitunix API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-exchange-line text-green-600 mr-2"></i>
                    Bitunix API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiSettings.bitunixApiKey}
                        onChange={(e) => handleApiChange('bitunixApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Bitunix API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.bitunixApiSecret}
                        onChange={(e) => handleApiChange('bitunixApiSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Bitunix API Secret"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleTestConnection('bitunix')}
                        className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Test Connection
                      </button>
                      <button
                        onClick={() => handleSaveExchange('bitunix')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                      >
                        <i className="ri-save-line mr-1"></i>
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* Webhook Settings */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-webhook-line text-purple-600 mr-2"></i>
                    Webhook Settings
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook URL
                      </label>
                      <input
                        type="url"
                        value={apiSettings.webhookUrl}
                        onChange={(e) => handleApiChange('webhookUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="https://your-webhook-url.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.webhookSecret}
                        onChange={(e) => handleApiChange('webhookSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter webhook secret"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowApiConfig(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800">
                  <i className="ri-information-line mr-1"></i>
                  <strong>Note:</strong> Each exchange can be saved individually using the "Save" button next to each exchange section. This allows you to configure and save one exchange at a time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI API Configuration Modal */}
      {showAiConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">AI API Configuration</h2>
                <button
                  onClick={() => setShowAiConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* OpenAI API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-openai-fill text-green-600 mr-2 text-xl"></i>
                    OpenAI API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={aiSettings.openaiApiKey}
                        onChange={(e) => handleAiSettingsChange('openaiApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder={openAIService.isProviderAvailable('openai') ? 'Enter new key to update' : 'Enter OpenAI API Key'}
                      />
                      {openAIService.isProviderAvailable('openai') && (
                        <p className="text-xs text-gray-500 mt-1">
                          Current: {openAIService.getApiKeys().openai}
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-800">
                        <strong>💡 Note:</strong> Get your API key from{' '}
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                          OpenAI Platform
                        </a>
                      </p>
                    </div>
                  </div>
                </div>

                {/* DeepSeek API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-brain-line text-blue-600 mr-2"></i>
                    DeepSeek API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={aiSettings.deepseekApiKey}
                        onChange={(e) => handleAiSettingsChange('deepseekApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder={openAIService.isProviderAvailable('deepseek') ? 'Enter new key to update' : 'Enter DeepSeek API Key'}
                      />
                      {openAIService.isProviderAvailable('deepseek') && (
                        <p className="text-xs text-gray-500 mt-1">
                          Current: {openAIService.getApiKeys().deepseek}
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-800">
                        <strong>💡 Note:</strong> Get your API key from{' '}
                        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="underline">
                          DeepSeek Platform
                        </a>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex space-x-3">
                    <button
                      onClick={handleAiSave}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                      Save API Keys
                    </button>
                    <button
                      onClick={() => setShowAiConfig(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Management Configuration Modal */}
      {showRiskConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Risk Management</h2>
                <button
                  onClick={() => setShowRiskConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Daily Limits */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Daily Limits</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Daily Loss ($)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.maxDailyLoss}
                        onChange={(e) => handleRiskChange('maxDailyLoss', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="50"
                        max="10000"
                        step="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Position Size ($)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.maxPositionSize}
                        onChange={(e) => handleRiskChange('maxPositionSize', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="100"
                        max="50000"
                        step="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Open Positions
                      </label>
                      <input
                        type="number"
                        value={riskManagement.maxOpenPositions}
                        onChange={(e) => handleRiskChange('maxOpenPositions', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="20"
                        step="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk Percentages */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Risk Percentages</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stop Loss Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.stopLossPercentage}
                        onChange={(e) => handleRiskChange('stopLossPercentage', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="20"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Take Profit Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.takeProfitPercentage}
                        onChange={(e) => handleRiskChange('takeProfitPercentage', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="50"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Risk Per Trade (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.riskPerTrade}
                        onChange={(e) => handleRiskChange('riskPerTrade', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="0.5"
                        max="10"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Emergency Stop Loss (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.emergencyStopLoss}
                        onChange={(e) => handleRiskChange('emergencyStopLoss', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="10"
                        max="50"
                        step="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Controls */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Automatic Controls</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Auto Stop Trading</span>
                        <p className="text-xs text-gray-500">Stop all bots when daily loss limit is reached</p>
                      </div>
                      <button
                        onClick={() => handleRiskChange('autoStopTrading', !riskManagement.autoStopTrading)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          riskManagement.autoStopTrading ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            riskManagement.autoStopTrading ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowRiskConfig(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRiskSave}
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Configuration Modal */}
      {showAlertsConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Alert Configuration</h2>
                <button
                  onClick={() => setShowAlertsConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Trading Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Trading Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">New Trade Alerts</span>
                        <p className="text-xs text-gray-500">Notify when bots open new positions</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('newTradeAlert', !alerts.newTradeAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.newTradeAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.newTradeAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Close Position Alerts</span>
                        <p className="text-xs text-gray-500">Notify when positions are closed</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('closePositionAlert', !alerts.closePositionAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.closePositionAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.closePositionAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* P&L Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">P&L Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Profit Alerts</span>
                        <p className="text-xs text-gray-500">Notify for profitable trades</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('profitAlert', !alerts.profitAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.profitAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.profitAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.profitAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Profit Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={alerts.profitThreshold}
                          onChange={(e) => handleAlertsChange('profitThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="1"
                          max="50"
                          step="0.5"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Loss Alerts</span>
                        <p className="text-xs text-gray-500">Notify for losing trades</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('lossAlert', !alerts.lossAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.lossAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.lossAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.lossAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Loss Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={alerts.lossThreshold}
                          onChange={(e) => handleAlertsChange('lossThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="1"
                          max="20"
                          step="0.5"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Risk Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Low Balance Alert</span>
                        <p className="text-xs text-gray-500">Warning when balance is low</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('lowBalanceAlert', !alerts.lowBalanceAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.lowBalanceAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.lowBalanceAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.lowBalanceAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Low Balance Threshold ($)
                        </label>
                        <input
                          type="number"
                          value={alerts.lowBalanceThreshold}
                          onChange={(e) => handleAlertsChange('lowBalanceThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="10"
                          max="1000"
                          step="10"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Liquidation Risk Alert</span>
                        <p className="text-xs text-gray-500">Alert when positions are at risk</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('liquidationAlert', !alerts.liquidationAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.liquidationAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.liquidationAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.liquidationAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Liquidation Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={alerts.liquidationThreshold}
                          onChange={(e) => handleAlertsChange('liquidationThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="50"
                          max="95"
                          step="5"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Reporting Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">P&L Reports</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Daily P&L Report</span>
                        <p className="text-xs text-gray-500">Daily profit/loss summary</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('dailyPnlAlert', !alerts.dailyPnlAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.dailyPnlAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.dailyPnlAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Weekly P&L Report</span>
                        <p className="text-xs text-gray-500">Weekly profit/loss summary</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('weeklyPnlAlert', !alerts.weeklyPnlAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.weeklyPnlAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.weeklyPnlAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Monthly P&L Report</span>
                        <p className="text-xs text-gray-500">Monthly profit/loss summary</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('monthlyPnlAlert', !alerts.monthlyPnlAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.monthlyPnlAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.monthlyPnlAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notification Channels */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Notification Channels</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Email Alerts</span>
                      <button
                        onClick={() => handleAlertsChange('emailAlerts', !alerts.emailAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.emailAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.emailAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Push Notifications</span>
                      <button
                        onClick={() => handleAlertsChange('pushAlerts', !alerts.pushAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.pushAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.pushAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowAlertsConfig(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAlertsSave}
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Edit Profile</h2>
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-4">
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Picture
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                      {profilePicturePreview ? (
                        <img 
                          src={profilePicturePreview} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="ri-user-line text-2xl text-gray-400"></i>
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                        id="profile-picture"
                      />
                      <label
                        htmlFor="profile-picture"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                      >
                        <i className="ri-upload-line mr-2"></i>
                        Upload Photo
                      </label>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => handleProfileChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    placeholder="Email cannot be changed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={profileData.bio || ''}
                    onChange={(e) => handleProfileChange('bio', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about yourself"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={profileData.location || ''}
                    onChange={(e) => handleProfileChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="City, Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={profileData.website || ''}
                    onChange={(e) => handleProfileChange('website', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                {/* Change Password Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">Change Password</h3>
                      <p className="text-xs text-gray-500">Update your account password</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowChangePassword(!showChangePassword);
                        if (showChangePassword) {
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          });
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      {showChangePassword ? 'Cancel' : 'Change Password'}
                    </button>
                  </div>

                  {showChangePassword && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter current password"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter new password (min. 6 characters)"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Confirm new password"
                        />
                      </div>

                      <button
                        onClick={handlePasswordChange}
                        disabled={isChangingPassword}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isChangingPassword ? (
                          <>
                            <i className="ri-loader-4-line animate-spin mr-2"></i>
                            Changing Password...
                          </>
                        ) : (
                          <>
                            <i className="ri-lock-password-line mr-2"></i>
                            Update Password
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowEditProfile(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveProfile}
                  className="flex-1"
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

