import { FluentProvider, webLightTheme, makeStyles, tokens, Text, Button } from '@fluentui/react-components';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  HomeRegular,
  ArrowUploadRegular,
  DocumentSearchRegular,
  CheckmarkCircleRegular,
  ListRegular,
  PlugConnectedRegular,
  DataBarVerticalRegular,
} from '@fluentui/react-icons';

import { PainelAPPage } from './containers/PainelAPPage';
import { IntakeDocumentosPage } from './containers/IntakeDocumentosPage';
import { DashboardGerencialPage } from './containers/DashboardGerencialPage';
import { IntegracaoERPPage } from './containers/IntegracaoERPPage';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#f5f5f5',
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    flexDirection: 'column',
    padding: tokens.spacingVerticalM,
    gap: tokens.spacingVerticalXS,
    flexShrink: 0,
  },
  logo: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    marginBottom: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    transition: 'background-color 0.15s',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  navLinkActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#fafafa',
  },
});

const navItems = [
  { to: '/painel', label: 'Painel AP', icon: <HomeRegular /> },
  { to: '/intake', label: 'Intake', icon: <ArrowUploadRegular /> },
  { to: '/erp', label: 'Integração ERP', icon: <PlugConnectedRegular /> },
  { to: '/dashboard', label: 'Dashboard', icon: <DataBarVerticalRegular /> },
];

function AppLayout() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <Text size={500} weight="bold">AP Automation</Text>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/painel" replace />} />
          <Route path="/painel" element={<PainelAPPage />} />
          <Route path="/intake" element={<IntakeDocumentosPage />} />
          <Route path="/erp" element={<IntegracaoERPPage />} />
          <Route path="/dashboard" element={<DashboardGerencialPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </FluentProvider>
  );
}
