// Settings kept on this phone.
const SIMILAR = 'pwa-group-similar';

export const similarOn = () => {
  try {
    return localStorage.getItem(SIMILAR) !== '0';
  } catch {
    return true;
  }
};
export const setSimilar = (on: boolean) => {
  try {
    localStorage.setItem(SIMILAR, on ? '1' : '0');
  } catch {
    /* then it stays on */
  }
};
