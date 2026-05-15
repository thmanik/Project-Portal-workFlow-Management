import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ActorRole =
  | "system_admin"
  | "prime_consultant"
  | "ccr_coordinator"
  | "division_lead"
  | "division_member"
  | "tms_manager"
  | "tms_drawing"
  | "tms_checking"
  | "tms_approval"
  | "client_owner";

export interface Company {
  id: string;
  name: string;
  abbr: string;
  type: string;
}

export interface Division {
  id: string;
  companyId: string;
  name: string;
  abbr: string;
  type: string;
}

export interface Team {
  id: string;
  name: string;
  companyId: string;
  divisionId: string;
  leadMemberId?: string;
  memberIds: string[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  companyId: string;
  divisionId: string;
  teamId?: string;
  roleTitle: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  companyId: string;
}

export interface Actor {
  id: string;
  label: string;
  role: ActorRole;
  memberId?: string;
  clientId?: string;
}

export type AttachmentSourceType = "TEXT" | "FILE" | "TEXT_AND_FILE" | "METADATA";
export type AttachmentFileGroup = "PRIMARY" | "WORKFLOW";

export interface AttachmentInput {
  name: string;
  category: string;
  textContent?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileDataUrl?: string;
  workflowStage?: string;
  note?: string;
}

export interface AttachmentRef {
  id: string;
  name: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  sourceType?: AttachmentSourceType;
  fileGroup?: AttachmentFileGroup;
  textContent?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileDataUrl?: string;
  workflowStage?: string;
  note?: string;
  version?: number;
  versionKey?: string;
  workRequestId?: string;
}

export interface ProjectItem {
  id: string;
  code: string;
  name: string;
  type: "BID" | "PROJECT";
  clientId: string;
  clientEmail: string;
  originDivisionId: string;
  sourceChannel: string;
  status: "DRAFT" | "BIDDING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  progressOverride?: number;
  initialDocuments: AttachmentRef[];
  credentialsSent: boolean;
  createdAt: string;
}

export type WorkRequestStatus =
  | "CREATED"
  | "DIVISION_NOTIFIED"
  | "INFO_REQUESTED_FROM_MARKETING"
  | "INFO_REQUESTED_FROM_CLIENT"
  | "CLIENT_INFO_PROVIDED"
  | "MARKETING_INFO_PROVIDED"
  | "LEADER_ASSIGNED"
  | "MEMBER_REVIEW"
  | "MEMBER_INFO_REQUESTED"
  | "PM_LEAD_RESPONDED"
  | "PM_MEMBER_SUBMITTED"
  | "PM_REWORK_REQUESTED"
  | "FORWARDED_TO_TMS"
  | "ENGINEERING_REVISION_REQUESTED"
  | "TMS_MEMBER_INFO_REQUESTED"
  | "TMS_ASSIGNED"
  | "DRAWING_IN_PROGRESS"
  | "CHECKING_REVIEW"
  | "APPROVAL_REVIEW"
  | "ENGINEERING_LEAD_REVIEW"
  | "FINAL_SUBMITTED_TO_MARKETING"
  | "FINAL_SUBMITTED_TO_CLIENT"
  | "CLIENT_REVISION_REQUESTED"
  | "RETURNED_TO_DIVISION"
  | "DIVISION_MEMBER_APPROVED"
  | "DIVISION_MANAGER_APPROVED"
  | "FORWARDED_TO_CCR"
  | "HML_LISTED"
  | "REJECTED";

export interface HistoryEntry {
  id: string;
  at: string;
  by: string;
  action: string;
  from?: string;
  to?: string;
  note?: string;
}

export interface PendingInfoRequest {
  id: string;
  requestedBy: string;
  requestedByActorId: string;
  requestedByMemberId?: string;
  requestedByRole: ActorRole;
  targetLabel: string;
  targetRole?: ActorRole;
  targetMemberId?: string;
  targetClientId?: string;
  statusAtRequest: WorkRequestStatus;
  note?: string;
  requestedAt: string;
}

export interface WorkRequest {
  id: string;
  code: string;
  parentType: "BID" | "PROJECT";
  parentId: string;
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  attachmentCategory: string;
  notes: string;
  assignedDivisionId: string;
  originDivisionId: string;
  currentStatus: WorkRequestStatus;
  assignedLeaderId?: string;
  assignedMemberId?: string;
  tmsAssignments?: {
    managerId?: string;
    drawingId?: string;
    checkingId?: string;
    approvalId?: string;
  };
  drawingDocumentName?: string;
  lastTmsWorkStatus?: WorkRequestStatus;
  lastTmsRequesterId?: string;
  finalPackageAttachmentIds?: string[];
  clientRevisionAttachmentIds?: string[];
  pendingInfoRequest?: PendingInfoRequest;
  infoRequestStack?: PendingInfoRequest[];
  lastTransferredAt: string;
  revisionHistory: HistoryEntry[];
}

export interface RegistryDocument {
  id: string;
  projectId: string;
  workRequestId: string;
  name: string;
  category: string;
  divisionId: string;
  listedAt: string;
  listedBy: string;
}

export interface PortalSettings {
  portalName: string;
  categories: string[];
  workRequestTypes?: string[];
  projectInfoCategories?: string[];
}
export interface PortalState {
  companies: Company[];
  divisions: Division[];
  teams: Team[];
  members: Member[];
  clients: Client[];
  actors: Actor[];
  currentActorId: string;
  projects: ProjectItem[];
  workRequests: WorkRequest[];
  documents: RegistryDocument[];
  settings: PortalSettings;
}

interface PortalContextValue {
  state: PortalState;
  currentActor: Actor;
  setCurrentActorId: (id: string) => void;
  addCompany: (payload: { name: string; abbr: string; type: string }) => void;
  addDivision: (payload: { companyId: string; name: string; abbr: string; type: string }) => void;
  addTeam: (payload: { name: string; companyId: string; divisionId: string; leadMemberId?: string }) => void;
  addMember: (payload: { name: string; email: string; companyId: string; divisionId: string; teamId?: string; roleTitle: string }) => void;
  addProject: (payload: { name: string; type: "BID" | "PROJECT"; clientId: string; sourceChannel: string; initialDocuments: AttachmentInput[] }) => ProjectItem;
  addClientDocument: (projectId: string, payload: AttachmentInput) => void;
  addWorkRequestDocument: (workRequestId: string, payload: AttachmentInput) => void;
  addWorkRequestNote: (workRequestId: string, note: string, action?: string) => void;
  requestWorkflowInfo: (workRequestId: string, payload: {
    targetLabel: string;
    targetRole?: ActorRole;
    targetMemberId?: string;
    targetClientId?: string;
    note?: string;
  }) => void;
  respondWorkflowInfo: (workRequestId: string, note?: string) => void;
  addWorkRequest: (payload: {
    parentType: "BID" | "PROJECT";
    parentId: string;
    title: string;
    category: string;
    priority: "High" | "Medium" | "Low";
    attachmentCategory: string;
    notes: string;
    assignedDivisionId: string;
  }) => void;
  requestInfoFromMarketing: (workRequestId: string, note?: string) => void;
  marketingReturnToPm: (workRequestId: string, note?: string) => void;
  marketingEscalateToClient: (workRequestId: string, note?: string) => void;
  clientProvideInfo: (workRequestId: string, note?: string) => void;
  memberRequestInfo: (workRequestId: string, note?: string) => void;
  pmLeadRespondToMember: (workRequestId: string, note?: string) => void;
  pmMemberSubmit: (workRequestId: string, note?: string) => void;
  pmReturnToMember: (workRequestId: string, note?: string) => void;
  assignLeader: (workRequestId: string, leaderId: string) => void;
  assignMember: (workRequestId: string, memberId: string) => void;
  forwardToTms: (workRequestId: string, note?: string) => void;
  engineeringRequestPmRevision: (workRequestId: string, note?: string) => void;
  tmsMemberRequestLead: (workRequestId: string, note?: string) => void;
  tmsLeadRespondToMember: (workRequestId: string, note?: string) => void;
  engineeringSubmitToMarketing: (workRequestId: string, note?: string, packageKeys?: string[]) => void;
  marketingSubmitToClient: (workRequestId: string, note?: string, attachmentIds?: string[], attachmentKeys?: string[]) => void;
  marketingRequestEngineeringRevision: (workRequestId: string, note?: string) => void;
  marketingRouteClientRevisionToTms: (workRequestId: string, note?: string) => void;
  marketingSubmitClientRevision: (workRequestId: string, note?: string, attachmentIds?: string[], attachmentKeys?: string[]) => void;
  engineeringRequestTmsRevision: (workRequestId: string, note?: string) => void;
  clientAcceptFinal: (workRequestId: string, note?: string) => void;
  clientRejectFinal: (workRequestId: string, note?: string) => void;
  clientRequestRevision: (workRequestId: string, note?: string, revisionKeys?: string[]) => void;
  marketingSendClientRevisionToPm: (workRequestId: string, note?: string) => void;
  assignTmsChain: (workRequestId: string, payload: { drawingId: string; checkingId: string; approvalId: string }, note?: string) => void;
  submitDrawing: (workRequestId: string, documentName: string, note?: string) => void;
  reviewChecking: (workRequestId: string, approved: boolean, note?: string) => void;
  reviewApproval: (workRequestId: string, approved: boolean, note?: string) => void;
  originMemberDecision: (workRequestId: string, approved: boolean, note?: string) => void;
  originManagerApprove: (workRequestId: string, note?: string) => void;
  forwardToCcr: (workRequestId: string, note?: string) => void;
  sendBackward: (workRequestId: string, note?: string) => void;
  listFinalDocument: (workRequestId: string, payload: { name: string; category: string }) => void;
  decideBidOutcome: (projectId: string, outcome: "WIN" | "LOSE") => void;
  requestArchivedBidReview: (projectId: string, note?: string) => void;
  updateSettings: (payload: Partial<PortalSettings>) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

const now = () => new Date().toISOString();
const fmt = (value: string) => new Date(value).toLocaleString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSeedAttachment(
  payload: Omit<AttachmentRef, "id" | "uploadedAt" | "version"> & {
    uploadedAt?: string;
    version?: number;
  }
): AttachmentRef {
  return {
    id: uid("att"),
    uploadedAt: payload.uploadedAt || now(),
    version: payload.version || 1,
    ...payload,
  };
}

function createSeedHistory(action: string, by: string, to?: string, note?: string): HistoryEntry {
  return {
    id: uid("hist"),
    at: now(),
    by,
    action,
    to,
    note,
  };
}

function resolveAttachmentSourceType(payload: AttachmentInput): AttachmentSourceType {
  const hasText = Boolean(payload.textContent?.trim());
  const hasFile = Boolean(payload.fileDataUrl || payload.fileName);

  if (hasText && hasFile) return "TEXT_AND_FILE";
  if (hasText) return "TEXT";
  if (hasFile) return "FILE";
  return "METADATA";
}

function getFileBaseName(value?: string) {
  return (value || "").split(/[\\/]/).pop() || "";
}

function normalizeAttachmentKey(value?: string) {
  return getFileBaseName(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getAutoAttachmentName(payload: AttachmentInput) {
  if (payload.fileName?.trim()) return payload.fileName.trim();
  if (payload.name?.trim()) return payload.name.trim();

  if (payload.textContent?.trim()) {
    return `Text Document - ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
  }

  return "Untitled document";
}

function getAttachmentVersionKeyFromInput(payload: AttachmentInput) {
  return normalizeAttachmentKey(payload.fileName || payload.name || getAutoAttachmentName(payload));
}

function getAttachmentVersionKeysFromRef(attachment: AttachmentRef) {
  return [attachment.versionKey, attachment.fileName, attachment.name]
    .map((value) => normalizeAttachmentKey(value))
    .filter(Boolean);
}

function getNextAttachmentVersion(existingAttachments: AttachmentRef[], payload: AttachmentInput) {
  const key = getAttachmentVersionKeyFromInput({
    ...payload,
    name: getAutoAttachmentName(payload),
  });

  if (!key) return 1;

  const matchingVersions = existingAttachments
    .filter((attachment) => getAttachmentVersionKeysFromRef(attachment).includes(key))
    .map((attachment) => attachment.version || 1);

  if (!matchingVersions.length) return 1;
  return Math.max(...matchingVersions) + 1;
}

function createAttachment(
  payload: AttachmentInput,
  uploadedBy: string,
  existingAttachments: AttachmentRef[] = [],
  fileGroup: AttachmentFileGroup = "WORKFLOW"
): AttachmentRef {
  const autoName = getAutoAttachmentName(payload);
  const versionKey = getAttachmentVersionKeyFromInput({ ...payload, name: autoName });
  const nextVersion = getNextAttachmentVersion(existingAttachments, { ...payload, name: autoName });

  return {
    id: uid("att"),
    name: autoName,
    category: payload.category,
    uploadedBy,
    uploadedAt: now(),
    sourceType: resolveAttachmentSourceType(payload),
    fileGroup,
    textContent: payload.textContent?.trim() || undefined,
    fileName: payload.fileName?.trim() || undefined,
    fileType: payload.fileType || undefined,
    fileSize: payload.fileSize || undefined,
    fileDataUrl: payload.fileDataUrl || undefined,
    workflowStage: payload.workflowStage || (fileGroup === "PRIMARY" ? "Project / Bid Intake" : "Workflow Collaboration"),
    note: payload.note?.trim() || undefined,
    version: nextVersion,
    versionKey,
  };
}

function getAttachmentStableKey(attachment: AttachmentRef) {
  return normalizeAttachmentKey(attachment.versionKey || attachment.fileName || attachment.name);
}

function getLatestAttachmentIdsByKeys(project: ProjectItem | undefined, keys: string[] = [], stageHints: string[] = [], workRequestId?: string) {
  if (!project || !keys.length) return [];

  const normalizedKeys = keys.map((key) => normalizeAttachmentKey(key)).filter(Boolean);
  if (!normalizedKeys.length) return [];

  const matches = project.initialDocuments
    .filter((attachment) => attachment.fileGroup === "WORKFLOW")
    .filter((attachment) => !workRequestId || attachment.workRequestId === workRequestId)
    .filter((attachment) => normalizedKeys.includes(getAttachmentStableKey(attachment)))
    .filter((attachment) => !stageHints.length || stageHints.includes(attachment.workflowStage || ""))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const seen = new Set<string>();
  const ids: string[] = [];

  matches.forEach((attachment) => {
    const key = getAttachmentStableKey(attachment);
    if (!key || seen.has(key)) return;
    seen.add(key);
    ids.push(attachment.id);
  });

  return ids;
}

function getLatestWorkflowAttachmentIdsByStages(project: ProjectItem | undefined, stages: string[] = [], workRequestId?: string) {
  if (!project) return [];

  const matches = project.initialDocuments
    .filter((attachment) => attachment.fileGroup === "WORKFLOW")
    .filter((attachment) => !workRequestId || attachment.workRequestId === workRequestId)
    .filter((attachment) => !stages.length || stages.includes(attachment.workflowStage || ""))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const seen = new Set<string>();
  const ids: string[] = [];

  matches.forEach((attachment) => {
    const key = getAttachmentStableKey(attachment) || attachment.id;
    if (seen.has(key)) return;
    seen.add(key);
    ids.push(attachment.id);
  });

  return ids;
}

function createSeedState(): PortalState {
  const companies: Company[] = [
    { id: "company-deme", name: "DEME", abbr: "DEME", type: "End Client / Cargo Owner" },
    { id: "company-hml", name: "HML", abbr: "HML", type: "Portal Owner" },
    { id: "company-tms", name: "TMS", abbr: "TMS", type: "Technical Management Service" },
  ];

  const divisions: Division[] = [
    { id: "div-ccr", companyId: "company-hml", name: "CCR Division", abbr: "CCR", type: "Marketing Division of HML" },
    { id: "div-ecm", companyId: "company-hml", name: "ECM Division", abbr: "ECM", type: "Engineering Division of HML" },
    { id: "div-pmo", companyId: "company-hml", name: "PMO Division", abbr: "PMO", type: "Operation Division of HML" },
    { id: "div-tms-eng", companyId: "company-tms", name: "TMS-Eng", abbr: "TMS", type: "Drawing / Checking / Approval" },
    { id: "div-tms-it", companyId: "company-tms", name: "TMS-IT", abbr: "TMS-IT", type: "System / IT Support" },
  ];

  const members: Member[] = [
    { id: "member-prime", name: "Prime Consultant", email: "prime@hml.com", companyId: "company-hml", divisionId: "div-ccr", roleTitle: "Prime Consultant", active: true },
    { id: "member-ccr-1", name: "Ahmad Rahman", email: "ccr@hml.com", companyId: "company-hml", divisionId: "div-ccr", roleTitle: "CCR Coordinator", active: true },
    { id: "member-ecm-lead", name: "Dr. Yusof Ismail", email: "ecmlead@hml.com", companyId: "company-hml", divisionId: "div-ecm", roleTitle: "ECM Team Leader", active: true },
    { id: "member-ecm-1", name: "Lisa Wang", email: "ecm1@hml.com", companyId: "company-hml", divisionId: "div-ecm", roleTitle: "ECM Member", active: true },
    { id: "member-pmo-lead", name: "PMO Lead", email: "pmolead@hml.com", companyId: "company-hml", divisionId: "div-pmo", roleTitle: "PMO Team Leader", active: true },
    { id: "member-pmo-1", name: "PMO-M1", email: "pmo1@hml.com", companyId: "company-hml", divisionId: "div-pmo", roleTitle: "PMO Member", active: true },
    { id: "member-tms-manager", name: "Tan Wei Ming", email: "manager@tms.com", companyId: "company-tms", divisionId: "div-tms-eng", roleTitle: "TMS Manager", active: true },
    { id: "member-tms-m1", name: "Aisha Binti", email: "drawing@tms.com", companyId: "company-tms", divisionId: "div-tms-eng", roleTitle: "TMS-M1 Drawing Member", active: true },
    { id: "member-tms-m2", name: "Mark Johnson", email: "checking@tms.com", companyId: "company-tms", divisionId: "div-tms-eng", roleTitle: "TMS-M2 Checking Member", active: true },
    { id: "member-tms-m3", name: "Priya Nair", email: "approval@tms.com", companyId: "company-tms", divisionId: "div-tms-eng", roleTitle: "TMS-M3 Approval Member", active: true },
  ];

  const teams: Team[] = [
    { id: "team-ccr", name: "CCR Team", companyId: "company-hml", divisionId: "div-ccr", leadMemberId: "member-ccr-1", memberIds: ["member-prime", "member-ccr-1"] },
    { id: "team-ecm", name: "ECM Team", companyId: "company-hml", divisionId: "div-ecm", leadMemberId: "member-ecm-lead", memberIds: ["member-ecm-lead", "member-ecm-1"] },
    { id: "team-pmo", name: "PMO Team", companyId: "company-hml", divisionId: "div-pmo", leadMemberId: "member-pmo-lead", memberIds: ["member-pmo-lead", "member-pmo-1"] },
    { id: "team-tms", name: "TMS Engineering Team", companyId: "company-tms", divisionId: "div-tms-eng", leadMemberId: "member-tms-manager", memberIds: ["member-tms-manager", "member-tms-m1", "member-tms-m2", "member-tms-m3"] },
  ];

  const clients: Client[] = [{ id: "client-deme", name: "DEME", email: "projects@deme.com", companyId: "company-deme" }];

  const actors: Actor[] = [
    { id: "actor-admin", label: "System Admin", role: "system_admin" },
    { id: "actor-prime", label: "Prime Consultant", role: "prime_consultant", memberId: "member-prime" },
    { id: "actor-ccr", label: "CCR Coordinator", role: "ccr_coordinator", memberId: "member-ccr-1" },
    { id: "actor-ecm-lead", label: "ECM Lead", role: "division_lead", memberId: "member-ecm-lead" },
    { id: "actor-ecm-m1", label: "ECM-M1", role: "division_member", memberId: "member-ecm-1" },
    { id: "actor-pmo-lead", label: "PMO Lead", role: "division_lead", memberId: "member-pmo-lead" },
    { id: "actor-pmo-m1", label: "PMO-M1", role: "division_member", memberId: "member-pmo-1" },
    { id: "actor-tms-manager", label: "TMS Manager", role: "tms_manager", memberId: "member-tms-manager" },
    { id: "actor-tms-drawing", label: "TMS-M1", role: "tms_drawing", memberId: "member-tms-m1" },
    { id: "actor-tms-checking", label: "TMS-M2", role: "tms_checking", memberId: "member-tms-m2" },
    { id: "actor-tms-approval", label: "TMS-M3", role: "tms_approval", memberId: "member-tms-m3" },
    { id: "actor-client", label: "Client / Owner (DEME)", role: "client_owner", clientId: "client-deme" },
  ];

  const primaryDoc = createSeedAttachment({
    name: "DEME Initial Request.pdf",
    category: "Client Request",
    uploadedBy: "Ahmad Rahman",
    sourceType: "METADATA",
    fileGroup: "PRIMARY",
    fileName: "DEME Initial Request.pdf",
    fileType: "application/pdf",
    workflowStage: "Project / Bid Intake",
    note: "Original client request uploaded by CCR / Marketing.",
  });

  const project: ProjectItem = {
    id: "project-bid-26001",
    code: "BID-26001",
    name: "DEME Offshore Cargo Coordination",
    type: "BID",
    clientId: "client-deme",
    clientEmail: "projects@deme.com",
    originDivisionId: "div-ccr",
    sourceChannel: "Email Intake",
    status: "BIDDING",
    initialDocuments: [primaryDoc],
    credentialsSent: true,
    createdAt: now(),
  };

  const workRequests: WorkRequest[] = [
    {
      id: "wr-26001-001",
      code: "WR-001",
      parentType: "BID",
      parentId: project.id,
      title: "Stowage Plan",
      category: "Stowage Plan",
      priority: "High",
      attachmentCategory: primaryDoc.category,
      notes: "Initial cargo arrangement request from DEME.",
      assignedDivisionId: "div-ecm",
      originDivisionId: "div-ecm",
      currentStatus: "DIVISION_NOTIFIED",
      lastTransferredAt: now(),
      revisionHistory: [
        createSeedHistory("Work request created under BID-26001 and assigned to ECM.", "Ahmad Rahman", "ECM"),
      ],
    },
  ];

  return {
    companies,
    divisions,
    teams,
    members,
    clients,
    actors,
    currentActorId: "actor-prime",
    projects: [project],
    workRequests,
    documents: [],
    settings: {
      portalName: "Project Management Portal",
      categories: ["Client Request", "Engineering", "General"],
      workRequestTypes: [
        "Stowage Plan",
        "Voyage Condition",
        "Mooring Plan",
        "Mooring Analysis",
        "Grillade & Sea-Fastening Plan",
        "Berthing Feasibility",
        "Loadout Feasibility",
        "Motion Analysis",
      ],
      projectInfoCategories: ["Cargo Info", "Port Info", "SPMT Info", "Vessel info", "General info"],
    },
  };
}

const STORAGE_KEY = "project-portal-state-v7";

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PortalState>(() => {
    if (typeof window === "undefined") return createSeedState();

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createSeedState();

    try {
      return JSON.parse(stored) as PortalState;
    } catch {
      return createSeedState();
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const currentActor = useMemo(
    () => state.actors.find((actor) => actor.id === state.currentActorId) || state.actors[0],
    [state.actors, state.currentActorId]
  );

  const actorLabel = useCallback(() => currentActor.label, [currentActor.label]);
  const memberName = useCallback((memberId?: string) => state.members.find((m) => m.id === memberId)?.name || "Unknown", [state.members]);
  const divisionName = useCallback((divisionId?: string) => state.divisions.find((d) => d.id === divisionId)?.abbr || "Unknown", [state.divisions]);

  const setCurrentActorId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, currentActorId: id }));
  }, []);

  const addCompany = useCallback((payload: { name: string; abbr: string; type: string }) => {
    setState((prev) => ({ ...prev, companies: [...prev.companies, { id: uid("company"), ...payload }] }));
  }, []);

  const addDivision = useCallback((payload: { companyId: string; name: string; abbr: string; type: string }) => {
    setState((prev) => ({ ...prev, divisions: [...prev.divisions, { id: uid("division"), ...payload }] }));
  }, []);

  const addTeam = useCallback((payload: { name: string; companyId: string; divisionId: string; leadMemberId?: string }) => {
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, { id: uid("team"), ...payload, memberIds: payload.leadMemberId ? [payload.leadMemberId] : [] }],
    }));
  }, []);

  const addMember = useCallback((payload: { name: string; email: string; companyId: string; divisionId: string; teamId?: string; roleTitle: string }) => {
    const memberId = uid("member");

    setState((prev) => {
      const next = clone(prev);
      next.members.push({ id: memberId, active: true, ...payload });

      if (payload.teamId) {
        const team = next.teams.find((teamItem) => teamItem.id === payload.teamId);
        if (team && !team.memberIds.includes(memberId)) team.memberIds.push(memberId);
      }

      return next;
    });
  }, []);

  const addProject = useCallback(
    (payload: { name: string; type: "BID" | "PROJECT"; clientId: string; sourceChannel: string; initialDocuments: AttachmentInput[] }) => {
      const client = state.clients.find((item) => item.id === payload.clientId);
      const bidCount = state.projects.filter((project) => project.type === "BID").length + 1;
      const projectCount = state.projects.filter((project) => project.type === "PROJECT").length + 1;
      const code = payload.type === "BID" ? `BID-${26000 + bidCount}` : `PRJ-${26000 + projectCount}`;

      const primaryFiles: AttachmentRef[] = [];
      payload.initialDocuments.forEach((doc) => {
        primaryFiles.push(createAttachment({ ...doc, workflowStage: doc.workflowStage || "Project / Bid Intake" }, actorLabel(), primaryFiles, "PRIMARY"));
      });

      const project: ProjectItem = {
        id: uid("project"),
        code,
        name: payload.name,
        type: payload.type,
        clientId: payload.clientId,
        clientEmail: client?.email || "",
        originDivisionId: "div-ccr",
        sourceChannel: payload.sourceChannel,
        status: payload.type === "BID" ? "BIDDING" : "ACTIVE",
        initialDocuments: primaryFiles,
        credentialsSent: true,
        createdAt: now(),
      };

      setState((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
      return project;
    },
    [actorLabel, state.clients, state.projects]
  );

  const addClientDocument = useCallback(
    (projectId: string, payload: AttachmentInput) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                initialDocuments: [
                  ...project.initialDocuments,
                  createAttachment({ ...payload, workflowStage: payload.workflowStage || "Client Upload" }, actorLabel(), project.initialDocuments, "WORKFLOW"),
                ],
              }
            : project
        ),
      }));
    },
    [actorLabel]
  );

  const addWorkRequestDocument = useCallback(
    (workRequestId: string, payload: AttachmentInput) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        if (!project) return prev;

        const isTextOnlyMessage = Boolean(payload.textContent?.trim()) && !payload.fileName && !payload.fileDataUrl;
        if (isTextOnlyMessage) {
          request.revisionHistory.unshift({
            id: uid("hist"),
            at: now(),
            by: actorLabel(),
            action: "Added workflow note",
            to: payload.workflowStage || getWorkRequestStatusLabel(request.currentStatus),
            note: [payload.textContent?.trim(), payload.note?.trim()].filter(Boolean).join("\n\n"),
          });
          request.lastTransferredAt = now();
          return next;
        }

        const scopedVersionAttachments = project.initialDocuments.filter(
          (attachment) =>
            attachment.fileGroup === "PRIMARY" ||
            (attachment.fileGroup === "WORKFLOW" && attachment.workRequestId === workRequestId)
        );
        const attachment = createAttachment(
          { ...payload, workflowStage: payload.workflowStage || getWorkRequestStatusLabel(request.currentStatus) },
          actorLabel(),
          scopedVersionAttachments,
          "WORKFLOW"
        );
        attachment.workRequestId = workRequestId;

        project.initialDocuments.push(attachment);
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: `Uploaded workflow document ${attachment.name} v${attachment.version || 1}`,
          to: attachment.workflowStage,
          note: attachment.note,
        });
        request.lastTransferredAt = now();

        return next;
      });
    },
    [actorLabel]
  );

  const addWorkRequest = useCallback(
    (payload: {
      parentType: "BID" | "PROJECT";
      parentId: string;
      title: string;
      category: string;
      priority: "High" | "Medium" | "Low";
      attachmentCategory: string;
      notes: string;
      assignedDivisionId: string;
    }) => {
      setState((prev) => {
        const parent = prev.projects.find((project) => project.id === payload.parentId);
        if (!parent) return prev;

        const next = clone(prev);

        const workRequest: WorkRequest = {
          id: uid("wr"),
          code: `WR-${String(next.workRequests.length + 1).padStart(3, "0")}`,
          parentType: parent.type,
          parentId: payload.parentId,
          title: payload.title,
          category: payload.category,
          priority: payload.priority,
          attachmentCategory: payload.attachmentCategory,
          notes: payload.notes,
          assignedDivisionId: payload.assignedDivisionId,
          originDivisionId: payload.assignedDivisionId,
          currentStatus: "DIVISION_NOTIFIED",
          lastTransferredAt: now(),
          revisionHistory: [
            {
              id: uid("hist"),
              at: now(),
              by: actorLabel(),
              action: `${payload.title} created under ${parent.code} and assigned to ${divisionName(payload.assignedDivisionId)}.`,
              to: divisionName(payload.assignedDivisionId),
            },
          ],
        };

        next.workRequests.unshift(workRequest);
        return next;
      });
    },
    [actorLabel, divisionName]
  );

  const updateRequest = useCallback((workRequestId: string, updater: (request: WorkRequest) => void) => {
    setState((prev) => {
      const next = clone(prev);
      const request = next.workRequests.find((item) => item.id === workRequestId);
      if (!request) return prev;

      updater(request);
      return next;
    });
  }, []);

  const pushHistory = useCallback((request: WorkRequest, entry: Omit<HistoryEntry, "id" | "at">) => {
    request.revisionHistory.unshift({ id: uid("hist"), at: now(), ...entry });
    request.lastTransferredAt = now();
  }, []);

  const addWorkRequestNote = useCallback(
    (workRequestId: string, note: string, action = "Added workflow note") => {
      const trimmedNote = note.trim();
      if (!trimmedNote) return;

      updateRequest(workRequestId, (request) => {
        pushHistory(request, {
          by: actorLabel(),
          action,
          to: getWorkRequestStatusLabel(request.currentStatus),
          note: trimmedNote,
        });
      });
    },
    [actorLabel, pushHistory, updateRequest]
  );

  const requestWorkflowInfo = useCallback(
    (workRequestId: string, payload: {
      targetLabel: string;
      targetRole?: ActorRole;
      targetMemberId?: string;
      targetClientId?: string;
      note?: string;
    }) => {
      updateRequest(workRequestId, (request) => {
        const pendingInfoId = uid("info");
        if (request.pendingInfoRequest) {
          request.infoRequestStack = [...(request.infoRequestStack || []), request.pendingInfoRequest];
        }
        request.pendingInfoRequest = {
          id: pendingInfoId,
          requestedBy: actorLabel(),
          requestedByActorId: currentActor.id,
          requestedByMemberId: currentActor.memberId,
          requestedByRole: currentActor.role,
          targetLabel: payload.targetLabel,
          targetRole: payload.targetRole,
          targetMemberId: payload.targetMemberId,
          targetClientId: payload.targetClientId,
          statusAtRequest: request.currentStatus,
          note: payload.note?.trim() || undefined,
          requestedAt: now(),
        };
        pushHistory(request, {
          by: actorLabel(),
          action: `Requested information from ${payload.targetLabel}.`,
          from: actorLabel(),
          to: payload.targetLabel,
          note: payload.note,
        });
      });
    },
    [actorLabel, currentActor.id, currentActor.memberId, currentActor.role, pushHistory, updateRequest]
  );

  const respondWorkflowInfo = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        const target = request.pendingInfoRequest?.requestedBy || "Requester";
        pushHistory(request, {
          by: actorLabel(),
          action: "Provided requested information.",
          from: actorLabel(),
          to: target,
          note,
        });

        const previousInfoRequest = request.infoRequestStack?.pop();
        request.pendingInfoRequest = previousInfoRequest;
        if (request.infoRequestStack && request.infoRequestStack.length === 0) {
          request.infoRequestStack = undefined;
        }
      });
    },
    [actorLabel, pushHistory, updateRequest]
  );

  const requestInfoFromMarketing = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "INFO_REQUESTED_FROM_MARKETING";
        pushHistory(request, {
          by: actorLabel(),
          action: `${divisionName(request.assignedDivisionId)} lead requested review / update / information from CCR / Marketing.`,
          from: divisionName(request.assignedDivisionId),
          to: "CCR / Marketing",
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const marketingReturnToPm = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "MARKETING_INFO_PROVIDED";
        pushHistory(request, {
          by: actorLabel(),
          action: "CCR / Marketing reviewed the information and returned the updated package to the PM lead.",
          from: "CCR / Marketing",
          to: divisionName(request.assignedDivisionId),
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const marketingEscalateToClient = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "INFO_REQUESTED_FROM_CLIENT";
        pushHistory(request, {
          by: actorLabel(),
          action: "CCR / Marketing escalated the information request to the Client.",
          from: "CCR / Marketing",
          to: "Client",
          note,
        });
      });
    },
    [actorLabel, pushHistory, updateRequest]
  );

  const clientProvideInfo = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "CLIENT_INFO_PROVIDED";
        pushHistory(request, {
          by: actorLabel(),
          action: "Client provided the requested information back to CCR / Marketing.",
          from: "Client",
          to: "CCR / Marketing",
          note,
        });
      });
    },
    [actorLabel, pushHistory, updateRequest]
  );

  const memberRequestInfo = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "MEMBER_INFO_REQUESTED";
        pushHistory(request, {
          by: actorLabel(),
          action: `${memberName(request.assignedMemberId)} requested clarification from the PM lead.`,
          from: memberName(request.assignedMemberId),
          to: memberName(request.assignedLeaderId) || divisionName(request.assignedDivisionId),
          note,
        });
      });
    },
    [actorLabel, divisionName, memberName, pushHistory, updateRequest]
  );

  const pmLeadRespondToMember = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "PM_LEAD_RESPONDED";
        pushHistory(request, {
          by: actorLabel(),
          action: "PM lead resolved the clarification and returned guidance to the team member.",
          from: memberName(request.assignedLeaderId) || divisionName(request.assignedDivisionId),
          to: memberName(request.assignedMemberId),
          note,
        });
      });
    },
    [actorLabel, divisionName, memberName, pushHistory, updateRequest]
  );

  const pmMemberSubmit = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "PM_MEMBER_SUBMITTED";
        pushHistory(request, {
          by: actorLabel(),
          action: `${memberName(request.assignedMemberId)} submitted the PM work package to the PM lead for internal quality control.`,
          from: memberName(request.assignedMemberId),
          to: memberName(request.assignedLeaderId) || divisionName(request.assignedDivisionId),
          note,
        });
      });
    },
    [actorLabel, divisionName, memberName, pushHistory, updateRequest]
  );

  const pmReturnToMember = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "PM_REWORK_REQUESTED";
        pushHistory(request, {
          by: actorLabel(),
          action: "PM lead returned the work package to the team member for fixes / rework.",
          from: memberName(request.assignedLeaderId) || divisionName(request.assignedDivisionId),
          to: memberName(request.assignedMemberId),
          note,
        });
      });
    },
    [actorLabel, divisionName, memberName, pushHistory, updateRequest]
  );

  const assignLeader = useCallback(
    (workRequestId: string, leaderId: string) => {
      updateRequest(workRequestId, (request) => {
        request.assignedLeaderId = leaderId;
        request.currentStatus = "LEADER_ASSIGNED";
        pushHistory(request, {
          by: actorLabel(),
          action: `${memberName(leaderId)} assigned as division lead.`,
          to: memberName(leaderId),
        });
      });
    },
    [actorLabel, memberName, pushHistory, updateRequest]
  );

  const assignMember = useCallback(
    (workRequestId: string, memberId: string) => {
      updateRequest(workRequestId, (request) => {
        request.assignedMemberId = memberId;
        if (!request.assignedLeaderId && currentActor.memberId) request.assignedLeaderId = currentActor.memberId;
        request.currentStatus = "MEMBER_REVIEW";
        pushHistory(request, {
          by: actorLabel(),
          action: `${memberName(memberId)} assigned for PM team review / work package preparation.`,
          to: memberName(memberId),
        });
      });
    },
    [actorLabel, currentActor.memberId, memberName, pushHistory, updateRequest]
  );

  const forwardToTms = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "FORWARDED_TO_TMS";
        pushHistory(request, {
          by: actorLabel(),
          action: `PM lead approved the internal work package and forwarded it to the TMS Engineering lead.`,
          from: divisionName(request.originDivisionId),
          to: "TMS Engineering Lead",
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const assignTmsChain = useCallback(
    (workRequestId: string, payload: { drawingId: string; checkingId: string; approvalId: string }, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.tmsAssignments = {
          managerId: currentActor.memberId,
          drawingId: payload.drawingId,
          checkingId: payload.checkingId,
          approvalId: payload.approvalId,
        };
        request.currentStatus = "TMS_ASSIGNED";
        pushHistory(request, {
          by: actorLabel(),
          action: `TMS manager assigned M1 Drawing ${memberName(payload.drawingId)}, M2 Checking ${memberName(payload.checkingId)}, M3 Approval ${memberName(payload.approvalId)}.`,
          from: "TMS Engineering Lead",
          to: "TMS Workflow",
          note,
        });
      });
    },
    [actorLabel, currentActor.memberId, memberName, pushHistory, updateRequest]
  );

  const submitDrawing = useCallback(
    (workRequestId: string, documentName: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.drawingDocumentName = documentName;
        request.currentStatus = "CHECKING_REVIEW";
        pushHistory(request, {
          by: actorLabel(),
          action: `TMS-M1 drawing submitted to TMS-M2 checking stage as ${documentName}.`,
          from: memberName(request.tmsAssignments?.drawingId),
          to: memberName(request.tmsAssignments?.checkingId),
          note,
        });
      });
    },
    [actorLabel, memberName, pushHistory, updateRequest]
  );

  const reviewChecking = useCallback(
    (workRequestId: string, approved: boolean, note?: string) => {
      updateRequest(workRequestId, (request) => {
        if (approved) {
          request.currentStatus = "APPROVAL_REVIEW";
          pushHistory(request, {
            by: actorLabel(),
            action: "TMS-M2 checking approved and forwarded to TMS-M3 approval.",
            to: memberName(request.tmsAssignments?.approvalId),
            note,
          });
        } else {
          request.currentStatus = "DRAWING_IN_PROGRESS";
          pushHistory(request, {
            by: actorLabel(),
            action: "TMS-M2 checking rejected and returned to TMS-M1 drawing.",
            to: memberName(request.tmsAssignments?.drawingId),
            note,
          });
        }
      });
    },
    [actorLabel, memberName, pushHistory, updateRequest]
  );

  const reviewApproval = useCallback(
    (workRequestId: string, approved: boolean, note?: string) => {
      updateRequest(workRequestId, (request) => {
        if (approved) {
          request.currentStatus = "ENGINEERING_LEAD_REVIEW";
          pushHistory(request, {
            by: actorLabel(),
            action: `TMS-M3 approval complete and submitted to the TMS Engineering lead for final engineering release.`,
            to: "TMS Engineering Lead",
            note,
          });
        } else {
          request.currentStatus = "DRAWING_IN_PROGRESS";
          pushHistory(request, {
            by: actorLabel(),
            action: "TMS-M3 approval rejected and returned to TMS-M1 drawing.",
            to: memberName(request.tmsAssignments?.drawingId),
            note,
          });
        }
      });
    },
    [actorLabel, divisionName, memberName, pushHistory, updateRequest]
  );

  const engineeringRequestPmRevision = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "ENGINEERING_REVISION_REQUESTED";
        pushHistory(request, {
          by: actorLabel(),
          action: "TMS Engineering lead requested revision / clarification from the PM lead.",
          from: "TMS Engineering Lead",
          to: divisionName(request.assignedDivisionId),
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const tmsMemberRequestLead = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        const requesterId =
          request.currentStatus === "CHECKING_REVIEW"
            ? request.tmsAssignments?.checkingId
            : request.currentStatus === "APPROVAL_REVIEW"
              ? request.tmsAssignments?.approvalId
              : request.tmsAssignments?.drawingId || currentActor.memberId;

        request.lastTmsWorkStatus = request.currentStatus;
        request.lastTmsRequesterId = requesterId;
        request.currentStatus = "TMS_MEMBER_INFO_REQUESTED";
        pushHistory(request, {
          by: actorLabel(),
          action: `${actorLabel()} requested information / clarification from the TMS Engineering Lead.`,
          from: actorLabel(),
          to: "TMS Engineering Lead",
          note,
        });
      });
    },
    [actorLabel, currentActor.memberId, pushHistory, updateRequest]
  );

  const tmsLeadRespondToMember = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        const previousStatus = request.lastTmsWorkStatus || "TMS_ASSIGNED";
        const requesterName = memberName(request.lastTmsRequesterId);
        request.currentStatus = previousStatus;
        pushHistory(request, {
          by: actorLabel(),
          action: "TMS Engineering Lead responded to the member information request.",
          from: "TMS Engineering Lead",
          to: requesterName,
          note,
        });
        request.lastTmsWorkStatus = undefined;
        request.lastTmsRequesterId = undefined;
      });
    },
    [actorLabel, memberName, pushHistory, updateRequest]
  );

  const engineeringSubmitToMarketing = useCallback(
    (workRequestId: string, note?: string, packageKeys: string[] = []) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        const uploadedPackageIds = getLatestAttachmentIdsByKeys(project, packageKeys, ["Engineering Lead Final Review"], workRequestId);
        const fallbackPackageIds = getLatestWorkflowAttachmentIdsByStages(project, [
          "Engineering Lead Final Review",
          "TMS Approval - M3",
          "TMS Checking - M2",
          "TMS Drawing - M1",
        ], workRequestId);

        request.finalPackageAttachmentIds = uploadedPackageIds.length ? uploadedPackageIds : fallbackPackageIds;
        request.clientRevisionAttachmentIds = undefined;
        request.currentStatus = "FINAL_SUBMITTED_TO_MARKETING";
        pushHistory(request, {
          by: actorLabel(),
          action: "TMS Engineering lead submitted the final engineering package to CCR / Marketing.",
          from: "TMS Engineering Lead",
          to: "CCR / Marketing",
          note,
        });

        return next;
      });
    },
    [actorLabel, pushHistory]
  );

  const marketingSubmitToClient = useCallback(
    (workRequestId: string, note?: string, attachmentIds: string[] = [], attachmentKeys: string[] = []) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        const uploadedMarketingIds = getLatestAttachmentIdsByKeys(project, attachmentKeys, ["Marketing Final Delivery"], workRequestId);
        const selectedIds = [...new Set([...attachmentIds, ...uploadedMarketingIds])];

        request.finalPackageAttachmentIds = selectedIds.length ? selectedIds : request.finalPackageAttachmentIds;
        request.clientRevisionAttachmentIds = undefined;
        request.currentStatus = "FINAL_SUBMITTED_TO_CLIENT";
        request.lastTransferredAt = now();
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: "CCR / Marketing reviewed the final package and submitted it to the Client for acceptance.",
          from: "CCR / Marketing",
          to: "Client",
          note,
        });

        return next;
      });
    },
    [actorLabel]
  );

  const marketingRequestEngineeringRevision = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "ENGINEERING_LEAD_REVIEW";
        pushHistory(request, {
          by: actorLabel(),
          action: "CCR / Marketing requested revision from the TMS Engineering lead before client submission.",
          from: "CCR / Marketing",
          to: "TMS Engineering Lead",
          note,
        });
      });
    },
    [actorLabel, pushHistory, updateRequest]
  );

  const marketingRouteClientRevisionToTms = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "ENGINEERING_LEAD_REVIEW";
        pushHistory(request, {
          by: actorLabel(),
          action: "CCR / Marketing routed the client revision to the TMS Engineering lead.",
          from: "CCR / Marketing",
          to: "TMS Engineering Lead",
          note,
        });
      });
    },
    [actorLabel, pushHistory, updateRequest]
  );

  const marketingSubmitClientRevision = useCallback(
    (workRequestId: string, note?: string, attachmentIds: string[] = [], attachmentKeys: string[] = []) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        const uploadedMarketingIds = getLatestAttachmentIdsByKeys(project, attachmentKeys, ["Marketing Final Delivery", "Client Acceptance"], workRequestId);
        const selectedIds = [...new Set([...attachmentIds, ...uploadedMarketingIds])];

        request.finalPackageAttachmentIds = selectedIds.length ? selectedIds : request.finalPackageAttachmentIds;
        request.clientRevisionAttachmentIds = undefined;
        request.currentStatus = "FINAL_SUBMITTED_TO_CLIENT";
        request.lastTransferredAt = now();
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: "CCR / Marketing answered the client revision and sent the updated response back to the Client.",
          from: "CCR / Marketing",
          to: "Client",
          note,
        });

        return next;
      });
    },
    [actorLabel]
  );

  const engineeringRequestTmsRevision = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "DRAWING_IN_PROGRESS";
        pushHistory(request, {
          by: actorLabel(),
          action: "TMS Engineering lead requested internal TMS revision and returned the package to TMS-M1.",
          from: "TMS Engineering Lead",
          to: memberName(request.tmsAssignments?.drawingId),
          note,
        });
      });
    },
    [actorLabel, memberName, pushHistory, updateRequest]
  );

  const clientRequestRevision = useCallback(
    (workRequestId: string, note?: string, revisionKeys: string[] = []) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        const uploadedRevisionIds = getLatestAttachmentIdsByKeys(project, revisionKeys, ["Client Acceptance"], workRequestId);

        request.clientRevisionAttachmentIds = uploadedRevisionIds;
        request.currentStatus = "CLIENT_REVISION_REQUESTED";
        request.lastTransferredAt = now();
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: "Client requested revision on the final delivery and sent it back to CCR / Marketing.",
          from: "Client",
          to: "CCR / Marketing",
          note,
        });

        return next;
      });
    },
    [actorLabel]
  );

  const marketingSendClientRevisionToPm = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "ENGINEERING_REVISION_REQUESTED";
        pushHistory(request, {
          by: actorLabel(),
          action: "CCR / Marketing reviewed the client revision and routed it to the PM lead for restart / correction.",
          from: "CCR / Marketing",
          to: divisionName(request.assignedDivisionId),
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const clientAcceptFinal = useCallback(
    (workRequestId: string, note?: string) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        const previousCode = project?.code;

        request.currentStatus = "HML_LISTED";
        request.lastTransferredAt = now();
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: "Client accepted the final delivery. Cycle completed and the bid is waiting for client assignment.",
          from: "Client",
          to: project ? "Project" : "HML Registry",
          note,
        });

        if (project && project.type === "BID") {
          project.status = "DRAFT";
          project.progressOverride = 100;
          request.revisionHistory.unshift({
            id: uid("hist"),
            at: now(),
            by: actorLabel(),
            action: `Accepted bid ${previousCode || "Bid"} moved to Client Pending. It will stay in CCR Bid list until the client assigns it as an active project.`,
            from: previousCode || "Bid",
            to: "Client Pending",
          });
        }

        const exists = next.documents.some((doc) => doc.workRequestId === workRequestId);
        if (!exists) {
          next.documents.unshift({
            id: uid("doc"),
            projectId: request.parentId,
            workRequestId,
            name: request.drawingDocumentName || `${request.title} Final Accepted Package`,
            category: request.attachmentCategory || request.category,
            divisionId: request.originDivisionId,
            listedAt: now(),
            listedBy: actorLabel(),
          });
        }

        return next;
      });
    },
    [actorLabel]
  );

  const clientRejectFinal = useCallback(
    (workRequestId: string, note?: string) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        const project = next.projects.find((item) => item.id === request.parentId);
        request.currentStatus = "REJECTED";
        request.lastTransferredAt = now();
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: "Client rejected this work request final delivery. The parent project/bid status was not changed.",
          from: "Client",
          to: project ? `${project.code} work request archive` : "Work request archive",
          note,
        });

        return next;
      });
    },
    [actorLabel]
  );

  const originMemberDecision = useCallback(
    (workRequestId: string, approved: boolean, note?: string) => {
      updateRequest(workRequestId, (request) => {
        if (approved) {
          request.currentStatus = "DIVISION_MEMBER_APPROVED";
          pushHistory(request, {
            by: actorLabel(),
            action: `${divisionName(request.originDivisionId)} member approved returned TMS package.`,
            note,
          });
        } else {
          request.currentStatus = "FORWARDED_TO_TMS";
          pushHistory(request, {
            by: actorLabel(),
            action: `${divisionName(request.originDivisionId)} member rejected package and returned it to TMS.`,
            to: "TMS",
            note,
          });
        }
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const originManagerApprove = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "DIVISION_MANAGER_APPROVED";
        pushHistory(request, {
          by: actorLabel(),
          action: `${divisionName(request.originDivisionId)} manager approved the package.`,
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const forwardToCcr = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        request.currentStatus = "FORWARDED_TO_CCR";
        pushHistory(request, {
          by: actorLabel(),
          action: `${divisionName(request.originDivisionId)} manager forwarded the package to CCR for final listing.`,
          to: "CCR",
          note,
        });
      });
    },
    [actorLabel, divisionName, pushHistory, updateRequest]
  );

  const sendBackward = useCallback(
    (workRequestId: string, note?: string) => {
      updateRequest(workRequestId, (request) => {
        const backwardMap: Partial<Record<WorkRequestStatus, { status: WorkRequestStatus; label: string; to?: string }>> = {
          LEADER_ASSIGNED: { status: "DIVISION_NOTIFIED", label: "Division Notified", to: divisionName(request.assignedDivisionId) },
          MEMBER_REVIEW: { status: "LEADER_ASSIGNED", label: "Division Lead Assignment", to: memberName(request.assignedLeaderId) },
          INFO_REQUESTED_FROM_MARKETING: { status: "DIVISION_NOTIFIED", label: "PM Lead Initial Review", to: divisionName(request.assignedDivisionId) },
          INFO_REQUESTED_FROM_CLIENT: { status: "INFO_REQUESTED_FROM_MARKETING", label: "CCR / Marketing Review", to: "CCR / Marketing" },
          CLIENT_INFO_PROVIDED: { status: "INFO_REQUESTED_FROM_CLIENT", label: "Client Information Request", to: "Client" },
          MARKETING_INFO_PROVIDED: { status: "INFO_REQUESTED_FROM_MARKETING", label: "CCR / Marketing Clarification", to: "CCR / Marketing" },
          MEMBER_INFO_REQUESTED: { status: "MEMBER_REVIEW", label: "PM Member Work", to: memberName(request.assignedMemberId) },
          PM_LEAD_RESPONDED: { status: "MEMBER_INFO_REQUESTED", label: "PM Member Query", to: memberName(request.assignedLeaderId) },
          PM_MEMBER_SUBMITTED: { status: "MEMBER_REVIEW", label: "PM Member Work", to: memberName(request.assignedMemberId) },
          PM_REWORK_REQUESTED: { status: "PM_MEMBER_SUBMITTED", label: "PM Lead QC", to: memberName(request.assignedLeaderId) },
          FORWARDED_TO_TMS: { status: "PM_MEMBER_SUBMITTED", label: "PM Lead QC", to: memberName(request.assignedLeaderId) },
          TMS_ASSIGNED: { status: "FORWARDED_TO_TMS", label: "TMS Manager Intake", to: "TMS Manager" },
          DRAWING_IN_PROGRESS: { status: "TMS_ASSIGNED", label: "TMS Chain Assignment", to: "TMS Manager" },
          CHECKING_REVIEW: { status: "DRAWING_IN_PROGRESS", label: "TMS-M1 Drawing Rework", to: memberName(request.tmsAssignments?.drawingId) },
          APPROVAL_REVIEW: { status: "CHECKING_REVIEW", label: "TMS-M2 Checking Rework", to: memberName(request.tmsAssignments?.checkingId) },
          ENGINEERING_REVISION_REQUESTED: { status: "FORWARDED_TO_TMS", label: "Engineering Lead Review", to: "TMS Engineering Lead" },
          ENGINEERING_LEAD_REVIEW: { status: "APPROVAL_REVIEW", label: "TMS-M3 Approval", to: memberName(request.tmsAssignments?.approvalId) },
          FINAL_SUBMITTED_TO_MARKETING: { status: "ENGINEERING_LEAD_REVIEW", label: "Engineering Lead Final Review", to: "TMS Engineering Lead" },
          FINAL_SUBMITTED_TO_CLIENT: { status: "FINAL_SUBMITTED_TO_MARKETING", label: "CCR / Marketing Final Review", to: "CCR / Marketing" },
          CLIENT_REVISION_REQUESTED: { status: "FINAL_SUBMITTED_TO_CLIENT", label: "Client Acceptance Review", to: "Client" },
          RETURNED_TO_DIVISION: { status: "APPROVAL_REVIEW", label: "TMS-M3 Approval Rework", to: memberName(request.tmsAssignments?.approvalId) },
          DIVISION_MEMBER_APPROVED: { status: "RETURNED_TO_DIVISION", label: "Division Member Final Review", to: memberName(request.assignedMemberId) },
          DIVISION_MANAGER_APPROVED: { status: "DIVISION_MEMBER_APPROVED", label: "Division Member Approved Stage", to: memberName(request.assignedMemberId) },
          FORWARDED_TO_CCR: { status: "DIVISION_MANAGER_APPROVED", label: "Division Manager Approval", to: divisionName(request.originDivisionId) },
        };

        const target = backwardMap[request.currentStatus];
        if (!target) return;

        const previousStatus = request.currentStatus;
        request.currentStatus = target.status;
        pushHistory(request, {
          by: actorLabel(),
          action: `Sent backward from ${getWorkRequestStatusLabel(previousStatus)} to ${target.label}.`,
          from: getWorkRequestStatusLabel(previousStatus),
          to: target.to || target.label,
          note,
        });
      });
    },
    [actorLabel, divisionName, memberName, pushHistory, updateRequest]
  );

  const listFinalDocument = useCallback(
    (workRequestId: string, payload: { name: string; category: string }) => {
      setState((prev) => {
        const next = clone(prev);
        const request = next.workRequests.find((item) => item.id === workRequestId);
        if (!request) return prev;

        request.currentStatus = "HML_LISTED";
        request.lastTransferredAt = now();
        request.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: `CCR listed final document ${payload.name} in HML registry.`,
          to: "HML Document List",
        });

        next.documents.unshift({
          id: uid("doc"),
          projectId: request.parentId,
          workRequestId,
          name: payload.name,
          category: payload.category,
          divisionId: request.originDivisionId,
          listedAt: now(),
          listedBy: actorLabel(),
        });

        return next;
      });
    },
    [actorLabel]
  );

  const decideBidOutcome = useCallback(
    (projectId: string, outcome: "WIN" | "LOSE") => {
      setState((prev) => {
        const next = clone(prev);
        const project = next.projects.find((item) => item.id === projectId);
        if (!project || project.type !== "BID") return prev;

        const relatedRequests = next.workRequests.filter((request) => request.parentId === project.id);
        const bidIsReady = relatedRequests.some((request) => request.currentStatus === "HML_LISTED");
        if (!bidIsReady) return prev;

        if (outcome === "WIN") {
          const previousCode = project.code;
          project.type = "PROJECT";
          project.status = "ACTIVE";
          project.progressOverride = 0;
          project.code = previousCode.startsWith("BID-")
            ? previousCode.replace("BID-", "PRJ-")
            : `PRJ-${26000 + next.projects.filter((item) => item.type === "PROJECT").length + 1}`;

          relatedRequests.forEach((request) => {
            request.parentType = "PROJECT";
            request.revisionHistory.unshift({
              id: uid("hist"),
              at: now(),
              by: actorLabel(),
              action: `Bid marked as won and converted from ${previousCode} to ${project.code}.`,
              from: previousCode,
              to: project.code,
            });
          });
        } else {
          project.status = "ARCHIVED";
          project.progressOverride = 100;

          relatedRequests.forEach((request) => {
            request.revisionHistory.unshift({
              id: uid("hist"),
              at: now(),
              by: actorLabel(),
              action: `Bid marked as lost and moved to archive.`,
              from: project.code,
              to: "Archive",
            });
          });
        }

        return next;
      });
    },
    [actorLabel]
  );

  const requestArchivedBidReview = useCallback(
    (projectId: string, note?: string) => {
      setState((prev) => {
        const next = clone(prev);
        const project = next.projects.find((item) => item.id === projectId);
        if (!project || project.status !== "ARCHIVED") return prev;

        const relatedRequests = next.workRequests.filter((request) => request.parentId === project.id);
        const targetRequest = relatedRequests.find((request) => request.currentStatus === "REJECTED") || relatedRequests[0];
        if (!targetRequest) return prev;

        project.status = "BIDDING";
        project.progressOverride = 100;
        targetRequest.currentStatus = "FINAL_SUBMITTED_TO_CLIENT";
        targetRequest.lastTransferredAt = now();
        targetRequest.revisionHistory.unshift({
          id: uid("hist"),
          at: now(),
          by: actorLabel(),
          action: "Archived bid was sent back to the Client for review.",
          from: "Archive",
          to: "Client",
          note: note || "Review requested from archived bid record.",
        });

        return next;
      });
    },
    [actorLabel]
  );

  const updateSettings = useCallback((payload: Partial<PortalSettings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...payload } }));
  }, []);

  const value = useMemo<PortalContextValue>(
    () => ({
      state,
      currentActor,
      setCurrentActorId,
      addCompany,
      addDivision,
      addTeam,
      addMember,
      addProject,
      addClientDocument,
      addWorkRequestDocument,
      addWorkRequestNote,
      requestWorkflowInfo,
      respondWorkflowInfo,
      addWorkRequest,
      requestInfoFromMarketing,
      marketingReturnToPm,
      marketingEscalateToClient,
      clientProvideInfo,
      memberRequestInfo,
      pmLeadRespondToMember,
      pmMemberSubmit,
      pmReturnToMember,
      assignLeader,
      assignMember,
      forwardToTms,
      engineeringRequestPmRevision,
      tmsMemberRequestLead,
      tmsLeadRespondToMember,
      engineeringSubmitToMarketing,
      marketingSubmitToClient,
      marketingRequestEngineeringRevision,
      marketingRouteClientRevisionToTms,
      marketingSubmitClientRevision,
      engineeringRequestTmsRevision,
      clientAcceptFinal,
      clientRejectFinal,
      clientRequestRevision,
      marketingSendClientRevisionToPm,
      assignTmsChain,
      submitDrawing,
      reviewChecking,
      reviewApproval,
      originMemberDecision,
      originManagerApprove,
      forwardToCcr,
      sendBackward,
      listFinalDocument,
      decideBidOutcome,
      requestArchivedBidReview,
      updateSettings,
    }),
    [
      state,
      currentActor,
      setCurrentActorId,
      addCompany,
      addDivision,
      addTeam,
      addMember,
      addProject,
      addClientDocument,
      addWorkRequestDocument,
      addWorkRequestNote,
      requestWorkflowInfo,
      respondWorkflowInfo,
      addWorkRequest,
      requestInfoFromMarketing,
      marketingReturnToPm,
      marketingEscalateToClient,
      clientProvideInfo,
      memberRequestInfo,
      pmLeadRespondToMember,
      pmMemberSubmit,
      pmReturnToMember,
      assignLeader,
      assignMember,
      forwardToTms,
      engineeringRequestPmRevision,
      tmsMemberRequestLead,
      tmsLeadRespondToMember,
      engineeringSubmitToMarketing,
      marketingSubmitToClient,
      marketingRequestEngineeringRevision,
      marketingRouteClientRevisionToTms,
      marketingSubmitClientRevision,
      engineeringRequestTmsRevision,
      clientAcceptFinal,
      clientRejectFinal,
      clientRequestRevision,
      marketingSendClientRevisionToPm,
      assignTmsChain,
      submitDrawing,
      reviewChecking,
      reviewApproval,
      originMemberDecision,
      originManagerApprove,
      forwardToCcr,
      sendBackward,
      listFinalDocument,
      decideBidOutcome,
      requestArchivedBidReview,
      updateSettings,
    ]
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalDataProvider");
  return ctx;
}

export function getProjectLabel(project: ProjectItem) {
  return `${project.code} — ${project.name}`;
}

export function getWorkRequestStatusLabel(status: WorkRequestStatus) {
  return {
    CREATED: "Created",
    DIVISION_NOTIFIED: "PM Lead Initial Review",
    INFO_REQUESTED_FROM_MARKETING: "PM Requested Info from Marketing",
    INFO_REQUESTED_FROM_CLIENT: "Marketing Requested Info from Client",
    CLIENT_INFO_PROVIDED: "Client Info Provided to Marketing",
    MARKETING_INFO_PROVIDED: "Marketing Info Returned to PM",
    LEADER_ASSIGNED: "PM Lead Assigned",
    MEMBER_REVIEW: "PM Member Work",
    MEMBER_INFO_REQUESTED: "PM Member Requested Info",
    PM_LEAD_RESPONDED: "PM Lead Responded to Member",
    PM_MEMBER_SUBMITTED: "PM Member Submitted to Lead",
    PM_REWORK_REQUESTED: "PM Lead Requested Rework",
    FORWARDED_TO_TMS: "Forwarded to TMS Engineering Lead",
    ENGINEERING_REVISION_REQUESTED: "Engineering Requested PM Revision",
    TMS_MEMBER_INFO_REQUESTED: "TMS Member Requested Lead Info",
    TMS_ASSIGNED: "TMS Engineering Chain Assigned",
    DRAWING_IN_PROGRESS: "TMS-M1 Drawing",
    CHECKING_REVIEW: "TMS-M2 Checking",
    APPROVAL_REVIEW: "TMS-M3 Approval",
    ENGINEERING_LEAD_REVIEW: "Engineering Lead Final Review",
    FINAL_SUBMITTED_TO_MARKETING: "Final Submitted to Marketing",
    FINAL_SUBMITTED_TO_CLIENT: "Final Submitted to Client",
    CLIENT_REVISION_REQUESTED: "Client Requested Revision",
    RETURNED_TO_DIVISION: "Returned to PM Member",
    DIVISION_MEMBER_APPROVED: "PM Member Approved",
    DIVISION_MANAGER_APPROVED: "PM Lead Approved",
    FORWARDED_TO_CCR: "Forwarded to CCR",
    HML_LISTED: "Client Accepted / HML Listed",
    REJECTED: "Rejected",
  }[status];
}

export function statusToSimple(status: WorkRequestStatus): "pending" | "active" | "in-progress" | "completed" | "rejected" | "draft" {
  if (["HML_LISTED"].includes(status)) return "completed";
  if (["REJECTED"].includes(status)) return "rejected";
  if (["CREATED"].includes(status)) return "draft";
  if (
    [
      "DIVISION_NOTIFIED",
      "INFO_REQUESTED_FROM_MARKETING",
      "INFO_REQUESTED_FROM_CLIENT",
      "CLIENT_INFO_PROVIDED",
      "MARKETING_INFO_PROVIDED",
      "LEADER_ASSIGNED",
      "MEMBER_REVIEW",
      "MEMBER_INFO_REQUESTED",
      "PM_LEAD_RESPONDED",
      "PM_MEMBER_SUBMITTED",
      "PM_REWORK_REQUESTED",
      "FORWARDED_TO_TMS",
      "ENGINEERING_REVISION_REQUESTED",
      "TMS_MEMBER_INFO_REQUESTED",
      "TMS_ASSIGNED",
      "DRAWING_IN_PROGRESS",
      "CHECKING_REVIEW",
      "APPROVAL_REVIEW",
      "ENGINEERING_LEAD_REVIEW",
      "FINAL_SUBMITTED_TO_MARKETING",
      "FINAL_SUBMITTED_TO_CLIENT",
      "CLIENT_REVISION_REQUESTED",
      "RETURNED_TO_DIVISION",
      "DIVISION_MEMBER_APPROVED",
      "DIVISION_MANAGER_APPROVED",
      "FORWARDED_TO_CCR",
    ].includes(status)
  ) {
    return "in-progress";
  }
  return "pending";
}

export function actorCanManageProjects(role: ActorRole) {
  return ["system_admin", "prime_consultant", "ccr_coordinator"].includes(role);
}

export function actorCanCreateWorkRequests(role: ActorRole) {
  return ["system_admin", "prime_consultant", "ccr_coordinator"].includes(role);
}

export function belongsToDivision(member: Member | undefined, divisionId: string) {
  return member?.divisionId === divisionId;
}

export function formatDate(value: string) {
  return fmt(value);
}
