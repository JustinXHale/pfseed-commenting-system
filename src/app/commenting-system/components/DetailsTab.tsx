import * as React from 'react';
import { useLocation } from 'react-router-dom';
import {
  ActionList,
  ActionListItem,
  Button,
  Card,
  CardBody,
  TextArea,
  Title,
} from '@patternfly/react-core';

type DetailsScope = 'page' | 'section';

interface DetailsRecord {
  designGoal: string;
  primaryGoals: string;
  keyFeaturesBeingValidated: string;
  targetedUsers: string;
  scope: DetailsScope;
  // the route this record is anchored to; for section scope it will be the section root (e.g. "/support")
  anchorRoute: string;
  updatedAt: string;
}

type DetailsStore = Record<string, DetailsRecord>;

const STORAGE_KEY = 'hale_commenting_details_v1';

function safeParseStore(raw: string | null): DetailsStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DetailsStore;
  } catch {
    return {};
  }
}

function getStore(): DetailsStore {
  if (typeof window === 'undefined') return {};
  return safeParseStore(window.localStorage.getItem(STORAGE_KEY));
}

function setStore(next: DetailsStore) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const cleaned = pathname.split('?')[0].split('#')[0];
  return cleaned === '' ? '/' : cleaned;
}

function getSectionRoute(pathname: string): string {
  const normalized = normalizePathname(pathname);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  return `/${parts[0]}`;
}

function getPageKey(pathname: string): string {
  return `page:${normalizePathname(pathname)}`;
}

function getSectionKey(sectionRoute: string): string {
  return `section:${normalizePathname(sectionRoute)}/*`;
}

function loadForRoute(pathname: string): { record: DetailsRecord | null; source: 'page' | 'section' | null } {
  const store = getStore();
  const pageKey = getPageKey(pathname);
  if (store[pageKey]) return { record: coerceRecord(store[pageKey]), source: 'page' };

  const sectionRoute = getSectionRoute(pathname);
  const sectionKey = getSectionKey(sectionRoute);
  if (store[sectionKey]) return { record: coerceRecord(store[sectionKey]), source: 'section' };

  return { record: null, source: null };
}

function isStructuredRecord(r: any): r is DetailsRecord {
  return (
    r &&
    typeof r === 'object' &&
    typeof r.designGoal === 'string' &&
    typeof r.primaryGoals === 'string' &&
    typeof r.keyFeaturesBeingValidated === 'string' &&
    typeof r.targetedUsers === 'string' &&
    (r.scope === 'page' || r.scope === 'section') &&
    typeof r.anchorRoute === 'string' &&
    typeof r.updatedAt === 'string'
  );
}

/**
 * Backward compatibility: older drafts may have { title, body }.
 * We keep them by mapping `body` into Design Goal (best-effort) and leaving the rest blank.
 */
function coerceRecord(raw: any): DetailsRecord {
  if (isStructuredRecord(raw)) return raw;

  const legacyBody = typeof raw?.body === 'string' ? raw.body : '';
  const legacyScope: DetailsScope = raw?.scope === 'page' || raw?.scope === 'section' ? raw.scope : 'section';
  const legacyAnchor = typeof raw?.anchorRoute === 'string' ? raw.anchorRoute : '/';
  const legacyUpdatedAt = typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString();

  return {
    designGoal: legacyBody,
    primaryGoals: '',
    keyFeaturesBeingValidated: '',
    targetedUsers: '',
    scope: legacyScope,
    anchorRoute: legacyAnchor,
    updatedAt: legacyUpdatedAt,
  };
}

