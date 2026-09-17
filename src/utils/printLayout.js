export const DEFAULT_PRINT_SETTINGS = {
  orientation: 'portrait',
  size: 'medium',
  hex: true,
  rgb: true,
  cmyk: true,
  names: true,
  background: 'white',
};
export function printLayout( settings ) {
  const landscape = settings.orientation === 'landscape';
  const columns = settings.size === 'large' ? ( landscape ? 3 : 2 ) : landscape ? 4 : 3;
  const rows = settings.size === 'large' ? 2 : landscape ? 2 : 3;
  return {
    columns,
    rows,
    capacity: columns * rows,
    width: landscape ? 297 : 210,
    height: landscape ? 210 : 297,
  };
}
export function paginateItems( items, settings ) {
  const { capacity } = printLayout( settings );
  const pages = [];
  for ( let i = 0; i < items.length; i += capacity ) pages.push( items.slice( i, i + capacity ) );
  return pages.length ? pages : [[]];
}
