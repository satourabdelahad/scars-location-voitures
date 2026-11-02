/** Logos simplifiés des réseaux sociaux (formes publiques des marques, utilisées uniquement pour les boutons de connexion). */
export function GoogleIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
export function FacebookIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
    </svg>
  );
}
export function XIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
      <path fill="currentColor" d="M18.2 2h3.4l-7.4 8.5L23 22h-6.8l-5.3-7-6.1 7H1.4l7.9-9L1 2h7l4.8 6.4L18.2 2zm-1.2 18h1.9L7.1 3.9H5.1L17 20z" />
    </svg>
  );
}
export function TikTokIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
      <path fill="#25F4EE" d="M9.4 9.5v-.9a6.9 6.9 0 0 0-1-.1 7.3 7.3 0 0 0-4.1 13.3 7.3 7.3 0 0 1 5.1-12.3z" />
      <path fill="#25F4EE" d="M9.6 19.8a3.3 3.3 0 0 0 3.3-3.2V1.1h2.9a5.5 5.5 0 0 1-.1-1.1h-3.9v15.5a3.3 3.3 0 0 1-4.9 2.9 3.3 3.3 0 0 0 2.7 1.4zM21.2 6.4V5.5A5.5 5.5 0 0 1 18.2 4.6a5.5 5.5 0 0 0 3 1.8z" />
      <path fill="#FE2C55" d="M18.2 4.6A5.5 5.5 0 0 1 16.8 1h-1.1a5.5 5.5 0 0 0 2.5 3.6zM8.4 12.2a3.3 3.3 0 0 0-1.5 6.3 3.3 3.3 0 0 1 2.5-5.4 3.3 3.3 0 0 1 1 .1v-4a7 7 0 0 0-1-.1h-.2v3a3.3 3.3 0 0 0-.8.1z" />
      <path fill="currentColor" d="M21.2 6.4v3a9.4 9.4 0 0 1-5.5-1.8v8a7.3 7.3 0 0 1-11.4 6 7.3 7.3 0 0 0 12.5-5.1V8.5a9.4 9.4 0 0 0 5.5 1.8V6.4h-1.1zM15.7 15.6V7.7a9.4 9.4 0 0 0 5.5 1.8V6.4a5.5 5.5 0 0 1-3-1.8 5.5 5.5 0 0 1-2.5-3.6h-2.9v15.6a3.3 3.3 0 0 1-6 1.9 3.3 3.3 0 0 1 2.6-6v-3a7.3 7.3 0 0 0-5.1 12.4 7.3 7.3 0 0 0 11.4-6.3z" />
    </svg>
  );
}
export function InstagramIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
      <defs>
        <radialGradient id="ig-g" cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset=".05" stopColor="#fdf497" />
          <stop offset=".45" stopColor="#fd5949" />
          <stop offset=".6" stopColor="#d6249f" />
          <stop offset=".9" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-g)" />
      <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.6" cy="7.4" r="1.1" fill="#fff" />
    </svg>
  );
}
