// Thin wrappers over the browser Notification API so the rest of the app stays
// testable. Notifications only fire while a tab is open (no service worker).

export function requestNotifyPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

export function notify(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag: title }) // same tag replaces, never stacks
  } catch {
    /* some browsers throw if constructed outside a user gesture; ignore */
  }
}
