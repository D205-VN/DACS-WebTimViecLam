const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function getStorage(storageName) {
  try {
    return window[storageName];
  } catch {
    return null;
  }
}

function readFromStorage(storageName, key) {
  try {
    return getStorage(storageName)?.getItem(key) || null;
  } catch {
    return null;
  }
}

function readStorage(key) {
  return readFromStorage('localStorage', key) || readFromStorage('sessionStorage', key);
}

function getActiveSessionStorageName() {
  if (readFromStorage('localStorage', TOKEN_KEY)) return 'localStorage';
  if (readFromStorage('sessionStorage', TOKEN_KEY)) return 'sessionStorage';
  return null;
}

function writeStorage(key, value, remember = true) {
  const primaryStorage = remember ? 'localStorage' : 'sessionStorage';
  const secondaryStorage = remember ? 'sessionStorage' : 'localStorage';

  try {
    getStorage(secondaryStorage)?.removeItem(key);
    getStorage(primaryStorage)?.setItem(key, value);
  } catch {
    // Storage can fail in private mode or when quota is full.
  }
}

function removeStorage(key) {
  for (const storageName of ['localStorage', 'sessionStorage']) {
    try {
      getStorage(storageName)?.removeItem(key);
    } catch {
      // Storage can fail in private mode.
    }
  }
}

function readUser() {
  const activeStorage = getActiveSessionStorageName();
  const savedUser = activeStorage ? readFromStorage(activeStorage, USER_KEY) : null;
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch {
    removeStorage(USER_KEY);
    return null;
  }
}

export const authStorage = {
  getToken: () => readStorage(TOKEN_KEY),
  getUser: readUser,
  setSession(token, user, { remember = true } = {}) {
    writeStorage(TOKEN_KEY, token, remember);
    writeStorage(USER_KEY, JSON.stringify(user), remember);
  },
  setUser(user) {
    if (!user) {
      removeStorage(USER_KEY);
      return;
    }

    writeStorage(USER_KEY, JSON.stringify(user), getActiveSessionStorageName() !== 'sessionStorage');
  },
  clearSession() {
    removeStorage(TOKEN_KEY);
    removeStorage(USER_KEY);
  },
};
