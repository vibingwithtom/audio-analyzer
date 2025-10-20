import { BOX_CONFIG } from './config.js';
import { SettingsManager } from './settings/settings-manager';

class BoxAuth {
  constructor() {
    this.isInitialized = false;
    this.accessToken = null;
    this.userInfo = null;
  }

  async init() {
    if (this.isInitialized) return;

    // Check if we're returning from OAuth callback
    await this.handleOAuthCallback();

    this.isInitialized = true;
  }

  async handleOAuthCallback() {
    // Check for authorization code in URL query (from authorization code flow)
    const params = new URLSearchParams(window.location.search);

    if (params.has('code')) {
      const code = params.get('code');
      const state = params.get('state');

      // Verify state to prevent CSRF
      const storedState = localStorage.getItem('box_oauth_state');
      if (!storedState || storedState !== state) {
        console.error('OAuth state mismatch');
        return false;
      }

      try {
        // Exchange the code for an access token via our Cloud Function
        const tokenResponse = await fetch(`${BOX_CONFIG.PROXY_URL}?action=token&code=${encodeURIComponent(code)}`);

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('[Box OAuth] Token exchange failed:', errorText);
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();

        const tokenInfo = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000)
        };

        localStorage.setItem('box_token', JSON.stringify(tokenInfo));
        this.accessToken = tokenData.access_token;

        // Store a flag to indicate we just authenticated with Box
        localStorage.setItem('box_just_authenticated', 'true');

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);

