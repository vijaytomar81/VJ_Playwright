
export type GeneratorMode = 'create' | 'update' | 'dry-run';

export type ElementKey = string;
export type ActionKey = string;
export type GroupKey = string;

export type ElementKind =
    | 'input'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'button'
    | 'link'
    | 'combobox'
    | 'date'
    | 'unknown';

export type LocatorStrategy =
    | 'role'
    | 'label'
    | 'placeholder'
    | 'testId'
    | 'id'
    | 'name'
    | 'css'
    | 'xpath';

export interface LocatorCandidate {
    strategy: LocatorStrategy;
    value: string;
    role?: string;
    name?: string;
    exact?: boolean;
    scopeGroupKey?: GroupKey;
}

export interface LocatorDefinition {
    primary: LocatorCandidate;
    fallbacks: LocatorCandidate[];
}

export type GroupSource =
    | 'fieldset-legend'
    | 'accessible-name'
    | 'section-heading'
    | 'labelled-container'
    | 'structural-pattern'
    | 'unknown';

export interface ElementGroup {
    key: GroupKey;
    name: string;
    source: GroupSource;
    parentKey?: GroupKey;
    locator?: LocatorDefinition;
}

export type RepeatableSelection =
    | 'stable-attribute'
    | 'validated-position';

export interface RepeatableGroup {
    key: GroupKey;
    name: string;
    parentKey?: GroupKey;
    locator: LocatorDefinition;
    instanceCount: number;
    maxInstances?: number;
    selection: RepeatableSelection;
    publicIndexBase: 1;
}

export interface ElementLabels {
    direct?: string;
    accessible?: string;
    parentField?: string;
    parentGroup?: string;
    labelFor?: string;
    source?:
    | 'direct'
    | 'accessible'
    | 'parent-field'
    | 'parent-group'
    | 'attribute';
}

export interface ElementFingerprint {
    tagName: string;
    id?: string;
    name?: string;
    inputType?: string;
    role?: string;
    value?: string;
    placeholder?: string;
    text?: string;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    labels: ElementLabels;
    groupPath: GroupKey[];
    attributes?: Record<string, string>;
}

export type ElementVisibility =
    | 'visible'
    | 'hidden'
    | 'not-rendered'
    | 'unknown';

export interface ScannedElement {
    temporaryId: string;
    kind: ElementKind;
    suggestedName: string;
    fingerprint: ElementFingerprint;
    locators: LocatorDefinition;
    visibility: ElementVisibility;
    groupKey?: GroupKey;
    repeatableGroupKey?: GroupKey;
    repeatableInstance?: number;
}

export interface PageScan {
    pageName: string;
    url: string;
    scannedAt: string;
    elements: ScannedElement[];
    groups: ElementGroup[];
    repeatableGroups: RepeatableGroup[];
}

export type ElementStatus =
    | 'active'
    | 'not-found'
    | 'ambiguous';

export interface StoredElement {
    stableKey: ElementKey;
    name: string;
    kind: ElementKind;
    fingerprint: ElementFingerprint;
    locators: LocatorDefinition;
    status: ElementStatus;
    groupKey?: GroupKey;
    repeatableGroupKey?: GroupKey;
    indexed?: boolean;
}

export type ActionOperation =
    | 'fill'
    | 'click'
    | 'check'
    | 'uncheck'
    | 'selectOption'
    | 'press';

export interface StoredAction {
    stableKey: ActionKey;
    elementKey: ElementKey;
    methodName: string;
    operation: ActionOperation;
    indexed?: boolean;
}

export interface PageMetadata {
    schemaVersion: 2;
    pageName: string;
    elements: StoredElement[];
    actions: StoredAction[];
    groups: ElementGroup[];
    repeatableGroups: RepeatableGroup[];
}

export type MatchStatus =
    | 'matched'
    | 'new'
    | 'not-found'
    | 'ambiguous';

export interface ElementMatch {
    status: MatchStatus;
    existingKey?: ElementKey;
    scannedId?: string;
    confidence?: number;
    reason: string;
}

export type ChangeKind =
    | 'element-added'
    | 'element-not-found'
    | 'element-ambiguous'
    | 'primary-locator-changed'
    | 'fallback-locators-changed'
    | 'group-changed'
    | 'action-added'
    | 'action-conflict';

export interface GeneratorChange {
    kind: ChangeKind;
    elementKey?: ElementKey;
    actionKey?: ActionKey;
    description: string;
    safeToApply: boolean;
}

export interface ChangePlan {
    mode: GeneratorMode;
    pageName: string;
    changes: GeneratorChange[];
    hasConflicts: boolean;
}

export interface GeneratorOptions {
    mode: GeneratorMode;
    pageName: string;
    outputDirectory: string;
    cdpEndpoint: string;
    dryRun: boolean;
}

export interface GeneratorResult {
    pageName: string;
    mode: GeneratorMode;
    plan: ChangePlan;
    writtenFiles: string[];
    warnings: string[];
}
