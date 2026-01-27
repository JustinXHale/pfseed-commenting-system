import * as React from 'react';
import '@patternfly/react-core/dist/styles/base.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';
import { CommentProvider, ProviderAuthProvider } from '@app/commenting-system';
import '@app/app.css';

const App: React.FunctionComponent = () => (
  <Router>
    <ProviderAuthProvider>
      <CommentProvider>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </CommentProvider>
    </ProviderAuthProvider>
  </Router>
);

export default App;
