// js/auth-utils.js
// Lightweight auth helpers used by reg/login pages and auth.js
(function () {
  /** Normalize an email: trim and lowercase */
  function normalizeEmail(email) {
    return (String(email || '').trim().toLowerCase());
  }

  /**
   * showModalCompat(message, opts)
   * A wrapper around window.showModal() used by auth.js.  Falls back to alert().
   * opts may be { title, callback } or a callback function.
   */
  function showModalCompat(message, opts) {
    const options = typeof opts === 'function' ? { callback: opts } : (opts || {});
    if (typeof window.showModal === 'function') {
      try {
        window.showModal(String(message), options);
        return;
      } catch (e) {
        // ignore and fall back
      }
    }
    // fallback alert
    alert(String(message));
    if (typeof options.callback === 'function') options.callback();
  }

  /** Build a storage key for a given email */
  function getUserKey(email) {
    return 'user_' + normalizeEmail(email);
  }
  /** Retrieve a user record from localStorage */
  function getUser(email) {
    try {
      return JSON.parse(localStorage.getItem(getUserKey(email)) || '{}');
    } catch {
      return {};
    }
  }
  /** Save a user record to localStorage */
  function saveUser(email, userObj) {
    if (!email) throw new Error('email required');
    localStorage.setItem(getUserKey(email), JSON.stringify(userObj));
  }

  // ---------------------------------------------------------------------------
  // *** Added async server functions ***

  /**
   * register(formData)
   * Attempts to register the user via the Netlify API at /api/register.
   * Falls back to localStorage registration if the network call fails.
   * Returns { ok: boolean, reason?: string, user?: object }.
   */
  async function register(formData) {
    const email = normalizeEmail(formData.email);
    if (!email) return { ok: false, reason: 'missing_email' };
    if (!formData.password) return { ok: false, reason: 'missing_password' };

    try {
      // Compose a display name from first & last name (if provided)
      const name = (formData.firstName || '') + (formData.lastName ? ' ' + formData.lastName : '');
      // Call the serverless register function
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || formData.name || email,
          email: formData.email,
          password: formData.password,
          address: formData.address || ''
        })
      });
      const data = await resp.json();
      // Handle server errors
      if (!resp.ok || !data || data.error) {
        const reason = data && data.error ? data.error : 'register_error';
        // Map duplicate account error to 'exists'
        if (reason === 'User with that username or email already exists') {
          return { ok: false, reason: 'exists' };
        }
        return { ok: false, reason };
      }
      // Build a local user record for UI and fallback
      const user = {
        email: data.email || email,
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        name: name || data.username || email,
        phone: formData.phone || '',
        dob: formData.dob || '',
        address: formData.address || '',
        nin: formData.nin || '',
        gender: formData.gender || '',
        bank: formData.bank || '',
        accountNumber: formData.accountNumber || '',
        accountName: formData.accountName || '',
        password: formData.password || '',
        avatar: formData.avatar || ''
      };
      // Save locally and update auth state
      try { saveUser(email, user); } catch (e) {}
      localStorage.setItem('loggedInUser', email);
      if (typeof window.saveLoggedInUserChanges === 'function') {
        window.saveLoggedInUserChanges(user);
      } else {
        localStorage.setItem('nestedProfile', JSON.stringify(user));
      }
      localStorage.setItem('nestedProfile_lastUpdated', Date.now().toString());
      return { ok: true, user };
    } catch (err) {
      // Network error or server unreachable: fallback to local registration
      try {
        if (localStorage.getItem(getUserKey(email))) return { ok: false, reason: 'exists' };
        const user = {
          email,
          firstName: formData.firstName || '',
          lastName: formData.lastName || '',
          name: (formData.firstName || '') + (formData.lastName ? ' ' + formData.lastName : ''),
          phone: formData.phone || '',
          dob: formData.dob || '',
          address: formData.address || '',
          nin: formData.nin || '',
          gender: formData.gender || '',
          bank: formData.bank || '',
          accountNumber: formData.accountNumber || '',
          accountName: formData.accountName || '',
          password: formData.password || '',
          avatar: formData.avatar || ''
        };
        saveUser(email, user);
        localStorage.setItem('loggedInUser', email);
        if (typeof window.saveLoggedInUserChanges === 'function') {
          window.saveLoggedInUserChanges(user);
        } else {
          localStorage.setItem('nestedProfile', JSON.stringify(user));
        }
        localStorage.setItem('nestedProfile_lastUpdated', Date.now().toString());
        return { ok: true, user };
      } catch (localErr) {
        return {
          ok: false,
          reason: localErr && localErr.message ? localErr.message : 'localStorage error'
        };
      }
    }
  }

  /**
   * login(emailRaw, password)
   * Attempts to authenticate via the Netlify API at /api/login.
   * Falls back to localStorage login if the API call fails or returns a
   * user-not-found/invalid-password error.
   * Returns { ok: boolean, reason?: string, user?: object }.
   */
  async function login(emailRaw, password) {
    const email = normalizeEmail(emailRaw);
    if (!email) return { ok: false, reason: 'missing_email' };

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: emailRaw, password })
      });
      const data = await resp.json();
      if (!resp.ok || !data || data.error) {
        const reasonMap = {
          'Invalid password': 'invalid_password',
          'User not found': 'not_found'
        };
        const reason = reasonMap[data && data.error] || 'login_failed';
        // Only fall back to local login for 'not_found' or 'invalid_password'
        if (reason !== 'not_found' && reason !== 'invalid_password') {
          return { ok: false, reason };
        }
      } else if (data && data.email) {
        // Successful API login
        const user = {
          email: data.email,
          name: data.username || data.email,
          password
        };
        try {
          saveUser(email, Object.assign(getUser(email), user));
        } catch (e) {}
        localStorage.setItem('loggedInUser', email);
        if (typeof window.saveLoggedInUserChanges === 'function') {
          window.saveLoggedInUserChanges(user);
        } else {
          localStorage.setItem('nestedProfile', JSON.stringify(user));
        }
        localStorage.setItem('nestedProfile_lastUpdated', Date.now().toString());
        return { ok: true, user };
      }
    } catch (err) {
      // ignore network errors and continue to fallback
    }

    // Fallback: attempt to log in via localStorage
    const stored = localStorage.getItem(getUserKey(email));
    if (!stored) return { ok: false, reason: 'not_found' };
    const user = JSON.parse(stored);
    if (String(user.password || '') !== String(password || '')) {
      return { ok: false, reason: 'invalid_password' };
    }
    localStorage.setItem('loggedInUser', email);
    if (typeof window.saveLoggedInUserChanges === 'function') {
      window.saveLoggedInUserChanges(user);
    } else {
      localStorage.setItem('nestedProfile', JSON.stringify(user));
    }
    localStorage.setItem('nestedProfile_lastUpdated', Date.now().toString());
    return { ok: true, user };
  }

  // ---------------------------------------------------------------------------

  // Expose helpers globally
  window.authUtils = {
    normalizeEmail,
    showModalCompat,
    register,
    login,
    getUser
  };
})();
