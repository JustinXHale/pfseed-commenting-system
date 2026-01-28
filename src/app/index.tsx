import * as React from 'react';
import '@patternfly/react-core/dist/styles/base.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';
import { CommentProvider, ProviderAuthProvider, GitHubAuthProvider } from '@app/commenting-system';
import '@app/app.css';
const App: React.FunctionComponent = () => <Router><ProviderAuthProvider>
      <AppLayout>
          <AppRoutes />
        </AppLayout>
      
    </ProviderAuthProvider>
  </Router>;
export default App;