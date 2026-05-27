import AppProviders from '@components/providers/AppProviders';
import AppRouter from '@services/router';

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;
