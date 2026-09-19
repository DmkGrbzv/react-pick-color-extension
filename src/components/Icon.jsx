import '@/styles/components/Icon.css';

const paths = {
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
  eyedropper: 'm14 5 5 5m-6-4-8 8v3l-2 3 1 1 3-2h3l8-8m-5-5 3-3a2.1 2.1 0 0 1 3 3l-3 3M12 5l7 7',
  external: 'M14 3h7v7m0-7L11 13M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  print: 'M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6Zm11-2h1',
  copy: 'M9 9h12v12H9ZM15 9V3H3v12h6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  bulb: 'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 2H9Z',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  edit: 'm15 4 5 5M4 20l1-5L17 3a2.1 2.1 0 0 1 3 3L8 18Z',
};

export default function Icon( { name } ) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ paths[name] } />
    </svg>
  );
}