        return true;
      } catch (error) {
        console.error('Failed to exchange authorization code:', error);
        return false;
      }
    }

    return false;
  }

  async signIn() {
    if (!this.isInitialized) {
      await this.init();
    }

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('box_oauth_state', state);

    // Save current tab so we can restore it after OAuth redirect
    // This is read from the tab store and will be restored in App.svelte
    const currentTab = localStorage.getItem('current_tab');
    if (currentTab) {
      localStorage.setItem('box_oauth_return_tab', currentTab);
    }

    // Build authorization URL for authorization code flow
    const authUrl = new URL(BOX_CONFIG.AUTHORIZATION_URL);
    authUrl.searchParams.append('client_id', BOX_CONFIG.CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', BOX_CONFIG.REDIRECT_URI);
    authUrl.searchParams.append('state', state);
    // Box OAuth doesn't require explicit scopes - they're configured in the Box app settings

    // Redirect to Box authorization
    window.location.href = authUrl.toString();
  }

  async getValidToken() {
    // Check stored token first
    const stored = localStorage.getItem('box_token');
    if (stored) {
      try {
        const tokenInfo = JSON.parse(stored);
        // Check if token is still valid (with 5 minute buffer)
        if (tokenInfo.expires_at > Date.now() + 300000) {
          this.accessToken = tokenInfo.access_token;
          return tokenInfo;
        }
      } catch (error) {
        console.warn('Invalid stored token:', error);
        localStorage.removeItem('box_token');
      }
    }

    // Need to sign in
    throw new Error('Not signed in to Box');
  }

  async getUserInfo() {
    const token = await this.getValidToken();

    try {
      const response = await fetch(`${BOX_CONFIG.API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      const userInfo = await response.json();
      this.userInfo = userInfo;
      return userInfo;
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  async downloadFile(fileId, sharedLink = null) {
    try {
      // Use authenticated access with Box API
      const token = await this.getValidToken();

      const headers = {
        'Authorization': `Bearer ${token.access_token}`
      };

      // First get file metadata
      const metaResponse = await fetch(
        `${BOX_CONFIG.API_URL}/files/${fileId}`,
        { headers }
      );

      if (!metaResponse.ok) {
        const errorText = await metaResponse.text();
        console.error('[Box Download] Metadata fetch failed:', metaResponse.status, errorText);
        if (metaResponse.status === 401) {
          this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(`Failed to get file metadata: ${metaResponse.status}`);
      }

      const metadata = await metaResponse.json();

      // Download the actual file
      const fileResponse = await fetch(
        `${BOX_CONFIG.API_URL}/files/${fileId}/content`,
        { headers }
      );

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('[Box Download] File download failed:', fileResponse.status, errorText);
        throw new Error(`Failed to download file: ${fileResponse.status}`);
      }

      const blob = await fileResponse.blob();

      return new File([blob], metadata.name, {
        type: metadata.content_type || 'audio/mpeg'
      });

    } catch (error) {
      throw new Error(`Box download failed: ${error.message}`);
    }
  }

  async listAudioFilesInFolder(folderId, sharedLink = null) {
    try {
      const apiUrl = `${BOX_CONFIG.API_URL}/folders/${folderId}/items?fields=id,name,type,size,modified_at&limit=1000`;

      let proxyUrl = `${BOX_CONFIG.PROXY_URL}?url=${encodeURIComponent(apiUrl)}`;

      if (sharedLink) {
        // Use shared link access via proxy
        proxyUrl += `&boxapi=${encodeURIComponent(sharedLink)}`;
      } else {
        // Use authenticated access via proxy
        const token = await this.getValidToken();
        proxyUrl += `&token=${encodeURIComponent(token.access_token)}`;
      }

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        if (!sharedLink && response.status === 401) {
          this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(`Failed to list folder contents: ${response.status}`);
      }

      const data = await response.json();
      const allItems = data.entries || [];

      // Filter for audio files based on extension
      const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'];
      const audioFiles = allItems.filter(item => {
        if (item.type !== 'file') return false;
        const name = item.name.toLowerCase();
        return audioExtensions.some(ext => name.endsWith(ext));
      });

      return audioFiles;

    } catch (error) {
      throw new Error(`Failed to list folder: ${error.message}`);
    }
  }

  async listFilesInFolder(folderId, extension, sharedLink = null) {
    try {
      const headers = {};

      if (sharedLink) {
        // Use shared link access
        headers['BoxApi'] = `shared_link=${sharedLink}`;
      } else {
        // Use authenticated access
        const token = await this.getValidToken();
        headers['Authorization'] = `Bearer ${token.access_token}`;
      }

      const response = await fetch(
        `${BOX_CONFIG.API_URL}/folders/${folderId}/items?fields=id,name,type&limit=1000`,
        { headers }
      );

      if (!response.ok) {
        if (!sharedLink && response.status === 401) {
          this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(`Failed to list folder contents: ${response.status}`);
      }

      const data = await response.json();
      const allItems = data.entries || [];

      // Filter for files only
      let files = allItems.filter(item => item.type === 'file');

      // Filter by extension if provided
      if (extension) {
        files = files.filter(file =>
          file.name.toLowerCase().endsWith(extension.toLowerCase())
        );
      }

      return files;

    } catch (error) {
      throw new Error(`Failed to list folder: ${error.message}`);
    }
  }

  async downloadFileHeaders(fileId, bytesLimit = null, sharedLink = null) {
    // Use bytesLimit from settings if not explicitly provided
    if (bytesLimit === null) {
      bytesLimit = SettingsManager.getDownloadChunkSize();
    }

    try {
      const headers = {
        'Range': `bytes=0-${bytesLimit - 1}`
      };

      if (sharedLink) {
        headers['BoxApi'] = `shared_link=${sharedLink}`;
      } else {
        const token = await this.getValidToken();
        headers['Authorization'] = `Bearer ${token.access_token}`;
      }

      const response = await fetch(
        `${BOX_CONFIG.API_URL}/files/${fileId}/content`,
        { headers }
      );

      if (!response.ok && response.status !== 206) {
        throw new Error(`Failed to download file headers: ${response.status}`);
      }

      return await response.blob();

    } catch (error) {
      throw new Error(`Failed to download headers: ${error.message}`);
    }
  }

  async getFileMetadata(boxFile, sharedLink = null) {
    try {
      const headers = {};

      if (sharedLink) {
        headers['BoxApi'] = `shared_link=${sharedLink}`;
      } else {
        const token = await this.getValidToken();
        headers['Authorization'] = `Bearer ${token.access_token}`;
      }

      const response = await fetch(
        `${BOX_CONFIG.API_URL}/files/${boxFile.id}?fields=id,name,size,modified_at,content_type`,
        { headers }
      );

      if (!response.ok) {
        if (!sharedLink && response.status === 401) {
          this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(`Failed to get file metadata: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`Box metadata fetch failed: ${error.message}`);
    }
  }

  async getFolderMetadata(folderId, sharedLink = null) {
    try {
      const headers = {};

      if (sharedLink) {
        headers['BoxApi'] = `shared_link=${sharedLink}`;
      } else {
        const token = await this.getValidToken();
        headers['Authorization'] = `Bearer ${token.access_token}`;
      }

      const response = await fetch(
        `${BOX_CONFIG.API_URL}/folders/${folderId}?fields=id,name,type`,
        { headers }
      );

      if (!response.ok) {
        if (!sharedLink && response.status === 401) {
          this.signOut();
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(`Failed to get folder metadata: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`Box folder metadata fetch failed: ${error.message}`);
    }
  }

  signOut() {
    this.accessToken = null;
    this.userInfo = null;
    localStorage.removeItem('box_token');
    localStorage.removeItem('box_oauth_state');
  }

  isSignedIn() {
    const stored = localStorage.getItem('box_token');
    if (!stored) return false;

    try {
      const tokenInfo = JSON.parse(stored);
      return tokenInfo.expires_at > Date.now();
    } catch {
      return false;
    }
  }
}

export default BoxAuth;
