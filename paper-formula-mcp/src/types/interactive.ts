// 인터랙티브 메뉴 위자드 타입 정의

export type MenuWizardStep =
  | 'select_function'
  | 'collect_params'
  | 'confirm'
  | 'executing'
  | 'complete';

export interface ParamDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  description: string;
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
  arrayItemType?: string;
}

export interface ToolCategory {
  id: string;
  label: string;
  emoji: string;
  tools: ToolInfo[];
}

export interface ToolInfo {
  name: string;
  label: string;
  description: string;
  emoji: string;
  params: ParamDefinition[];
}

export interface MenuWizardSession {
  id: string;
  currentStep: MenuWizardStep;
  selectedFunction: string | null;
  toolInfo: ToolInfo | null;
  collectedParams: Record<string, any>;
  currentParamIndex: number;
  pendingParams: ParamDefinition[];
  createdAt: number;
}

export interface MenuWizardStepResult {
  sessionId: string;
  currentStep: MenuWizardStep;
  message: string;
  options?: MenuWizardOption[];
  isComplete: boolean;
  result?: string;
}

export interface MenuWizardOption {
  value: string;
  label: string;
  description?: string;
  emoji?: string;
}