export const DetailsTab: React.FunctionComponent = () => {
  const location = useLocation();
  const route = normalizePathname(location.pathname);
  const sectionRoute = getSectionRoute(route);

  const [{ record, source }, setResolved] = React.useState(() => loadForRoute(route));
  const [isEditing, setIsEditing] = React.useState(false);

  // editable draft state
  const [draftScope, setDraftScope] = React.useState<DetailsScope>('section');
  const [draftDesignGoal, setDraftDesignGoal] = React.useState('');
  const [draftPrimaryGoals, setDraftPrimaryGoals] = React.useState('');
  const [draftKeyFeaturesBeingValidated, setDraftKeyFeaturesBeingValidated] = React.useState('');
  const [draftTargetedUsers, setDraftTargetedUsers] = React.useState('');

  React.useEffect(() => {
    // when navigating, refresh resolved record and exit edit mode
    setResolved(loadForRoute(route));
    setIsEditing(false);
  }, [route]);

  const startNew = () => {
    setDraftScope('section');
    setDraftDesignGoal('');
    setDraftPrimaryGoals('');
    setDraftKeyFeaturesBeingValidated('');
    setDraftTargetedUsers('');
    setIsEditing(true);
  };

  const startEdit = (mode: 'edit-existing' | 'override-page') => {
    if (mode === 'override-page') {
      // copy inherited section record into a page-scoped override draft
      setDraftScope('page');
      setDraftDesignGoal(record?.designGoal ?? '');
      setDraftPrimaryGoals(record?.primaryGoals ?? '');
      setDraftKeyFeaturesBeingValidated(record?.keyFeaturesBeingValidated ?? '');
      setDraftTargetedUsers(record?.targetedUsers ?? '');
      setIsEditing(true);
      return;
    }

    // edit existing record as-is
    const existingScope: DetailsScope = record?.scope ?? 'section';
    setDraftScope(existingScope);
    setDraftDesignGoal(record?.designGoal ?? '');
    setDraftPrimaryGoals(record?.primaryGoals ?? '');
    setDraftKeyFeaturesBeingValidated(record?.keyFeaturesBeingValidated ?? '');
    setDraftTargetedUsers(record?.targetedUsers ?? '');
    setIsEditing(true);
  };

  const save = () => {
    const next: DetailsRecord = {
      designGoal: draftDesignGoal,
      primaryGoals: draftPrimaryGoals,
      keyFeaturesBeingValidated: draftKeyFeaturesBeingValidated,
      targetedUsers: draftTargetedUsers,
      scope: draftScope,
      anchorRoute: draftScope === 'section' ? sectionRoute : route,
      updatedAt: new Date().toISOString(),
    };

    const store = getStore();
    const key = draftScope === 'section' ? getSectionKey(sectionRoute) : getPageKey(route);
    const nextStore = { ...store, [key]: next };
    setStore(nextStore);

    setResolved(loadForRoute(route));
    setIsEditing(false);
  };

  const remove = () => {
    const store = getStore();
    const keyToRemove =
      source === 'page' ? getPageKey(route) : source === 'section' ? getSectionKey(sectionRoute) : null;
    if (!keyToRemove) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [keyToRemove]: _removed, ...rest } = store;
    setStore(rest);
    setResolved(loadForRoute(route));
    setIsEditing(false);
  };

  const scopeLabel =
    source === 'page'
      ? 'This page'
      : source === 'section'
        ? `Section (${sectionRoute}/*)`
        : null;

  if (!record && !isEditing) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <Title headingLevel="h3" size="lg">
              Details
            </Title>
            <div style={{ fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
              No details set for <b>{route}</b>.
            </div>
          </div>
          <Button variant="primary" onClick={startNew}>
            Add details
          </Button>
        </div>

        <Card>
          <CardBody>
            <div style={{ fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
              Add designer notes, design goals, links, and context for reviewers.
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isEditing) {
    const effectiveAnchor = draftScope === 'section' ? `${sectionRoute}/*` : route;

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div>
            <Title headingLevel="h3" size="lg">
              Edit details
            </Title>
            <div style={{ fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
              Applies to: <b>{effectiveAnchor}</b>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant={draftScope === 'page' ? 'primary' : 'secondary'}
              onClick={() => setDraftScope('page')}
            >
              This page only
            </Button>
            <Button
              variant={draftScope === 'section' ? 'primary' : 'secondary'}
              onClick={() => setDraftScope('section')}
              isDisabled={sectionRoute === '/' && route === '/'}
            >
              This section ({sectionRoute}/*)
            </Button>
          </div>
        </div>

        <Card>
          <CardBody>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <b>Design Goal</b>
                </div>
                <TextArea
                  aria-label="Design goal"
                  value={draftDesignGoal}
                  onChange={(_e, v) => setDraftDesignGoal(v)}
                  rows={3}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <b>Primary Goal(s)</b>
                </div>
                <TextArea
                  aria-label="Primary goals"
                  value={draftPrimaryGoals}
                  onChange={(_e, v) => setDraftPrimaryGoals(v)}
                  rows={4}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <b>Key Feature(s) Being Validated</b>
                </div>
                <TextArea
                  aria-label="Key features being validated"
                  value={draftKeyFeaturesBeingValidated}
                  onChange={(_e, v) => setDraftKeyFeaturesBeingValidated(v)}
                  rows={4}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <b>Targeted User(s)</b>
                </div>
                <TextArea
                  aria-label="Targeted users"
                  value={draftTargetedUsers}
                  onChange={(_e, v) => setDraftTargetedUsers(v)}
                  rows={4}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button variant="primary" onClick={save}>
                  Save
                </Button>
                <Button variant="link" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!record) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <Title headingLevel="h3" size="lg">
            Details
          </Title>
          {scopeLabel && (
            <div style={{ fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
              Source: <b>{scopeLabel}</b>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {source === 'section' && (
            <Button variant="secondary" onClick={() => startEdit('override-page')}>
              Override for this page
            </Button>
          )}
          <Button variant="secondary" onClick={() => startEdit('edit-existing')}>
            Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <Title headingLevel="h4" size="md">
            Design Goal
          </Title>
          <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{record.designGoal || '—'}</div>

          <Title headingLevel="h4" size="md" style={{ marginTop: '1rem' }}>
            Primary Goal(s)
          </Title>
          <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{record.primaryGoals || '—'}</div>

          <Title headingLevel="h4" size="md" style={{ marginTop: '1rem' }}>
            Key Feature(s) Being Validated
          </Title>
          <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{record.keyFeaturesBeingValidated || '—'}</div>

          <Title headingLevel="h4" size="md" style={{ marginTop: '1rem' }}>
            Targeted User(s)
          </Title>
          <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{record.targetedUsers || '—'}</div>

          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
            Updated: {new Date(record.updatedAt).toLocaleString()}
          </div>

          <ActionList style={{ marginTop: '0.75rem' }}>
            <ActionListItem>
              <Button variant="link" isDanger onClick={remove}>
                Remove
              </Button>
            </ActionListItem>
          </ActionList>
        </CardBody>
      </Card>
    </div>
  );
};


