import { GOOGLE_CONFIG } from './config.js';
import { SettingsManager } from './settings/settings-manager';

class GoogleAuth {
  constructor() {
    this.isInitialized = false;
    this.accessToken = null;
    this.codeClient = null;
    this.userInfo = null;
  }

  async init() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Load Google API library first
      this.loadGoogleAPI().then(() => {
        this.initializeGIS().then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    });
  }

  async initializeGIS() {
    return new Promise((resolve, reject) => {
      // Load Google Identity Services
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.onload = () => {
        this.setupGIS().then(resolve).catch(reject);
      };
      gisScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(gisScript);
    });
  }

  async setupGIS() {
    return new Promise((resolve, reject) => {
      const loadTimeout = setTimeout(() => {
        reject(new Error('Google API setup timeout'));
      }, 10000);

      window.gapi.load('client', async () => {
        try {
          clearTimeout(loadTimeout);

          await window.gapi.client.init({
            discoveryDocs: GOOGLE_CONFIG.DISCOVERY_DOCS
          });

          // Use token client for implicit flow instead of code client
          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.CLIENT_ID,
            scope: GOOGLE_CONFIG.SCOPE,
            callback: (response) => {
              if (response.error) {
                console.error('Token response error:', response);
                reject(new Error(`Google sign-in failed: ${response.error}`));
                return;
              }

              this.accessToken = response.access_token;
              const tokenInfo = {
                access_token: response.access_token,
                expires_at: Date.now() + (response.expires_in * 1000),
                scope: response.scope
              };

              localStorage.setItem('google_token', JSON.stringify(tokenInfo));
              resolve(tokenInfo);
            }
          });

          this.isInitialized = true;
          resolve();
        } catch (error) {
          clearTimeout(loadTimeout);
          console.error('Google API setup error:', error);
          let errorMsg = 'Unknown setup error';
          if (error && typeof error === 'object') {
            errorMsg = error.message || error.error || error.details || JSON.stringify(error);
          } else if (error) {
            errorMsg = error.toString();
          }
          reject(new Error(`Failed to setup Google API: ${errorMsg}`));
        }
      });
    });
  }


  async signIn() {
    if (!this.isInitialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.callback = (response) => {
          if (response.error) {
            console.error('Token response error:', response);
            reject(new Error(`Google sign-in failed: ${response.error}`));
            return;
          }

          // Check if Drive scope was granted
          const hasRequiredScopes = response.scope &&
            response.scope.includes('https://www.googleapis.com/auth/drive.readonly');

          if (!hasRequiredScopes) {
            console.warn('Drive scope not granted, retrying with consent prompt');
            // Token was granted but without Drive scope, request again with consent
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
            return;
          }

          this.accessToken = response.access_token;
          const tokenInfo = {
            access_token: response.access_token,
            expires_at: Date.now() + (response.expires_in * 1000),
            scope: response.scope
          };

          localStorage.setItem('google_token', JSON.stringify(tokenInfo));
          resolve(tokenInfo);
        };
        // First try without forcing consent (better UX for returning users)
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (error) {
        console.error('Google sign-in error:', error);
        let errorMsg = 'Unknown sign-in error';
        if (error && typeof error === 'object') {
          errorMsg = error.error || error.message || error.details || JSON.stringify(error);
        } else if (error) {
          errorMsg = error.toString();
        }
        reject(new Error(`Google sign-in failed: ${errorMsg}`));
      }
    });
  }

  async getValidToken() {
    // Check stored token first
    const stored = localStorage.getItem('google_token');
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
        localStorage.removeItem('google_token');
      }
    }

    // Need to sign in
    return await this.signIn();
  }

  async getUserInfo() {
    const token = await this.getValidToken();

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
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

  async downloadFile(fileId, signal = null) {
    const token = await this.getValidToken();

    try {
      // First get file metadata
      const metaResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`
          },
          signal: signal
        }
      );

      if (!metaResponse.ok) {
        // 403 likely means insufficient permissions - clear token and prompt re-auth
        if (metaResponse.status === 403) {
          this.signOut();
          throw new Error('Insufficient permissions to access Google Drive. Please sign in again and grant Drive access.');
        }
        throw new Error(`Failed to get file metadata: ${metaResponse.status}`);
      }

      const metadata = await metaResponse.json();

      // Download the actual file
      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`
          },
          signal: signal
        }
      );

      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.status}`);
      }

      const blob = await fileResponse.blob();

      // Create a File object with the correct name and type
      return new File([blob], metadata.name, {
        type: metadata.mimeType || 'audio/mpeg'
      });

    } catch (error) {
      throw new Error(`Google Drive download failed: ${error.message}`);
    }
  }

  async listAudioFilesInFolder(folderId) {
    const token = await this.getValidToken();

    try {
      const audioMimeTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/flac',
        'audio/x-flac',
        'audio/aac',
        'audio/mp4',
        'audio/ogg',
        'audio/x-m4a'
      ];

      const mimeQuery = audioMimeTypes.map(type => `mimeType='${type}'`).join(' or ');
      const query = `'${folderId}' in parents and (${mimeQuery}) and trashed=false`;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,videoMediaMetadata)&pageSize=1000`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          this.signOut();
          throw new Error('Insufficient permissions to access Google Drive folder. Please sign in again.');
        }
        throw new Error(`Failed to list folder contents: ${response.status}`);
      }

      const data = await response.json();
      return data.files || [];

    } catch (error) {
      throw new Error(`Failed to list folder: ${error.message}`);
    }
  }

  async listFilesInFolder(folderId, extension) {
    const token = await this.getValidToken();

    try {
      // Query for files in the folder with specific extension
      const query = `'${folderId}' in parents and trashed=false`;
      let allFiles = [];
      let nextPageToken = null;

      // Fetch all pages using pagination
      do {
        const url = nextPageToken
          ? `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType),nextPageToken&pageSize=1000&pageToken=${nextPageToken}`
          : `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType),nextPageToken&pageSize=1000`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token.access_token}`
          }
        });

        if (!response.ok) {
          if (response.status === 403) {
            this.signOut();
            throw new Error('Insufficient permissions to access Google Drive folder. Please sign in again.');
          }
          throw new Error(`Failed to list folder contents: ${response.status}`);
        }

        const data = await response.json();
        allFiles = allFiles.concat(data.files || []);
        nextPageToken = data.nextPageToken;

      } while (nextPageToken);

      // Filter by extension if provided
      if (extension) {
        return allFiles.filter(file =>
          file.name.toLowerCase().endsWith(extension.toLowerCase())
        );
      }

      return allFiles;

    } catch (error) {
      throw new Error(`Failed to list folder: ${error.message}`);
    }
  }

  async downloadFileHeaders(fileId, bytesLimit = null, signal = null) {
    // Use bytesLimit from settings if not explicitly provided
    if (bytesLimit === null) {
      bytesLimit = SettingsManager.getDownloadChunkSize();
    }

    const token = await this.getValidToken();

    try {
      // Use HTTP Range header to download only the configured chunk size
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Range': `bytes=0-${bytesLimit - 1}`
          },
          signal: signal
        }
      );

      if (!response.ok && response.status !== 206) {
        throw new Error(`Failed to download file headers: ${response.status}`);
      }

      return await response.blob();

    } catch (error) {
      throw new Error(`Failed to download headers: ${error.message}`);
    }
  }

  async getFileMetadata(driveFile) {
    // If the driveFile object already has videoMediaMetadata, we can just return it.
    if (driveFile.videoMediaMetadata) {
      return driveFile;
    }

    const token = await this.getValidToken();

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFile.id}?fields=name,mimeType,size,modifiedTime,videoMediaMetadata`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          this.signOut();
          throw new Error('Insufficient permissions to access Google Drive. Please sign in again and grant Drive access.');
        }
        throw new Error(`Failed to get file metadata: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`Google Drive metadata fetch failed: ${error.message}`);
    }
  }

  signOut() {
    if (this.accessToken && window.google) {
      // Revoke the access token
      window.google.accounts.oauth2.revoke(this.accessToken);
    }

    this.accessToken = null;
    localStorage.removeItem('google_token');
  }

  isSignedIn() {
    const stored = localStorage.getItem('google_token');
    if (!stored) return false;

    try {
      const tokenInfo = JSON.parse(stored);
      return tokenInfo.expires_at > Date.now();
    } catch {
      return false;
    }
  }
}

export default GoogleAuth;
