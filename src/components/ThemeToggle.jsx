import { useTranslation } from 'react-i18next';
import { THEMES } from '@/constants/themes.js';
import { useTheme } from '@/hooks/useTheme.js';
import Icon from '@/components/Icon.jsx';
import '@/styles/components/ThemeToggle.css';

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, change, error, disabled } = useTheme();
  return (
    <div className="theme-control">
      <div className="theme-toggle" role="group" aria-label={ t( 'theme.label' ) }>
        { Object.values( THEMES ).map( ( value ) => (
          <button
            key={ value }
            type="button"
            className="icon-button"
            aria-label={ t( 'theme.' + value ) }
            title={ t( 'theme.' + value ) }
            aria-pressed={ theme === value }
            disabled={ disabled }
            onClick={ () => change( value ) }
          >
            <Icon name={ value === THEMES.LIGHT ? 'sun' : 'moon' } />
          </button>
        ) ) }
      </div>
      { error && (
        <p className="error" role="alert">
          { t( 'theme.failed' ) }
        </p>
      ) }
    </div>
  );
}
